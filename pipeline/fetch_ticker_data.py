#!/usr/bin/env python3
"""
Fetch source data for the live news ticker.

Priority:
1) Slack channel feed (near real-time, every ~10 minutes)
2) Athena fallback (4h-refresh datamart)

Writes ticker_objects.csv and ticker_index.csv next to this script.
"""

import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

import boto3

REGION = "ca-central-1"
WORKGROUP = "ellipse-work-group"
DATABASE = "gluestackdatamartdbd046f685"
LOOKBACK_DAYS = 2
SLACK_API_BASE = "https://slack.com/api"
DATAWAREHOUSE_TABLE = "r-media-headlines"


def write_rows_csv(path, fieldnames, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def strip_slack_markup(text):
    txt = text or ""
    txt = re.sub(r"<(https?://[^>|]+)\|([^>]+)>", r"\2", txt)
    txt = re.sub(r"<(https?://[^>]+)>", r"\1", txt)
    return txt.strip()


def first_url_in_text(text):
    if not text:
        return ""
    m = re.search(r"<(https?://[^>|]+)(?:\|[^>]+)?>", text)
    if m:
        return m.group(1)
    m2 = re.search(r"https?://\S+", text)
    return m2.group(0).rstrip(")].,;!?\"") if m2 else ""


def parse_slack_headline(message):
    text = (message.get("text") or "").replace("\n", " ").strip()
    if not text:
        return None

    parts = [p.strip() for p in text.split("|")]
    media = ""
    title = ""

    if len(parts) >= 3 and re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", parts[0]):
        media = parts[1]
        title = parts[2]
    elif len(parts) >= 2:
        media = parts[0]
        title = parts[1]
    else:
        title = strip_slack_markup(text)

    # Keep only useful source-like media tokens.
    media = media.upper().strip()
    if not re.match(r"^[A-Z0-9]{2,8}$", media):
        media = ""

    title = strip_slack_markup(title)
    url = first_url_in_text(text)

    # Epoch timestamp from Slack message metadata is the most reliable.
    ts_raw = message.get("ts")
    if not ts_raw:
        return None
    try:
        ts_float = float(ts_raw)
        dt = datetime.fromtimestamp(ts_float, tz=timezone.utc)
        ts_iso = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return None

    if not title:
        return None

    return {
        "country_id": "",
        "time_interval_utc": "",
        "media_id": media,
        "url": url,
        "headline_stop_utc": ts_iso,
        "extracted_objects": "",
        "title": title,
    }


def fetch_slack_messages(token, channel_id, lookback_minutes, out_dir):
    oldest = str(time.time() - max(5, lookback_minutes) * 60)
    cursor = None
    all_msgs = []

    while True:
        params = {
            "channel": channel_id,
            "oldest": oldest,
            "inclusive": "true",
            "limit": "200",
        }
        if cursor:
            params["cursor"] = cursor

        url = f"{SLACK_API_BASE}/conversations.history?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json; charset=utf-8",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"ERROR: Slack API request failed: {e}", file=sys.stderr)
            return False

        if not payload.get("ok"):
            print(f"ERROR: Slack API returned error: {payload.get('error')}", file=sys.stderr)
            return False

        msgs = payload.get("messages", [])
        all_msgs.extend(msgs)
        cursor = payload.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    rows = []
    seen = set()
    for msg in all_msgs:
        if msg.get("subtype"):
            continue
        row = parse_slack_headline(msg)
        if not row:
            continue
        dedup_key = (row["media_id"], row["title"], row["url"])
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        rows.append(row)

    rows.sort(key=lambda r: r.get("headline_stop_utc", ""), reverse=True)

    objects_path = os.path.join(out_dir, "ticker_objects.csv")
    index_path = os.path.join(out_dir, "ticker_index.csv")
    write_rows_csv(
        objects_path,
        ["country_id", "time_interval_utc", "media_id", "url", "headline_stop_utc", "extracted_objects", "title"],
        rows,
    )
    # Keep compatibility with existing build script.
    write_rows_csv(index_path, ["date_utc", "time_interval_utc", "urls", "titles"], [])

    print(f"Fetched {len(rows)} ticker rows from Slack channel {channel_id}")
    print("  -> saved ticker_objects.csv")
    print("  -> saved ticker_index.csv (empty compatibility file)")
    return True


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

    slack_token = os.environ.get("SLACK_BOT_TOKEN", "").strip()
    slack_channel = os.environ.get("SLACK_CHANNEL_ID", "").strip()
    slack_lookback_minutes = int(os.environ.get("SLACK_LOOKBACK_MINUTES", "240"))

    if slack_token and slack_channel:
        print(f"Fetching ticker from Slack channel {slack_channel}...")
        if fetch_slack_messages(slack_token, slack_channel, slack_lookback_minutes, script_dir):
            return
        print("Slack fetch failed, falling back to Athena.", file=sys.stderr)

    athena = boto3.client("athena", region_name=REGION)
    s3 = boto3.client("s3", region_name=REGION)
    glue = boto3.client("glue", region_name=REGION)

    preferred_dwh_db = os.environ.get("DATAWAREHOUSE_DATABASE", "").strip() or None
    dwh_db = resolve_database_for_table(glue, DATAWAREHOUSE_TABLE, preferred_db=preferred_dwh_db)

    if dwh_db:
        try:
            print(f"Fetching ticker objects from datawarehouse table {dwh_db}.{DATAWAREHOUSE_TABLE}...")
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
                  AND extraction_year >= YEAR(current_date) - 1
                ORDER BY extraction_year DESC, extraction_month DESC, extraction_day DESC, extraction_time DESC
                LIMIT 4000
            """
            dwh_loc = run_query(athena, q_dwh, dwh_db)
            s3_download(s3, dwh_loc, os.path.join(script_dir, "ticker_objects.csv"))
            # Keep compatibility with build script even if we don't need title mapping.
            write_rows_csv(
                os.path.join(script_dir, "ticker_index.csv"),
                ["date_utc", "time_interval_utc", "urls", "titles"],
                [],
            )
            print("  -> saved ticker_objects.csv (datawarehouse source)")
            print("  -> saved ticker_index.csv (empty compatibility file)")
            return
        except Exception as e:
            print(f"WARNING: datawarehouse query failed ({e}); falling back to datamart.", file=sys.stderr)

    print(f"Fetching ticker objects from {start_date}...")
    q_objects = f"""
        SELECT country_id, time_interval_utc, media_id, url,
               headline_stop_utc, extracted_objects
        FROM "vitrine_datamart-salient_headlines_objects"
        WHERE substr(headline_stop_utc, 1, 10) >= '{start_date}'
    """
    objects_loc = run_query(athena, q_objects, DATABASE)
    s3_download(s3, objects_loc, os.path.join(script_dir, "ticker_objects.csv"))
    print("  -> saved ticker_objects.csv")

    print(f"Fetching ticker title map from {start_date}...")
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
