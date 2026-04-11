#!/usr/bin/env python3
"""
Fetch Athena data for the live news ticker.
Writes ticker_index.csv and ticker_objects.csv next to this script.
"""

import boto3
import os
import sys
import time
from datetime import date, timedelta

REGION = "ca-central-1"
WORKGROUP = "ellipse-work-group"
DATABASE = "gluestackdatamartdbd046f685"
LOOKBACK_DAYS = 2


def run_query(athena, sql):
    resp = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": DATABASE},
        WorkGroup=WORKGROUP,
    )
    qid = resp["QueryExecutionId"]
    for _ in range(300):
        info = athena.get_query_execution(QueryExecutionId=qid)["QueryExecution"]
        state = info["Status"]["State"]
        if state == "SUCCEEDED":
            return info["ResultConfiguration"]["OutputLocation"]
        if state in ("FAILED", "CANCELLED"):
            reason = info["Status"].get("StateChangeReason", "")
            print(f"ERROR: Query {state}: {reason}", file=sys.stderr)
            sys.exit(1)
        time.sleep(2)
    print("ERROR: Query timed out", file=sys.stderr)
    sys.exit(1)


def s3_download(s3, s3_uri, local_path):
    bucket, key = s3_uri.replace("s3://", "").split("/", 1)
    s3.download_file(bucket, key, local_path)


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    start_date = (date.today() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")

    athena = boto3.client("athena", region_name=REGION)
    s3 = boto3.client("s3", region_name=REGION)

    print(f"Fetching ticker objects from {start_date}...")
    q_objects = f"""
        SELECT country_id, time_interval_utc, media_id, url,
               headline_stop_utc, extracted_objects
        FROM "vitrine_datamart-salient_headlines_objects"
        WHERE substr(headline_stop_utc, 1, 10) >= '{start_date}'
    """
    objects_loc = run_query(athena, q_objects)
    s3_download(s3, objects_loc, os.path.join(script_dir, "ticker_objects.csv"))
    print("  -> saved ticker_objects.csv")

    print(f"Fetching ticker title map from {start_date}...")
    q_index = f"""
        SELECT date_utc, time_interval_utc, urls, titles
        FROM "vitrine_datamart-salient_index"
        WHERE date_utc >= DATE '{start_date}'
    """
    index_loc = run_query(athena, q_index)
    s3_download(s3, index_loc, os.path.join(script_dir, "ticker_index.csv"))
    print("  -> saved ticker_index.csv")


if __name__ == "__main__":
    main()
