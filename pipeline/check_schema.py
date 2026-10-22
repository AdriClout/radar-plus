#!/usr/bin/env python3
"""Contrôle de schéma des JSON publiés dans site/.

Leçon Vitrine : « une dérive de schéma ne casse aucun test, elle casse la
production en silence pendant des semaines ». Ce script vérifie la forme des
JSON générés AVANT commit (workflows de refresh) et sur chaque PR
(quality-gate). Il valide la structure, pas les valeurs scientifiques.

Usage : python3 pipeline/check_schema.py [fichier ...]
        (sans argument : tous les JSON connus présents dans site/)
Sort avec un code non nul et des lignes ::error au premier problème.
"""

import json
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
PERIOD_KEY = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$")
ISO_TS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
ERRORS = []


def err(fichier, msg):
    ERRORS.append(f"{fichier}: {msg}")
    print(f"::error file=site/{fichier}::{msg}")


def need(d, key, types, fichier, ctx):
    if not isinstance(d, dict) or key not in d:
        err(fichier, f"clé absente : {ctx}.{key}")
        return None
    v = d[key]
    if not isinstance(v, types):
        err(fichier, f"type inattendu pour {ctx}.{key} : {type(v).__name__}")
        return None
    return v


def check_generated_at(meta, fichier):
    ts = need(meta, "generated_at", str, fichier, "meta")
    if ts and not ISO_TS.match(ts):
        err(fichier, f"meta.generated_at mal formé : {ts!r}")


def check_period_keys(keys, fichier, ctx):
    for k in list(keys)[:5000]:
        if not PERIOD_KEY.match(k):
            err(fichier, f"clé de période mal formée dans {ctx} : {k!r}")
            return


def check_graphlike(d, fichier, node_required):
    meta = need(d, "meta", dict, fichier, "racine")
    if meta:
        check_generated_at(meta, fichier)
        periods = need(meta, "periods", list, fichier, "meta")
        if periods is not None:
            if not periods:
                err(fichier, "meta.periods est vide")
            else:
                check_period_keys((p.get("key", "") for p in periods), fichier, "meta.periods")
    graphs = need(d, "graphs", dict, fichier, "racine")
    if not graphs:
        return
    for country, per in graphs.items():
        if not isinstance(per, dict) or not per:
            err(fichier, f"graphs.{country} vide ou invalide")
            continue
        check_period_keys(per.keys(), fichier, f"graphs.{country}")
        k, pd = next(iter(per.items()))
        nodes = pd.get("nodes")
        if not isinstance(nodes, list):
            err(fichier, f"graphs.{country}.{k}.nodes absent")
            continue
        for n in nodes[:3]:
            for field in node_required:
                if field not in n:
                    err(fichier, f"nœud sans champ {field!r} dans graphs.{country}.{k}")
                    break


def check_events(d, fichier):
    meta = need(d, "meta", dict, fichier, "racine")
    if meta:
        check_generated_at(meta, fichier)
        for key in ("periods", "bands"):
            v = need(meta, key, list, fichier, "meta")
            if v is not None and not v:
                err(fichier, f"meta.{key} est vide")
        for key in ("thresholds", "panel"):
            need(meta, key, dict, fichier, "meta")
        if isinstance(meta.get("periods"), list):
            check_period_keys((p.get("key", "") for p in meta["periods"]), fichier, "meta.periods")
    top = meta.get("top_per_region_block", 3) if isinstance(meta, dict) else 3
    blocks = need(d, "blocks", dict, fichier, "racine")
    if blocks:
        for region in ("QC", "ROC"):
            if region not in blocks:
                err(fichier, f"blocks.{region} absent")
                continue
            check_period_keys(blocks[region].keys(), fichier, f"blocks.{region}")
            for k, evs in blocks[region].items():
                if len(evs) > top:
                    err(fichier, f"blocks.{region}.{k} : {len(evs)} événements (> top {top})")
                    break
                ids = [e.get("id") for e in evs]
                if len(ids) != len(set(ids)):
                    err(fichier, f"blocks.{region}.{k} : event_id dupliqué")
                    break
                for e in evs:
                    if not e.get("storyline") or not e.get("title") or not isinstance(e.get("index"), (int, float)):
                        err(fichier, f"blocks.{region}.{k} : événement sans storyline/title/index")
                        break
    stories = need(d, "storylines", dict, fichier, "racine")
    if stories:
        for region in ("QC", "ROC"):
            if region not in stories or not stories[region]:
                err(fichier, f"storylines.{region} absent ou vide")


