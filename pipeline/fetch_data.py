#!/usr/bin/env python3
"""
Fetch Athena data for Constellation des Objets et pour les événements saillants.
Uses boto3 (official AWS SDK) — no session-token issues.
Writes salient_index.csv, salient_objects.csv and headline_events.csv next to this script.

Usage: fetch_data.py [all|constellation|events|archive]   (défaut : all)

`archive` lit en DEV l'année publiée de l'article 2 (pipeline/archive_these.json) ;
`events` lit alors en PROD seulement les journées qui suivent sa fin.

L'environnement AWS est celui des clés fournies. Le refresh (refresh-constellation.yml)
lit `constellation` et `events` en PROD, la base de la Vitrine (#53 ; objets en PROD
depuis le 21 nov. 2026, les raffineurs ne tournant plus en DEV), et `archive` en DEV ;
en local, choisir le profil : AWS_PROFILE=ellipse-prod python3 pipeline/fetch_data.py events
"""

import boto3
import json
import time
import os
import sys
from datetime import date, timedelta

REGION       = "ca-central-1"
WORKGROUP    = "ellipse-athena-workgroup"
DATABASE     = "gluestackdatamartdbd046f685"
HISTORY_DAYS = 130  # Covers all of 2026 from January 1st

# Les événements saillants (headline_events_4h) ne sont regroupés par LLM que
# depuis cette date ; avant, le regroupement statistique fragmente les
# événements — on ne mélange pas les deux régimes dans une série (#49).
EVENTS_REGIME_START = "2026-07-23"


def run_query(athena, sql, optional=False):
    """Lance la requête et rend l'emplacement du résultat. `optional` : None au lieu
    de quitter si la requête échoue (table ou colonnes absentes)."""
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
            if optional:
                print(f"WARNING: requête facultative {state} : {reason}", file=sys.stderr)
                return None
            print(f"ERROR: Query {state}: {reason}", file=sys.stderr)
            sys.exit(1)
        time.sleep(2)
    print("ERROR: Query timed out", file=sys.stderr)
    sys.exit(1)


def s3_download(s3, s3_uri, local_path):
    bucket, key = s3_uri.replace("s3://", "").split("/", 1)
    s3.download_file(bucket, key, local_path)


CARD_COLS = """date_utc, time_interval_utc, event_id, storyline_id,
               event_label, title, event_title_raw, text,
               main_issue, main_issue_text_fr, main_issue_text_en,
               target_region, country_id, event_rank_in_region,
               salience_index_qc, salience_index_roc,
               media_ids_qc, media_ids_roc,
               representative_url, representative_media_id,
               first_seen_utc, interval_convergence_score, articles"""
# Relevé complet (headline_storylines) : tous les événements de chaque édition, pas
# seulement le podium. Il porte les points des périodes (Classement, Évolution),
# comme dans l'article 2 ; le podium (cartes) reste la source de l'affichage.
STORY_COLS = """date_utc, time_interval_utc, storyline_id, event_id, event_label,
               event_title_raw, primary_region, salience_index_qc, salience_index_roc,
               media_ids, first_seen_utc"""


