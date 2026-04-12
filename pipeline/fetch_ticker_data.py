#!/usr/bin/env python3
"""
Fetch source data for the live news ticker.

Primary: reads raw CSV files directly from S3 (written every ~10 min by the
scraper Lambdas).  This gives true real-time freshness without waiting for the
4-hour Glue ETL that populates the Parquet/Athena layer.

Fallback: Athena query on the datawarehouse or datamart tables.

Writes ticker_objects.csv and ticker_index.csv next to this script.
"""

import csv
import io
import os
import re
import sys
import time
from datetime import date, datetime, timedelta, timezone

import boto3

REGION = "ca-central-1"
WORKGROUP = "ellipse-work-group"
DATABASE = "gluestackdatamartdbd046f685"
DATAWAREHOUSE_TABLE = "r-media-headlines"

# How far back to look for raw CSVs (hours).
LOOKBACK_HOURS = 12

# Known media IDs (partition folders in S3).
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
# Helpers
# ---------------------------------------------------------------------------

def write_rows_csv(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def first_nonempty(row, keys):
    """Return the first non-empty string value among the provided keys."""
    for k in keys:
        v = row.get(k)
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s
    return ""


def normalize_row_keys(row):
    """Normalize CSV row keys for resilient access (trim + lowercase)."""
    out = {}
    for k, v in row.items():
        if k is None:
            continue
        nk = str(k).strip().lower()
        out[nk] = v
    return out


def detect_csv_dialect(text):
    """Detect delimiter/quoting for raw CSV exports.

    Some upstream exports are semicolon- or tab-delimited, which would make
    DictReader treat each row as a single column if we force comma.
    """
    sample = text[:4096]
    try:
        return csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except Exception:
        class Fallback(csv.Dialect):
            delimiter = ","
            quotechar = '"'
            doublequote = True
            skipinitialspace = False
            lineterminator = "\n"
            quoting = csv.QUOTE_MINIMAL

        return Fallback


def first_url_in_row(row):
    """Find first URL-like value in a row if known URL columns are empty."""
    for v in row.values():
        if v is None:
            continue
        s = str(v).strip()
        if s.startswith("http://") or s.startswith("https://"):
            return s
    return ""


def infer_media_from_key(key):
    """Infer media id from object key path r-media-headlines/{MEDIA}/unprocessed/..."""
    m = re.search(r"r-media-headlines/([^/]+)/unprocessed/", key)
    if m:
        return m.group(1).strip().upper()
    return ""


def normalize_ts_utc(ts):
    """Normalize timestamp-like text to YYYY-MM-DD HH:MM:SS (UTC-ish)."""
    if not ts:
        return ""
    x = str(ts).strip()
    if not x:
        return ""

    # Common shapes: 2026-04-12T00:28:19Z / 2026-04-12 00:28:19 / with millis
    try:
        y = x.replace("Z", "+00:00") if x.endswith("Z") else x
        dt = datetime.fromisoformat(y)
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(x, fmt)
            if fmt == "%Y-%m-%d":
                dt = dt.replace(hour=0, minute=0, second=0)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            continue

    # Last resort: trim fractional seconds if any.
    if "." in x:
        base = x.split(".", 1)[0].replace("T", " ")
        try:
            dt = datetime.strptime(base, "%Y-%m-%d %H:%M:%S")
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass

    return ""


def discover_dwh_bucket(glue):
    """Get the S3 bucket that backs the r-media-headlines Glue table."""
    paginator = glue.get_paginator("get_databases")
    db_names = []
    for page in paginator.paginate():
        for db in page.get("DatabaseList", []):
            n = db.get("Name", "")
            if n:
                db_names.append(n)

    # Try datawarehouse DBs first.
    db_names.sort(key=lambda n: (0 if "datawarehouse" in n else 1, n))

    for db_name in db_names:
        try:
            tbl = glue.get_table(DatabaseName=db_name, Name=DATAWAREHOUSE_TABLE)
            location = tbl["Table"]["StorageDescriptor"]["Location"]
            # location looks like s3://bucket-name/prefix/
            parts = location.replace("s3://", "").split("/", 1)
            bucket = parts[0]
            print(f"Discovered bucket '{bucket}' from Glue table {db_name}.{DATAWAREHOUSE_TABLE}")
            return bucket, db_name
        except Exception:
            continue
    return None, None


def fetch_raw_csvs(s3_client, bucket, cutoff_dt):
    """List and download raw CSV files from S3, return merged rows.

    We do not trust S3 object LastModified for freshness because upstream
    ingestion can preserve object timestamps while still containing fresh
    extraction rows. Freshness is enforced later from row timestamps.
    """
    rows = []
    seen_keys = set()

    for media_id in MEDIA_IDS:
        prefix = f"r-media-headlines/{media_id}/unprocessed/"
        media_total = 0
        media_recent = 0
        try:
            paginator = s3_client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    last_mod = obj.get("LastModified")
                    media_total += 1
                    if not key.endswith(".csv"):
                        continue
                    media_recent += 1
                    if key in seen_keys:
                        continue
                    seen_keys.add(key)

                    try:
                        resp = s3_client.get_object(Bucket=bucket, Key=key)
                        body = resp["Body"].read().decode("utf-8", errors="replace")
                        dialect = detect_csv_dialect(body)
                        reader = csv.DictReader(io.StringIO(body), dialect=dialect)
                        key_media = infer_media_from_key(key)
                        for r in reader:
                            nr = normalize_row_keys(r)

                            title = first_nonempty(nr, [
                                "title", "headline", "headlines", "article_title", "message", "text",
                            ])
                            url = first_nonempty(nr, [
                                "metadata_url", "url", "article_url", "link", "permalink",
                            ])
                            if not url:
                                url = first_url_in_row(nr)

                            mid = first_nonempty(nr, ["media_id", "media", "source", "publisher"]).upper() or key_media or media_id
                            if not title or not url:
                                continue

                            # Build headline_stop_utc from known timestamp fields first.
                            ts = normalize_ts_utc(first_nonempty(nr, [
                                "headline_stop_utc", "published_at", "published_utc", "created_at",
                                "timestamp", "datetime", "extraction_datetime", "extraction_ts",
                            ]))

                            # Then try partition-style date fields.
                            ey = nr.get("extraction_year", "")
                            em = nr.get("extraction_month", "")
                            ed = nr.get("extraction_day", "")
                            et = nr.get("extraction_time", "00:00:00")
                            if not ts and ey and em and ed:
                                try:
                                    ts = f"{int(ey):04d}-{int(em):02d}-{int(ed):02d} {(et or '00:00:00').strip()}"
                                except Exception:
                                    ts = ""

                            # Fallback: use extraction_date/date if available.
                            if not ts:
                                ed_full = first_nonempty(nr, ["extraction_date", "date", "day"])
                                if ed_full:
                                    ts = normalize_ts_utc(f"{ed_full} {et or '00:00:00'}")

                            # Absolute fallback to object modification timestamp.
                            if not ts and last_mod is not None:
                                try:
                                    ts = last_mod.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                                except Exception:
                                    ts = ""

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
            if media_total > 0:
                print(f"  {media_id}: {media_total} total objects, {media_recent} recent CSVs")
            else:
                print(f"  {media_id}: no objects found at {prefix}")
        except Exception as e:
            print(f"  WARN: could not list {prefix}: {e}", file=sys.stderr)

    # Deduplicate by (media_id, url).
    unique = {}
    for row in rows:
        k = (row["media_id"], row["url"])
        if k not in unique or row["headline_stop_utc"] > unique[k]["headline_stop_utc"]:
            unique[k] = row

    result = sorted(unique.values(), key=lambda r: r["headline_stop_utc"], reverse=True)
    return result


# ---------------------------------------------------------------------------
# Athena helpers (fallback)
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
            print(f"ERROR: Query {state}: {reason}", file=sys.stderr)
            sys.exit(1)
        time.sleep(2)
    print("ERROR: Query timed out", file=sys.stderr)
    sys.exit(1)


def s3_download(s3_client, s3_uri, local_path):
    bucket, key = s3_uri.replace("s3://", "").split("/", 1)
    s3_client.download_file(bucket, key, local_path)


def athena_fallback(athena, s3_client, glue, dwh_db, script_dir):
    """Fallback: query Athena Parquet tables (up to 4h stale)."""
    start_date = (date.today() - timedelta(days=2)).strftime("%Y-%m-%d")

    if dwh_db:
        try:
            print(f"[fallback] Querying Athena table {dwh_db}.{DATAWAREHOUSE_TABLE}...")
            today = date.today()
            yesterday = today - timedelta(days=1)
            # Cast partition columns to VARCHAR for safe comparison (handles int or string partitions).
            q = f"""
                SELECT '' AS country_id, '' AS time_interval_utc,
                       media_id, metadata_url AS url,
                       CONCAT(CAST(extraction_year AS VARCHAR),'-',
                              LPAD(CAST(extraction_month AS VARCHAR),2,'0'),'-',
                              LPAD(CAST(extraction_day AS VARCHAR),2,'0'),' ',
                              COALESCE(extraction_time,'00:00:00')) AS headline_stop_utc,
                       '' AS extracted_objects, title
                FROM "{DATAWAREHOUSE_TABLE}"
                WHERE media_id IS NOT NULL AND title IS NOT NULL AND title<>''
                  AND metadata_url IS NOT NULL AND metadata_url<>''
                  AND CAST(extraction_year AS VARCHAR) = '{today.year}'
                  AND (
                    (CAST(extraction_month AS INTEGER) = {today.month} AND CAST(extraction_day AS INTEGER) = {today.day})
                    OR
                    (CAST(extraction_month AS INTEGER) = {yesterday.month} AND CAST(extraction_day AS INTEGER) = {yesterday.day})
                  )
                ORDER BY extraction_year DESC, extraction_month DESC, extraction_day DESC, extraction_time DESC
                LIMIT 500
            """
            loc = run_query(athena, q, dwh_db)
            out_path = os.path.join(script_dir, "ticker_objects.csv")
            s3_download(s3_client, loc, out_path)
            with open(out_path, "r") as f:
                row_count = sum(1 for _ in f) - 1
            print(f"  -> saved ticker_objects.csv (Athena DWH fallback) — {row_count} rows")
            if row_count > 0:
                write_rows_csv(os.path.join(script_dir, "ticker_index.csv"),
                               ["date_utc", "time_interval_utc", "urls", "titles"], [])
                return True
            print("  DWH returned 0 rows, trying datamart...")
        except Exception as e:
            print(f"  WARN: Athena DWH query failed: {e}", file=sys.stderr)

    # Last resort: datamart (has salient objects with titles from the 4h ETL).
    try:
        print(f"[fallback] Querying datamart from {start_date}...")
        q = f"""
            SELECT country_id, time_interval_utc, media_id, url,
                   headline_stop_utc, extracted_objects
            FROM "vitrine_datamart-salient_headlines_objects"
            WHERE substr(headline_stop_utc,1,10) >= '{start_date}'
        """
        loc = run_query(athena, q, DATABASE)
        out_path = os.path.join(script_dir, "ticker_objects.csv")
        s3_download(s3_client, loc, out_path)
        with open(out_path, "r") as f:
            row_count = sum(1 for _ in f) - 1
        print(f"  -> saved ticker_objects.csv (datamart fallback) — {row_count} rows")
        q2 = f"""
            SELECT date_utc, time_interval_utc, urls, titles
            FROM "vitrine_datamart-salient_index"
            WHERE date_utc >= DATE '{start_date}'
        """
        loc2 = run_query(athena, q2, DATABASE)
        s3_download(s3_client, loc2, os.path.join(script_dir, "ticker_index.csv"))
        with open(os.path.join(script_dir, "ticker_index.csv"), "r") as f:
            idx_count = sum(1 for _ in f) - 1
        print(f"  -> saved ticker_index.csv (datamart fallback) — {idx_count} rows")
        return True
    except Exception as e:
        print(f"  ERROR: datamart fallback failed: {e}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    s3_client = boto3.client("s3", region_name=REGION)
    glue = boto3.client("glue", region_name=REGION)

    # Discover bucket name from Glue catalog.
    bucket, dwh_db = discover_dwh_bucket(glue)

    if bucket:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
        print(f"Fetching raw CSVs from s3://{bucket}/r-media-headlines/*/unprocessed/ (since {cutoff.isoformat()})...")
        rows = fetch_raw_csvs(s3_client, bucket, cutoff)
        print(f"  -> found {len(rows)} unique headlines from raw CSVs")

        if rows:
            write_rows_csv(os.path.join(script_dir, "ticker_objects.csv"), OUT_FIELDS, rows)
            write_rows_csv(os.path.join(script_dir, "ticker_index.csv"),
                           ["date_utc", "time_interval_utc", "urls", "titles"], [])
            print("  -> saved ticker_objects.csv (real-time S3 source)")
            print("  -> saved ticker_index.csv (empty compatibility file)")
            return

        print("  No rows from raw CSVs; falling back to Athena.", file=sys.stderr)

    # Fallback to Athena.
    athena = boto3.client("athena", region_name=REGION)
    athena_fallback(athena, s3_client, glue, dwh_db, script_dir)


if __name__ == "__main__":
    main()