def check_ticker(d, fichier):
    meta = need(d, "meta", dict, fichier, "racine")
    if meta:
        check_generated_at(meta, fichier)
    items = need(d, "items", list, fichier, "racine")
    if items is not None:
        if not items:
            err(fichier, "items est vide")
        for it in items[:5]:
            for field in ("ts_utc", "media_id", "title", "url"):
                if not it.get(field):
                    err(fichier, f"item du ticker sans champ {field!r}")
                    break


def check_articles(d, fichier):
    meta = need(d, "meta", dict, fichier, "racine")
    if meta:
        check_generated_at(meta, fichier)
    arts = need(d, "articles", dict, fichier, "racine")
    if arts is not None and not arts:
        err(fichier, "articles est vide")


def check_classement(d, fichier):
    meta = need(d, "meta", dict, fichier, "racine")
    if meta:
        check_generated_at(meta, fichier)
        periods = need(meta, "periods", list, fichier, "meta")
        if periods is not None:
            if not periods:
                err(fichier, "meta.periods est vide")
            else:
                check_period_keys((p.get("key", "") for p in periods), fichier, "meta.periods")
        for key in ("salience_tiers", "slots"):
            need(meta, key, dict, fichier, "meta")
        countries = need(meta, "countries", list, fichier, "meta") or []
    else:
        countries = []
    if not isinstance(need(d, "alert_bar", list, fichier, "racine"), list):
        pass  # erreur déjà signalée
    top = need(d, "top", dict, fichier, "racine")
    if top:
        for gran in ("4h", "day", "week", "month", "quarter", "total"):
            if gran not in top:
                err(fichier, f"top.{gran} absent")
                continue
            for country in countries:
                slots_c = top[gran].get(country)
                if not isinstance(slots_c, dict) or not slots_c:
                    err(fichier, f"top.{gran}.{country} vide ou invalide")
                    continue
                k, entries = next(iter(slots_c.items()))
                if not isinstance(entries, list):
                    err(fichier, f"top.{gran}.{country}.{k} n'est pas une liste")
                    continue
                for e in entries[:3]:
                    for field in ("id", "size", "rank"):
                        if field not in e:
                            err(fichier, f"entrée sans champ {field!r} dans top.{gran}.{country}.{k}")
                            break
        if "4h" in top:
            for country in countries:
                check_period_keys((top["4h"].get(country) or {}).keys(), fichier, f"top.4h.{country}")
    alltime = need(d, "alltime", dict, fichier, "racine")
    if alltime is not None:
        for country in countries:
            if not alltime.get(country):
                err(fichier, f"alltime.{country} absent ou vide")
    need(d, "alerts_latest", dict, fichier, "racine")


def check_monitor(d, fichier):
    need(d, "meta", dict, fichier, "racine")
    bc = need(d, "by_country", dict, fichier, "racine")
    if bc is not None and not bc:
        err(fichier, "by_country est vide")


CHECKS = {
    "graph.json": lambda d, f: check_graphlike(d, f, ("id", "size")),
    "timeseries.json": lambda d, f: check_graphlike(d, f, ("id", "size")),
    "events.json": check_events,
    "ticker.json": check_ticker,
    "articles.json": check_articles,
    "monitor_input.json": check_monitor,
    "classement.json": check_classement,
}


def main(argv):
    cibles = [Path(a) for a in argv] if argv else [SITE / n for n in CHECKS]
    verifies = 0
    for path in cibles:
        nom = path.name
        if nom not in CHECKS:
            print(f"(ignoré : {nom} — pas de schéma connu)")
            continue
        if not path.exists():
            err(nom, "fichier absent")
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            err(nom, f"JSON invalide : {e}")
            continue
        CHECKS[nom](data, nom)
        verifies += 1
        print(f"✓ {nom}")
    if ERRORS:
        print(f"\n{len(ERRORS)} problème(s) de schéma — publication refusée.")
        return 1
    print(f"\nSchémas conformes ({verifies} fichier(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
