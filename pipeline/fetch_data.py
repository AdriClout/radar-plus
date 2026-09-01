#!/usr/bin/env python3
"""
Fetch Athena data for Constellation des Objets et Événements saillants.
Uses boto3 (official AWS SDK) — no session-token issues.
Writes salient_index.csv, salient_objects.csv and headline_events.csv
next to this script.

Usage: fetch_data.py [all|constellation|events]   (défaut : all)
"""

import boto3
import time
import os
import sys
from datetime import date, timedelta

REGION       = "ca-central-1"
WORKGROUP    = "ellipse-work-group"
DATABASE     = "gluestackdatamartdbd046f685"
HISTORY_DAYS = 130  # Covers all of 2026 from January 1st

# Les événements saillants (headline_events_4h) ne sont regroupés par LLM que
# depuis cette date ; avant, le regroupement statistique fragmente les
# événements — on ne mélange pas les deux régimes dans une série.
EVENTS_REGIME_START = "2026-07-23"


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


def fetch_constellation(athena, s3, script_dir, history_start):
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


def fetch_events(athena, s3, script_dir, history_start):
    # La fenêtre commence au plus tard des deux : profondeur d'historique
    # standard, ou début du régime LLM (pas de série mixte).
    events_start = max(history_start, EVENTS_REGIME_START)

    print(f"Fetching headline_events_4h from {events_start}...")
    # NB : la table publie le top 3 par région par bloc (TARGET_MIN_EVENTS = 3
    # côté raffineur). `outlets_roc` n'existe pas dans la table : le compte de
    # médias par région se calcule côté build depuis media_ids_qc/roc.
    q3 = f"""
        SELECT date_utc, time_interval_utc, event_id, storyline_id,
               event_label, title, event_title_raw, text,
               main_issue, main_issue_text_fr, main_issue_text_en,
               target_region, country_id, event_rank_in_region,
               salience_index_qc, salience_index_roc,
               media_ids_qc, media_ids_roc,
               representative_url, representative_media_id,
               first_seen_utc, interval_convergence_score, articles
        FROM "vitrine_datamart-headline_events_4h"
        WHERE CAST(date_utc AS VARCHAR) >= '{events_start}'
          AND target_region IN ('QC', 'ROC')
    """
    loc3 = run_query(athena, q3)
    s3_download(s3, loc3, os.path.join(script_dir, "headline_events.csv"))
    print("  -> saved headline_events.csv")


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what not in ("all", "constellation", "events"):
        print(f"ERROR: unknown target '{what}' (all|constellation|events)", file=sys.stderr)
        sys.exit(2)

    script_dir    = os.path.dirname(os.path.abspath(__file__))
    history_start = (date.today() - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%d")

    athena = boto3.client("athena", region_name=REGION)
    s3     = boto3.client("s3",     region_name=REGION)

    if what in ("all", "constellation"):
        fetch_constellation(athena, s3, script_dir, history_start)
    if what in ("all", "events"):
        fetch_events(athena, s3, script_dir, history_start)


if __name__ == "__main__":
    main()
