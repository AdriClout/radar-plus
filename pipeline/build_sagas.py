#!/usr/bin/env python3
"""
Sagas de Radar+ (maquette, première version en dev).

Une saga est une même affaire qui revient dans les Unes : plusieurs événements
(ses chapitres) qui se suivent, avec des silences (fiche « saga » de la base Notion
« Radar+ et la mesure de la saillance »). L'appartenance d'un événement à une saga
vient de la couche calculée pour la thèse (table DEV `headline_sagas_these`, lue par
`fetch_data.py archive` dans `pipeline/sagas_these.csv`) ; tout le reste se calcule
ici, à partir des fiches d'événements que le site publie déjà
(`v2/events/storylines/{région}/{année}.json`), pour que les points d'une saga
soient exactement la somme des points de ses événements dans le Classement.

Entrées : pipeline/sagas_these.csv ; pipeline/out_r2/v2/events/storylines/*/*.json
Sorties : pipeline/out_r2/v2/sagas/index.json (toutes les sagas, léger)
          pipeline/out_r2/v2/sagas/s/<slug>.json (une saga : chapitres, série, tempêtes)

Usage : python3 pipeline/build_sagas.py [--sagas CSV] [--out DIR]
Rien n'est écrit si le fichier des sagas manque (le site affiche alors un message).
"""

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
REGIONS = ["QC", "CAN"]

# Seuils déclarés (méthodologie de la page) :
SEUIL_GRANDE = 3000    # « grande saga » : points cumulés sur l'année publiée
SEUIL_MAJEURE = 1000   # même barre que les événements majeurs de l'article 2
# Tempête médiatique, d'après Boydstun, Hardy et Walgrave (2014) : une hausse d'au
# moins 150 % d'une semaine à l'autre, au moins 20 % de l'agenda, au moins une semaine.
# Ici, l'agenda = toute la saillance des événements de la région ; la semaine =
# 7 jours glissants (jours de Montréal).
TEMPETE_PART = 0.20
TEMPETE_HAUSSE = 2.5   # part ≥ 2,5 × la part des 7 jours précédents (+150 %)
SILENCE_JOURS = 7      # un retour après plus de 7 jours sans Une = un silence


def slugify(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:90] or "saga"


