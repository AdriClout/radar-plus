#!/usr/bin/env python3
"""
Fetch Athena data for Constellation des Objets.
Uses boto3 (official AWS SDK) — no session-token issues.
Writes salient_index.csv and salient_objects.csv next to this script.
"""

import boto3
import time
import os
import sys
from datetime import date, timedelta

REGION       = "ca-central-1"
WORKGROUP    = "ellipse-work-group"
DATABASE     = "gluestackdatamartdbd046f685"
HISTORY_DAYS = 90


def run_query(athena, sql):
    resp = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": DATABASE},
        WorkGroup=WORKGROUP,
    )
    qid = resp["QueryExecutionId"]
    for _ in range(300):          # max ~10 min
        info   = athena.get_query_execution(QueryExecutionId=qid)["QueryExecution"]
        state  = info["Status"]["State"]
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
    script_dir    = os.path.dirname(os.path.abspath(__file__))
    history_start = (date.today() - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%d")

    athena = boto3.client("athena", region_name=REGION)
    s3     = boto3.client("s3",     region_name=REGION)

    print(f"Fetching salient_index from {history_start}...")
    q1 = f"""
        SELECT country_id, date_utc, time_interval_utc, extracted_objects,
               absolute_normalized_index, n, urls, titles
        FROM "vitrine_datamart-salient_index"
        WHERE date_utc >= DATE '{history_start}'
    """
    loc1 = run_query(athena, q1)
    s3_download(s3, loc1, os.path.join(script_dir, "salient_index.csv"))
    print("  -> saved salient_index.csv")

    print(f"Fetching salient_headlines_objects from {history_start}...")
    q2 = f"""
        SELECT country_id, time_interval_utc, media_id, url,
               headline_stop_utc, extracted_objects
        FROM "vitrine_datamart-salient_headlines_objects"
        WHERE substr(headline_stop_utc, 1, 10) >= '{history_start}'
    """
    loc2 = run_query(athena, q2)
    s3_download(s3, loc2, os.path.join(script_dir, "salient_objects.csv"))
    print("  -> saved salient_objects.csv")


if __name__ == "__main__":
    main()
