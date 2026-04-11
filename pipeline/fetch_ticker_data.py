#!/usr/bin/env python3
"""
Fetch source data for the live news ticker.

Queries the datawarehouse table r-media-headlines directly via Athena
(same source the Slack bot used). Falls back to the datamart if needed.

Writes ticker_objects.csv and ticker_index.csv next to this script.
"""

import csv
import os
import sys
import time
from datetime import date, timedelta

import boto3

REGION = "ca-central-1"
WORKGROUP = "ellipse-work-group"
DATABASE = "gluestackdatamartdbd046f685"
LOOKBACK_DAYS = 2
DATAWAREHOUSE_TABLE = "r-media-headlines"


def write_rows_csv(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def run_query(athena, sql, database):
    resp = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": database},
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


def resolve_database_for_table(glue, table_name, preferred_db=None):
    if preferred_db:
        try:
            glue.get_table(DatabaseName=preferred_db, Name=table_name)
            return preferred_db
        except Exception:
            pass

    paginator = glue.get_paginator("get_databases")
    names = []
    for page in paginator.paginate():
        for db in page.get("DatabaseList", []):
            n = db.get("Name")
            if n:
                names.append(n)

    # Try likely matches first for faster resolution.
    preferred_order = sorted(
        names,
        key=lambda n: (
            0 if "datawarehouse" in n else (1 if "datamart" in n else 2),
            n,
        ),
    )

    for db_name in preferred_order:
        try:
            glue.get_table(DatabaseName=db_name, Name=table_name)
            return db_name
        except Exception:
            continue

    return None


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    start_date = (date.today() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")

    athena = boto3.client("athena", region_name=REGION)
    s3 = boto3.client("s3", region_name=REGION)
    glue = boto3.client("glue", region_name=REGION)

    # --- Primary source: datawarehouse (r-media-headlines) ---
    preferred_dwh_db = os.environ.get("DATAWAREHOUSE_DATABASE", "").strip() or None
    dwh_db = resolve_database_for_table(glue, DATAWAREHOUSE_TABLE, preferred_db=preferred_dwh_db)

    if dwh_db:
        try:
            print(f"Fetching ticker from datawarehouse table {dwh_db}.{DATAWAREHOUSE_TABLE}...")
            today = date.today()
            yesterday = today - timedelta(days=1)
            q_dwh = f"""
                SELECT
                    '' AS country_id,
                    '' AS time_interval_utc,
                    media_id,
                    metadata_url AS url,
                    CONCAT(
                        CAST(extraction_year AS VARCHAR), '-',
                        LPAD(CAST(extraction_month AS VARCHAR), 2, '0'), '-',
                        LPAD(CAST(extraction_day AS VARCHAR), 2, '0'), ' ',
                        COALESCE(extraction_time, '00:00:00')
                    ) AS headline_stop_utc,
                    '' AS extracted_objects,
                    title
                FROM "{DATAWAREHOUSE_TABLE}"
                WHERE media_id IS NOT NULL
                  AND title IS NOT NULL
                  AND title <> ''
                  AND metadata_url IS NOT NULL
                  AND metadata_url <> ''
                  AND (
                    (extraction_year = {today.year} AND extraction_month = {today.month} AND extraction_day = {today.day})
                    OR
                    (extraction_year = {yesterday.year} AND extraction_month = {yesterday.month} AND extraction_day = {yesterday.day})
                  )
                ORDER BY extraction_year DESC, extraction_month DESC, extraction_day DESC, extraction_time DESC
                LIMIT 500
            """
            dwh_loc = run_query(athena, q_dwh, dwh_db)
            s3_download(s3, dwh_loc, os.path.join(script_dir, "ticker_objects.csv"))
            write_rows_csv(
                os.path.join(script_dir, "ticker_index.csv"),
                ["date_utc", "time_interval_utc", "urls", "titles"],
                [],
            )
            print("  -> saved ticker_objects.csv (datawarehouse)")
            print("  -> saved ticker_index.csv (empty compatibility file)")
            return
        except Exception as e:
            print(f"WARNING: datawarehouse query failed ({e}); falling back to datamart.", file=sys.stderr)

    # --- Fallback: datamart ---
    print(f"Fetching ticker objects from datamart ({start_date})...")
    q_objects = f"""
        SELECT country_id, time_interval_utc, media_id, url,
               headline_stop_utc, extracted_objects
        FROM "vitrine_datamart-salient_headlines_objects"
        WHERE substr(headline_stop_utc, 1, 10) >= '{start_date}'
    """
    objects_loc = run_query(athena, q_objects, DATABASE)
    s3_download(s3, objects_loc, os.path.join(script_dir, "ticker_objects.csv"))
    print("  -> saved ticker_objects.csv")

    print(f"Fetching ticker title map from datamart ({start_date})...")
    q_index = f"""
        SELECT date_utc, time_interval_utc, urls, titles
        FROM "vitrine_datamart-salient_index"
        WHERE date_utc >= DATE '{start_date}'
    """
    index_loc = run_query(athena, q_index, DATABASE)
    s3_download(s3, index_loc, os.path.join(script_dir, "ticker_index.csv"))
    print("  -> saved ticker_index.csv")


if __name__ == "__main__":
    main()