def read_sagas(path):
    """storyline_id → saga ; métadonnées par saga."""
    member, meta = {}, {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            sid, gid = (r.get("storyline_id") or "").strip(), (r.get("saga_id") or "").strip()
            if not sid or not gid:
                continue
            member[sid] = gid
            if gid not in meta:
                dout = str(r.get("saga_douteuse", "")).strip().lower() in ("true", "1", "vrai")
                meta[gid] = {
                    "titre": (r.get("titre_saga") or r.get("nom_affaire") or "").strip(),
                    "nom": (r.get("nom_affaire") or "").strip(),
                    "type": (r.get("type_affaire") or "").strip(),
                    "douteuse": dout,
                }
    return member, meta


def read_storylines(out_dir, region):
    d = os.path.join(out_dir, "v2", "events", "storylines", region)
    st = {}
    if not os.path.isdir(d):
        return st
    for fn in sorted(os.listdir(d)):
        if fn.endswith(".json"):
            with open(os.path.join(d, fn), encoding="utf-8") as f:
                st.update(json.load(f).get("storylines", {}))
    return st


def day_of(key):
    return key[:10]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sagas", default=os.path.join(HERE, "sagas_these.csv"))
    ap.add_argument("--out", default=os.path.join(HERE, "out_r2"))
    a = ap.parse_args()
    if not os.path.exists(a.sagas):
        print(f"Pas de {a.sagas} : sagas non construites.")
        return
    member, meta = read_sagas(a.sagas)
    with open(os.path.join(HERE, "archive_these.json"), encoding="utf-8") as f:
        arch = json.load(f)
    # Les sagas couvrent l'année publiée jusqu'à la fin de la couche (15 oct. 2026) :
    # au-delà, les événements n'ont pas encore été rattachés.
    debut = arch["debut"]
    fin = "2026-10-15"
    d0, d1 = date.fromisoformat(debut), date.fromisoformat(fin)
    days = [(d0 + timedelta(i)).isoformat() for i in range((d1 - d0).days + 1)]
    di = {d: i for i, d in enumerate(days)}
    nd = len(days)
    weeks = [days[i] for i in range(0, nd, 7)]  # semaines de 7 jours depuis le début

    slugs, used = {}, set()
    for gid in meta:
        s = slugify(meta[gid]["titre"] or gid)
        base, k = s, 2
        while s in used:
            s = f"{base}-{k}"; k += 1
        used.add(s); slugs[gid] = s

    index = {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "debut": debut, "fin": fin, "days": nd, "weeks": weeks,
        "seuils": {"grande": SEUIL_GRANDE, "majeure": SEUIL_MAJEURE,
                   "tempete": {"part": TEMPETE_PART, "hausse_pct": round((TEMPETE_HAUSSE - 1) * 100),
                               "jours": 7}, "silence_jours": SILENCE_JOURS},
        "source": "Couche des sagas calculée pour la thèse (7-8 nov. 2026), points du site.",
        "regions": {}, "sagas": [],
    }
    per_saga = defaultdict(lambda: {"r": {}})

    for reg in REGIONS:
        st = read_storylines(a.out, reg)
        total = [0.0] * nd
        sagas_ed = defaultdict(lambda: defaultdict(float))   # saga → édition → points
        chapters = defaultdict(list)
        for sid, v in st.items():
            ser = {k: x for k, x in (v.get("series") or {}).items() if debut <= day_of(k) <= fin}
            if not ser:
                continue
            for k, x in ser.items():
                total[di[day_of(k)]] += x
            gid = member.get(sid)
            if not gid:
                continue
            for k, x in ser.items():
                sagas_ed[gid][k] += x
            pts = sum(ser.values())
            pk = max(ser, key=ser.get)
            keys = sorted(ser)
            chapters[gid].append({
                "id": sid, "titre": v.get("title_peak") or v.get("title") or "",
                "debut": keys[0], "fin": keys[-1], "pic_key": pk, "pic": round(ser[pk], 1),
                "pts": round(pts, 1), "editions": len(ser),
                "medias": len(v.get("outlets") or []) + len(v.get("outlets_other") or []),
                "enjeu": v.get("issue_fr") or "",
                "_days": sorted({di[day_of(k)] for k in ser}),
            })
        T = sum(total)
        cum = [0.0]
        for x in total:
            cum.append(cum[-1] + x)

        def win(c, i):  # somme sur les 7 jours finissant au jour i
            return c[i + 1] - c[max(0, i - 6)]

        rows = []
        for gid, eds in sagas_ed.items():
            daily = [0.0] * nd
            for k, x in eds.items():
                daily[di[day_of(k)]] += x
            pts = sum(daily)
            if pts <= 0:
                continue
            ch = sorted(chapters[gid], key=lambda c: c["debut"])
            dc = [0.0]
            for x in daily:
                dc.append(dc[-1] + x)
            share7 = [(win(dc, i) / win(cum, i)) if win(cum, i) > 0 else 0.0 for i in range(nd)]
            # Tempêtes : départ quand la part sur 7 jours atteint 20 % après une hausse
            # d'au moins 150 % ; la tempête dure tant que la part reste ≥ 20 %.
            storms, i = [], 7
            while i < nd:
                r, r0 = share7[i], share7[i - 7]
                if r >= TEMPETE_PART and r0 * TEMPETE_HAUSSE <= r:
                    j = i
                    while j + 1 < nd and share7[j + 1] >= TEMPETE_PART:
                        j += 1
                    s0 = max(0, i - 6)
                    peak_i = max(range(i, j + 1), key=lambda x: share7[x])
                    # Événement déclencheur (Kepplinger et Habermeier 1995) : le chapitre
                    # qui porte le plus de points dans la première semaine de la tempête.
                    best, bp = None, 0.0
                    for c in ch:
                        p = sum(x for k, x in eds.items() if s0 <= di[day_of(k)] <= i
                                and c["debut"] <= k <= c["fin"] and k in _keys_of(st, c["id"]))
                        if p > bp:
                            best, bp = c["id"], p
                    storms.append({"debut": days[s0], "fin": days[j], "jours": j - s0 + 1,
                                   "pic_part": round(share7[peak_i] * 100, 1), "pic_jour": days[peak_i],
                                   "avant_part": round(r0 * 100, 1), "declencheur": best})
                    i = j + 8
                else:
                    i += 1
            # Silences : retours après plus de 7 jours sans Une.
            active = sorted({d for c in ch for d in c["_days"]})
            silences = [[days[p], days[q], q - p - 1] for p, q in zip(active, active[1:]) if q - p - 1 > SILENCE_JOURS]
            pk_day = max(range(nd), key=lambda x: daily[x])
            best7 = max(range(nd), key=lambda x: share7[x])
            wk = defaultdict(float)
            for i2, x in enumerate(daily):
                if x:
                    wk[i2 // 7] += x
            rows.append((pts, gid, {
                "pts": round(pts, 1), "part": round(pts / T * 100, 3) if T else 0,
                "chapitres": len(ch), "debut": active and days[active[0]], "fin": active and days[active[-1]],
                "jours_actifs": len(active), "pic_jour": days[pk_day], "pic_jour_pts": round(daily[pk_day], 1),
                "max7": round(share7[best7] * 100, 1), "max7_jour": days[best7],
                "tempetes": [[s["debut"], s["fin"], s["pic_part"]] for s in storms],
                "silences": len(silences),
                "perles": [[di[day_of(c["pic_key"])], c["pts"], c["titre"]] for c in ch],
                "sem": {str(k): round(x, 1) for k, x in sorted(wk.items())},
            }, {
                "liste_chapitres": [{k: v for k, v in c.items() if k != "_days"} for c in ch],
                "jour": [round(x, 1) for x in daily], "part7": [round(x * 100, 2) for x in share7],
                "tempetes": storms, "liste_silences": silences,
            }))
        rows.sort(key=lambda r: -r[0])
        n_grandes = sum(1 for r in rows if r[0] >= SEUIL_GRANDE)
        sagas_pts = sum(r[0] for r in rows)
        wt = defaultdict(float)
        for i2, x in enumerate(total):
            wt[i2 // 7] += x
        index["regions"][reg] = {
            "total_pts": round(T, 1), "sagas_pts": round(sagas_pts, 1),
            "part_sagas": round(sagas_pts / T * 100, 1) if T else 0,
            "n_sagas": len(rows), "n_majeures": sum(1 for r in rows if r[0] >= SEUIL_MAJEURE),
            "n_grandes": n_grandes, "sem_total": [round(wt[k], 1) for k in range(len(weeks))],
            "jour_total": [round(x, 1) for x in total],
        }
        for rang, (_, gid, light, detail) in enumerate(rows, 1):
            light["rang"] = rang
            detail["rang"] = rang
            per_saga[gid]["r"][reg] = (light, detail)
        print(f"{reg} : {len(rows)} sagas, {n_grandes} grandes, part des sagas {index['regions'][reg]['part_sagas']} %, "
              f"tempêtes {sum(len(r[2]['tempetes']) for r in rows)}")

    sdir = os.path.join(a.out, "v2", "sagas", "s")
    os.makedirs(sdir, exist_ok=True)
    for gid, v in per_saga.items():
        m = meta[gid]
        n_ch = max(r[0]["chapitres"] for r in v["r"].values())
        if n_ch < 2:
            continue
        light = {"id": gid, "slug": slugs[gid], "titre": m["titre"], "type": m["type"],
                 "douteuse": m["douteuse"], "r": {reg: r[0] for reg, r in v["r"].items()}}
        index["sagas"].append(light)
        detail = dict(light)
        detail["r"] = {reg: dict(r[0], **r[1]) for reg, r in v["r"].items()}
        with open(os.path.join(sdir, slugs[gid] + ".json"), "w", encoding="utf-8") as f:
            json.dump(detail, f, ensure_ascii=False, separators=(",", ":"))
    index["sagas"].sort(key=lambda s: -max(r["pts"] for r in s["r"].values()))
    with open(os.path.join(a.out, "v2", "sagas", "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"→ v2/sagas/index.json ({len(index['sagas'])} sagas) et v2/sagas/s/*.json")


_KEYS = {}


def _keys_of(st, sid):
    if sid not in _KEYS:
        _KEYS[sid] = set((st.get(sid) or {}).get("series", {}).keys())
    return _KEYS[sid]


if __name__ == "__main__":
    sys.exit(main())
