#!/usr/bin/env python3
"""Génère site/classement.json — l'index léger du Classement d'accueil.

Constat de l'audit (2026-08-30) : l'accueil chargeait ~58 Mo de JSON parce
que le navigateur refaisait à chaque visite les agrégations par granularité
sur 130 jours. Ce script les précalcule au refresh, avec EXACTEMENT les
sémantiques du frontend (index.html) :

- créneaux : 4h (une période = un créneau), jour (date UTC de la clé),
  semaine ISO, mois, année, total ;
- score d'un objet dans un créneau = somme de `size` sur ses blocs 4 h ;
- rang = tri décroissant stable ; tendance = rang du créneau précédent
  (classement COMPLET, pas tronqué) ; « retour » = absent du créneau
  précédent mais présent dans l'un des 9 créneaux d'avant ; « série » =
  nombre de créneaux consécutifs de présence (toutes positions) ;
- score cumulé « depuis le début » = somme de `size` sur toutes les
  périodes ; alertes du moment = dernière période de graph.json
  (niveau du pipeline, sinon dérivé des paliers de saillance).

Entrées  : site/timeseries.json, site/graph.json, site/articles.json.
Sortie   : site/classement.json (réécrit par refresh-constellation.yml —
           jamais édité à la main, hard rule #1).
"""

import json
from datetime import date
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"
TOP_4H = 30      # même profondeur que timeseries (top_n=30) — la recherche
                 # « Est-ce que X est dans le radar ? » balaie ces listes
TOP_AGG = 30     # profondeur stockée pour jour/semaine/mois/année/total
COMEBACK_LOOKBACK = 9   # créneaux idx-2 … idx-10 inclus, comme le frontend


def week_key(d):
    y, w, _ = date.fromisoformat(d).isocalendar()
    return f"{y}-W{w:02d}"


BUCKETERS = {
    "day": lambda d: d,
    "week": week_key,
    "month": lambda d: d[:7],
    "quarter": lambda d: d[:4],
    "total": lambda d: "all",
}


def aggregate(country_graphs, period_keys):
    """Somme des tailles par objet, ordre d'insertion = premier bloc vu
    (réplique aggregateNodes : tri décroissant stable). Retourne aussi le
    nombre de mentions `n` (utile aux fiches de recherche, blocs 4 h)."""
    sums, mentions = {}, {}
    for pk in period_keys:
        pd = country_graphs.get(pk)
        if not pd:
            continue
        for n in pd.get("nodes", ()):
            sums[n["id"]] = sums.get(n["id"], 0.0) + (n.get("size") or 0)
            mentions[n["id"]] = mentions.get(n["id"], 0) + (n.get("n") or 0)
    return [(i, v, mentions.get(i, 0)) for i, v in sorted(sums.items(), key=lambda kv: -kv[1])]


def slot_articles(articles_country, period_keys, node_id):
    """Articles dédupliqués par URL sur le créneau (comme le frontend)."""
    seen, medias = set(), set()
    for pk in period_keys:
        for a in (articles_country.get(pk, {}).get(node_id) or ()):
            url = a.get("url")
            if url and url not in seen:
                seen.add(url)
                if a.get("media_id"):
                    medias.add(a["media_id"])
    return len(seen), sorted(medias)


def derive_alert_level(tiers, size):
    if not isinstance(size, (int, float)) or not tiers:
        return None
    if isinstance(tiers.get("extreme"), (int, float)) and size >= tiers["extreme"]:
        return "extreme"
    if isinstance(tiers.get("very_high"), (int, float)) and size >= tiers["very_high"]:
        return "tres_eleve"
    if isinstance(tiers.get("high"), (int, float)) and size >= tiers["high"]:
        return "eleve"
    return None


