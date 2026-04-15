#!/usr/bin/env python3
"""
Fetch source data for the live news ticker.

Primary: reads raw CSV files from PROD warehouse S3
  s3://{PROD_WAREHOUSE}/r-media-headlines/{MEDIA}/unprocessed/*.csv
  Written every ~10 min by scraper Lambdas — true real-time freshness.

Fallback: Athena query on the PROD warehouse Parquet table (refreshed ~4h).

Writes ticker_objects.csv and ticker_index.csv next to this script.
"""

import csv
import io
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone

import boto3

REGION = "ca-central-1"
WORKGROUP = "ellipse-work-group"
WAREHOUSE_DB = "gluestackdatawarehousedbe64d5725"
DATAMART_DB = "gluestackdatamartdbd046f685"

# PROD warehouse bucket — raw CSVs at r-media-headlines/{MEDIA}/unprocessed/
PROD_WAREHOUSE_BUCKET = "bucket-stack-datawarehousebucketa0f23e27-ogdtukqdpusx"
RAW_PREFIX = "r-media-headlines"

# Max CSVs per media to download (each CSV = one 10-min scrape snapshot).
# 150 ≈ 25h of snapshots; combined with today+yesterday listing = ~48h coverage.
MAX_CSV_PER_MEDIA = 150

MEDIA_IDS = [
    "TVA", "RCI", "NP", "JDM", "CBC", "LAP", "VS",
    "LED", "MG", "CTV", "TTS", "GN", "GAM", "FXN", "CNN",
]

# Output field order expected by build_ticker.R.
OUT_FIELDS = [
    "country_id", "time_interval_utc", "media_id",
    "url", "headline_stop_utc", "extracted_objects", "title",
]


# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------

def parse_extraction_ts(row):
    """Build timestamp from extraction_date + extraction_time columns."""
    ext_date = (row.get("extraction_date") or "").strip()
    ext_time = (row.get("extraction_time") or "00:00:00").strip()
    # extraction_time looks like "03:07:53.547Z" — trim millis and Z
    ext_time = ext_time.split(".")[0].rstrip("Z")
    # Handle case where only year/month/day separate columns exist
    if not ext_date and row.get("extraction_year"):
        try:
            ext_date = "{:04d}-{:02d}-{:02d}".format(
                int(row["extraction_year"]),
                int(row.get("extraction_month", 1)),
                int(row.get("extraction_day", 1)),
            )
        except (ValueError, TypeError):
            return ""
    return f"{ext_date} {ext_time}" if ext_date else ""


# ---------------------------------------------------------------------------
# Primary: raw CSV files from PROD warehouse (every ~10 min)
# ---------------------------------------------------------------------------