def load_archive(script_dir):
    """Année publiée (pipeline/archive_these.json) : tables suffixées de DEV, ou None."""
    path = os.path.join(script_dir, "archive_these.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        cfg = json.load(f)
    # Seules les fenêtres prêtes (calcul fini et vérifié), contiguës depuis le début.
    ready = []
    for w in cfg["fenetres"]:
        if not w.get("pret", True):
            break
        ready.append(w)
    if not ready:
        return None
    cfg["fenetres"] = ready
    cfg["fin"] = ready[-1]["fin"]
    return cfg


def union_these(table, cols, archive, extra_where=""):
    """Une requête : chaque fenêtre de calcul ne fournit que ses journées de Montréal."""
    parts = []
    for w in archive["fenetres"]:
        parts.append(f"""SELECT {cols}, CAST(date_montreal_tz AS VARCHAR) AS date_montreal
            FROM "vitrine_datamart-{table}{w['suffixe']}"
            WHERE CAST(date_montreal_tz AS VARCHAR) BETWEEN '{w['debut']}' AND '{w['fin']}' {extra_where}""")
    return "\nUNION ALL\n".join(parts)


def fetch_archive(athena, s3, script_dir):
    """Année publiée (AWS DEV) : cartes et relevé complet des tables `_these*`."""
    archive = load_archive(script_dir)
    if archive is None:
        print("Pas d'archive_these.json : rien à lire.")
        return
    print(f"Fetching année publiée ({archive['debut']} → {archive['fin']}, {len(archive['fenetres'])} fenêtres)...")
    loc = run_query(athena, union_these("headline_events_4h", CARD_COLS, archive,
                                        "AND target_region IN ('QC', 'ROC')"))
    s3_download(s3, loc, os.path.join(script_dir, "archive_events.csv"))
    print("  -> saved archive_events.csv")
    loc = run_query(athena, union_these("headline_storylines", STORY_COLS, archive))
    s3_download(s3, loc, os.path.join(script_dir, "archive_storylines.csv"))
    print("  -> saved archive_storylines.csv")
    # Couche des sagas calculée pour la thèse (table DEV écrite le 8 nov. 2026) :
    # appartenance d'un événement (storyline_id) à une saga, avec son nom et son
    # type. Facultative : sans elle, build_sagas.py ne publie rien.
    out_s = os.path.join(script_dir, "sagas_these.csv")
    loc = run_query(athena, """SELECT storyline_id, saga_id, titre_saga, nom_affaire, type_affaire, saga_douteuse
        FROM "vitrine_datamart-headline_sagas_these" WHERE saga_id IS NOT NULL AND saga_id <> ''""", optional=True)
    if loc:
        s3_download(s3, loc, out_s)
        print("  -> saved sagas_these.csv")
    elif os.path.exists(out_s):
        os.remove(out_s)


def fetch_events(athena, s3, script_dir, history_start):
    """Événements saillants : table headline_events_4h (top 3 par région par bloc,
    TARGET_MIN_EVENTS = 3 côté raffineur) et relevé complet headline_storylines.
    `articles` est un JSON dont on ne garde côté build que titre / URL / média /
    minutes (jamais body_preview). Avec une année publiée (archive_these.json),
    la production ne fournit que les journées de Montréal qui suivent sa fin."""
    archive = load_archive(script_dir)
    if archive:
        where = f"CAST(date_montreal_tz AS VARCHAR) > '{archive['fin']}'"
        print(f"Fetching headline_events_4h et headline_storylines après {archive['fin']}...")
    else:
        events_start = max(history_start, EVENTS_REGIME_START)
        where = f"CAST(date_utc AS VARCHAR) >= '{events_start}'"
        print(f"Fetching headline_events_4h from {events_start}...")
    q3 = f"""
        SELECT {CARD_COLS}, CAST(date_montreal_tz AS VARCHAR) AS date_montreal
        FROM "vitrine_datamart-headline_events_4h"
        WHERE {where}
          AND target_region IN ('QC', 'ROC')
    """
    loc3 = run_query(athena, q3)
    s3_download(s3, loc3, os.path.join(script_dir, "headline_events.csv"))
    print("  -> saved headline_events.csv")
    if archive:
        q4 = f"""
            SELECT {STORY_COLS}, CAST(date_montreal_tz AS VARCHAR) AS date_montreal
            FROM "vitrine_datamart-headline_storylines"
            WHERE {where}
        """
        # Facultatif : dans les tables canoniques, les colonnes de l'indice régional du
        # relevé complet (#610) ne sont pas encore au catalogue Glue (constat du
        # 15 nov. 2026). Sans elles, les points des journées en direct se comptent
        # sur le podium (build_events.R).
        out4 = os.path.join(script_dir, "storylines.csv")
        loc4 = run_query(athena, q4, optional=True)
        if loc4:
            s3_download(s3, loc4, out4)
            print("  -> saved storylines.csv")
        elif os.path.exists(out4):
            os.remove(out4)


def main():
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what not in ("all", "constellation", "events", "archive"):
        print(f"ERROR: unknown target '{what}' (all|constellation|events|archive)", file=sys.stderr)
        sys.exit(2)

    script_dir    = os.path.dirname(os.path.abspath(__file__))
    history_start = (date.today() - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%d")

    athena = boto3.client("athena", region_name=REGION)
    s3     = boto3.client("s3",     region_name=REGION)

    if what == "archive":
        fetch_archive(athena, s3, script_dir)
        return
    if what in ("all", "events"):
        fetch_events(athena, s3, script_dir, history_start)
    if what == "events":
        return

    print(f"Fetching salient_index from {history_start}...")
    q1 = f"""
        SELECT country_id, date_utc, time_interval_utc, extracted_objects,
               absolute_normalized_index, salience_index, s_volume, s_visibilite, s_duree,
               n_medias, n_articles, n, urls, titles
        FROM "vitrine_datamart-salient_index"
        WHERE date_utc >= DATE '{history_start}'
    """
    loc1 = run_query(athena, q1)
    s3_download(s3, loc1, os.path.join(script_dir, "salient_index.csv"))
    print("  -> saved salient_index.csv")

    print(f"Fetching salient_headlines_objects from {history_start}...")
    q2 = f"""
        SELECT country_id, time_interval_utc, media_id, url,
               headline_stop_utc, headline_minutes, extracted_objects
        FROM "vitrine_datamart-salient_headlines_objects"
        WHERE substr(headline_stop_utc, 1, 10) >= '{history_start}'
    """
    loc2 = run_query(athena, q2)
    s3_download(s3, loc2, os.path.join(script_dir, "salient_objects.csv"))
    print("  -> saved salient_objects.csv")


if __name__ == "__main__":
    main()