def main():
    ts = json.loads((SITE / "timeseries.json").read_text(encoding="utf-8"))
    graph = json.loads((SITE / "graph.json").read_text(encoding="utf-8"))
    articles = json.loads((SITE / "articles.json").read_text(encoding="utf-8"))
    arts_by_country = articles.get("articles", {})

    periods = sorted(ts["meta"]["periods"], key=lambda p: p["key"])
    period_keys = [p["key"] for p in periods]
    countries = sorted(ts["graphs"].keys())

    # Créneaux par granularité (identiques pour tous les pays)
    slots = {"4h": [{"key": p["key"], "periodKeys": [p["key"]], "label": p.get("label")} for p in periods]}
    for gran, bucket in BUCKETERS.items():
        order, buckets = [], {}
        for pk in period_keys:
            bk = bucket(pk.split("_")[0])
            if bk not in buckets:
                buckets[bk] = []
                order.append(bk)
            buckets[bk].append(pk)
        slots[gran] = [{"key": bk, "periodKeys": buckets[bk]} for bk in order]

    top = {g: {c: {} for c in countries} for g in slots}
    alltime = {}
    for country in countries:
        cg = ts["graphs"][country]
        ac = arts_by_country.get(country, {})

        sums = {}
        for pk in period_keys:
            for n in cg.get(pk, {}).get("nodes", ()):
                sums[n["id"]] = sums.get(n["id"], 0.0) + (n.get("size") or 0)
        alltime[country] = [[i, round(v, 1)] for i, v in sorted(sums.items(), key=lambda kv: -kv[1])]

        for gran, slot_list in slots.items():
            cap = TOP_4H if gran == "4h" else TOP_AGG
            rankings = [aggregate(cg, s["periodKeys"]) for s in slot_list]
            rank_maps = [{i: r + 1 for r, (i, _, _) in enumerate(rk)} for rk in rankings]
            presence = [set(m) for m in rank_maps]

            for idx, ranking in enumerate(rankings):
                entries = []
                for rank0, (node_id, total, n_mentions) in enumerate(ranking[:cap]):
                    e = {"id": node_id, "size": round(total, 3), "rank": rank0 + 1}
                    if gran == "4h" and n_mentions:
                        e["n"] = n_mentions
                    if idx > 0:
                        prev = rank_maps[idx - 1].get(node_id)
                        if prev is not None:
                            e["prev_rank"] = prev
                        else:
                            lo = max(0, idx - 2 - (COMEBACK_LOOKBACK - 1))
                            if any(node_id in presence[j] for j in range(lo, idx - 1)):
                                e["comeback"] = True
                    streak = 0
                    for j in range(idx, -1, -1):
                        if node_id in presence[j]:
                            streak += 1
                        else:
                            break
                    if streak > 1:
                        e["streak"] = streak
                    n_arts, medias = slot_articles(ac, slot_list[idx]["periodKeys"], node_id)
                    e["n_articles"] = n_arts
                    if gran != "4h" and medias:
                        e["media_ids"] = medias
                    entries.append(e)
                top[gran][country][slot_list[idx]["key"]] = entries

    # Alertes du moment — dernière période de graph.json (source du bandeau)
    alerts_latest = {}
    g_periods = graph.get("meta", {}).get("periods", [])
    latest_key = g_periods[-1]["key"] if g_periods else None
    tiers_all = graph.get("meta", {}).get("salience_tiers", {})
    for country, cg in graph.get("graphs", {}).items():
        out = {}
        for n in (cg.get(latest_key, {}) or {}).get("nodes", ()):
            if n.get("alert_active") and n.get("alert_level") and n["alert_level"] != "none":
                out[n["id"]] = n["alert_level"]
                continue
            lvl = derive_alert_level(tiers_all.get(country), n.get("size"))
            if lvl:
                out[n["id"]] = lvl
        alerts_latest[country] = out

    # Bandeau d'alertes global — port exact de populateAlertBar
    # (shared-menu.js) : pivots d'événements d'abord (niveau effectif = max
    # pivot+membres, membres triés par niveau puis containment), puis les
    # alertes individuelles non couvertes, le tout trié niveau > score.
    LEVELS = ("extreme", "tres_eleve", "eleve")
    rank_of = {l: i for i, l in enumerate(LEVELS)}
    alert_bar = []
    for country, cg in graph.get("graphs", {}).items():
        gd = cg.get(latest_key) or {}
        events = gd.get("events") or []
        member_ids = set()
        for ev in events:
            pivot = ev.get("pivot") or {}
            if pivot.get("id"):
                member_ids.add(pivot["id"])
            for m in ev.get("members") or ():
                member_ids.add(m.get("id"))
        for ev in events:
            pivot = ev.get("pivot") or {}
            members = ev.get("members") or []
            if not pivot.get("id") or not members:
                continue
            lvls = [m.get("alert_level") for m in members]
            if pivot.get("alert_active"):
                lvls.append(pivot.get("alert_level"))
            top_lvl = next((l for l in LEVELS if l in lvls), None)
            if not top_lvl:
                continue
            scores = [m.get("alert_score") for m in members if isinstance(m.get("alert_score"), (int, float))]
            if pivot.get("alert_active") and isinstance(pivot.get("alert_score"), (int, float)):
                scores.append(pivot["alert_score"])
            sorted_members = sorted(
                members,
                key=lambda m: (rank_of.get(m.get("alert_level"), 9), -(m.get("containment") or 0)),
            )
            alert_bar.append({
                "id": pivot["id"], "level": top_lvl,
                "score": max(scores) if scores else None,
                "country": country, "isEvent": True,
                "memberCount": len(members),
                "memberNames": [m.get("id") for m in sorted_members],
            })
        for n in gd.get("nodes") or ():
            if n.get("alert_level") not in LEVELS or not n.get("alert_active"):
                continue
            if n.get("id") in member_ids:
                continue
            sc = n.get("alert_score")
            alert_bar.append({"id": n["id"], "level": n["alert_level"],
                              "score": sc if isinstance(sc, (int, float)) else None,
                              "country": country})
    alert_bar.sort(key=lambda a: (rank_of.get(a["level"], 9), -(a["score"] or 0)))

    result = {
        "alert_bar": alert_bar,
        "meta": {
            "generated_at": ts["meta"]["generated_at"],
            "graph_generated_at": graph.get("meta", {}).get("generated_at"),
            "countries": countries,
            "salience_tiers": tiers_all,
            "periods": [{"key": p["key"], "label": p.get("label")} for p in periods],
            "top_4h": TOP_4H,
            "top_agg": TOP_AGG,
            "slots": {g: [s["key"] for s in sl] for g, sl in slots.items()},
        },
        "top": top,
        "alltime": alltime,
        "alerts_latest": alerts_latest,
    }
    out_path = SITE / "classement.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"✓ classement.json : {out_path.stat().st_size / 1e6:.1f} Mo — "
          f"{len(periods)} périodes, {sum(len(v) for v in alltime.values())} objets cumulés")


if __name__ == "__main__":
    main()