def fetch_raw_csvs(s3_client):
    """Download latest CSVs from PROD warehouse r-media-headlines/{MEDIA}/unprocessed/ and processed/."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday_str = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    rows = []

    for media_id in MEDIA_IDS:
        csv_keys = []
        for subfolder in ("unprocessed", "processed"):
            prefix = f"{RAW_PREFIX}/{media_id}/{subfolder}/"
            try:
                paginator = s3_client.get_paginator("list_objects_v2")
                for page in paginator.paginate(
                    Bucket=PROD_WAREHOUSE_BUCKET,
                    Prefix=prefix,
                    PaginationConfig={"MaxItems": 2000},
                ):
                    for obj in page.get("Contents", []):
                        key = obj["Key"]
                        if not key.endswith(".csv"):
                            continue
                        # Only today and yesterday
                        key_base = key.split("/")[-1]
                        if today_str not in key_base and yesterday_str not in key_base:
                            continue
                        csv_keys.append((obj["LastModified"], key))
            except Exception as e:
                print(f"  WARN: could not list {prefix}: {e}", file=sys.stderr)
                continue

        # Most recent first, cap at MAX_CSV_PER_MEDIA
        csv_keys.sort(key=lambda x: x[0], reverse=True)
        csv_keys = csv_keys[:MAX_CSV_PER_MEDIA]

        for last_mod, key in csv_keys:
            try:
                resp = s3_client.get_object(Bucket=PROD_WAREHOUSE_BUCKET, Key=key)
                body = resp["Body"].read().decode("utf-8", errors="replace")
                reader = csv.DictReader(io.StringIO(body))
                for r in reader:
                    # Strip Glue schema type hints from header (e.g. "title:string" -> "title")
                    row = {k.split(":")[0].strip(): v for k, v in r.items() if k}
                    url = (row.get("metadata_url") or "").strip()
                    title = (row.get("title") or "").strip()
                    mid = (row.get("media_id") or media_id).strip().upper()
                    if not url or not title:
                        continue
                    ts = parse_extraction_ts(row)
                    if not ts:
                        continue
                    rows.append({
                        "country_id": "",
                        "time_interval_utc": "",
                        "media_id": mid,
                        "url": url,
                        "headline_stop_utc": ts,
                        "extracted_objects": "",
                        "title": title,
                    })
            except Exception as e:
                print(f"  WARN: could not parse {key}: {e}", file=sys.stderr)

        if csv_keys:
            print(f"  {media_id}: {len(csv_keys)} CSV(s)")

    return sorted(rows, key=lambda r: r["headline_stop_utc"], reverse=True)


# ---------------------------------------------------------------------------
# Fallback: Athena PROD warehouse Parquet (refreshed ~4h by Glue)
# ---------------------------------------------------------------------------

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
            raise RuntimeError(f"Query {state}: {reason}")
        time.sleep(2)
    raise RuntimeError("Query timed out after 600s")


def s3_download(s3_client, s3_uri, local_path):
    bucket, key = s3_uri.replace("s3://", "").split("/", 1)
    s3_client.download_file(bucket, key, local_path)


def fetch_athena_warehouse(athena, s3_client, script_dir):
    today = date.today()
    yesterday = today - timedelta(days=1)
    ty, tm, td = today.year, today.month, today.day
    yy, ym, yd = yesterday.year, yesterday.month, yesterday.day

    where = (
        f"(extraction_year={ty} AND extraction_month={tm} AND extraction_day={td})"
        f" OR (extraction_year={yy} AND extraction_month={ym} AND extraction_day={yd})"
    )
    sql = f"""
        SELECT media_id, extraction_date, extraction_time, title, metadata_url AS url
        FROM "r-media-headlines"
        WHERE {where}
        ORDER BY extraction_date DESC, extraction_time DESC
    """
    print(f"[athena-warehouse] Querying r-media-headlines for {yesterday}/{today}...")
    loc = run_query(athena, sql, WAREHOUSE_DB)
    raw_path = os.path.join(script_dir, "_wh_raw.csv")
    s3_download(s3_client, loc, raw_path)

    rows = []
    with open(raw_path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            url = (r.get("url") or "").strip()
            title = (r.get("title") or "").strip()
            mid = (r.get("media_id") or "").strip().upper()
            if not url or not title:
                continue
            ext_date = (r.get("extraction_date") or "").strip()
            ext_time = (r.get("extraction_time") or "00:00:00").strip().split(".")[0].rstrip("Z")
            ts = f"{ext_date} {ext_time}" if ext_date else ""
            rows.append({
                "country_id": "", "time_interval_utc": "", "media_id": mid,
                "url": url, "headline_stop_utc": ts,
                "extracted_objects": "", "title": title,
            })
    os.remove(raw_path)
    print(f"  -> {len(rows)} headlines from Athena warehouse")
    return rows


def fetch_athena_datamart(athena, s3_client, script_dir):
    start_date = (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")
    print(f"[athena-datamart] Querying salient_headlines_objects from {start_date}...")

    q = f"""
        SELECT country_id, time_interval_utc, media_id, url,
               headline_stop_utc, extracted_objects
        FROM "vitrine_datamart-salient_headlines_objects"
        WHERE substr(headline_stop_utc,1,10) >= '{start_date}'
    """
    loc = run_query(athena, q, DATAMART_DB)
    out_path = os.path.join(script_dir, "ticker_objects.csv")
    s3_download(s3_client, loc, out_path)
    with open(out_path) as f:
        row_count = sum(1 for _ in f) - 1
    print(f"  -> saved ticker_objects.csv — {row_count} rows")

    q2 = f"""
        SELECT date_utc, time_interval_utc, urls, titles
        FROM "vitrine_datamart-salient_index"
        WHERE date_utc >= DATE '{start_date}'
    """
    loc2 = run_query(athena, q2, DATAMART_DB)
    s3_download(s3_client, loc2, os.path.join(script_dir, "ticker_index.csv"))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    s3_client = boto3.client("s3", region_name=REGION)
    athena = boto3.client("athena", region_name=REGION)

    all_rows = []

    # Step 1: raw CSVs from PROD warehouse (real-time, ~10 min lag)
    print(f"Fetching raw CSVs from s3://{PROD_WAREHOUSE_BUCKET}/{RAW_PREFIX}/...")
    try:
        raw_rows = fetch_raw_csvs(s3_client)
        all_rows.extend(raw_rows)
        print(f"  -> {len(raw_rows)} rows from raw CSVs")
    except Exception as e:
        print(f"  WARN: raw CSV fetch failed: {e}", file=sys.stderr)

    # Step 2: Athena warehouse Parquet for historical depth (~4h lag)
    print("Fetching Athena warehouse for historical depth...")
    try:
        wh_rows = fetch_athena_warehouse(athena, s3_client, script_dir)
        all_rows.extend(wh_rows)
    except Exception as e:
        print(f"  WARN: Athena warehouse failed: {e}", file=sys.stderr)

    # Step 3: datamart fallback if nothing so far
    if not all_rows:
        print("  WARN: no rows yet, falling back to datamart...", file=sys.stderr)
        try:
            fetch_athena_datamart(athena, s3_client, script_dir)
            return  # datamart writes files directly
        except Exception as e:
            print(f"  ERROR: all sources failed: {e}", file=sys.stderr)
            sys.exit(1)

    # Write combined results
    out_path = os.path.join(script_dir, "ticker_objects.csv")
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        w.writeheader()
        w.writerows(all_rows)
    idx_path = os.path.join(script_dir, "ticker_index.csv")
    with open(idx_path, "w", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=["date_utc", "time_interval_utc", "urls", "titles"]).writeheader()
    print(f"  -> saved ticker_objects.csv — {len(all_rows)} total rows (raw + Athena)")


if __name__ == "__main__":
    main()
