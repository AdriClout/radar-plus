#!/usr/bin/env python3
"""Fiches d'événements allégées pour le site : v2/events/storylines-light/{région}/{AAAA}.json

Le fichier complet v2/events/storylines/{région}/{AAAA}.json (build_events.R) pèse
~6,8 Mo pour le Québec en 2026 (~1,3 Mo compressé) : chaque édition y est écrite en
toutes lettres, pour chaque événement, deux fois (`series`, `sum24h`), et chaque fiche
répète son titre jusqu'à quatre fois. Les pages Classement, Accueil, Évolution, Alertes,
Indices et Statistiques chargent ce fichier en entier.

Ce script en écrit une version allégée, SANS TOUCHER À UN SEUL CHIFFRE :
  - les clés d'édition sont écrites une fois (`periods`) et désignées par leur rang ;
  - `series` et `sum24h` deviennent des suites d'éditions consécutives
    [rang de départ, valeur, valeur, …] ;
  - `title_last` / `title_peak` sont omis quand ils sont égaux à `title` ;
  - `first_key`, `last_key`, `peak_key`, `peak` et `n_blocks` sont omis quand ils se
    déduisent de `series` (première, dernière édition, premier maximum, nombre d'éditions) ;
  - `issue_fr` / `issue_en` renvoient à une table (`issues`) ;
  - trois champs qu'aucune page ne lit sont retirés : `last_event_id`, `first_seen`,
    `title_first` (ils restent dans le fichier complet, que lisent build_sagas.py,
    fetch_art.py, la thèse et quiconque veut la fiche entière).

Le site recompose la forme complète au chargement (site/assets/js/radar-data.js,
decodeStorylinesLight) : les pages ne voient aucune différence.

Contrôle : chaque fichier allégé est relu, recomposé, et comparé champ par champ au
fichier complet (moins les trois champs retirés). Au moindre écart, le script s'arrête
en erreur et le workflow ne publie rien.

Entrée  : pipeline/out_r2/v2/events/storylines/{région}/{AAAA}.json
Sortie  : pipeline/out_r2/v2/events/storylines-light/{région}/{AAAA}.json
"""
import argparse
import glob
import json
import os
import sys

FORMAT = "storylines-light-1"
DROP = ("last_event_id", "first_seen", "title_first")
KEY_FIELDS = ("first_key", "last_key", "peak_key")


def runs(series, rank):
    """{clé: valeur} (clés triées) → [[rang, v, v, …], …] par suites d'éditions consécutives."""
    out, prev = [], None
    for k in sorted(series):
        i = rank[k]
        if prev is not None and i == prev + 1:
            out[-1].append(series[k])
        else:
            out.append([i, series[k]])
        prev = i
    return out


def unruns(rr, periods):
    out = {}
    for r in rr:
        start = r[0]
        for j, v in enumerate(r[1:]):
            out[periods[start + j]] = v
    return out


def derived(series):
    """first_key, last_key, peak_key, peak, n_blocks déduits de la série (premier maximum)."""
    if not series:
        return {}
    ks = sorted(series)
    pk = ks[0]
    for k in ks:
        if series[k] > series[pk]:
            pk = k
    return {"first_key": ks[0], "last_key": ks[-1], "peak_key": pk, "peak": series[pk], "n_blocks": len(ks)}


def encode(full):
    S = full.get("storylines") or {}
    keys = set()
    for s in S.values():
        keys |= set(s.get("series") or {}) | set(s.get("sum24h") or {})
        keys |= {s[f] for f in KEY_FIELDS if isinstance(s.get(f), str)}
    periods = sorted(keys)
    rank = {k: i for i, k in enumerate(periods)}
    issues, irank = [], {}
    out = {}
    for sid, s in S.items():
        series = s.get("series")
        der = derived(series) if isinstance(series, dict) else {}
        e = {}
        for k, v in s.items():
            if k in DROP:
                continue
            if k in ("series", "sum24h") and isinstance(v, dict):
                e[k] = runs(v, rank)
            elif k in ("title_last", "title_peak") and "title" in s and v == s["title"]:
                continue
            elif k in der and v == der[k] and type(v) is type(der[k]):
                continue
            elif k in KEY_FIELDS and isinstance(v, str):
                e[k] = rank[v]
            elif k in ("issue_fr", "issue_en") and "issue_fr" in s and "issue_en" in s:
                if k == "issue_fr":
                    t = (s["issue_fr"], s["issue_en"])
                    if t not in irank:
                        irank[t] = len(issues)
                        issues.append(list(t))
                    e["issue"] = irank[t]
            else:
                e[k] = v
        # Les champs omis parce qu'égaux sont rétablis au décodage : on note ceux qui
        # n'existaient pas dans la fiche d'origine pour ne pas les inventer.
        absent = [k for k in ("title_last", "title_peak") + tuple(der) if k not in s]
        if absent:
            e["_absent"] = absent
        out[sid] = e
    return {
        "format": FORMAT,
        "region": full.get("region"),
        "year": full.get("year"),
        "dropped": list(DROP),
        "periods": periods,
        "issues": issues,
        "storylines": out,
    }


def decode(light):
    """Miroir exact de decodeStorylinesLight (site/assets/js/radar-data.js)."""
    P, I = light["periods"], light["issues"]
    out = {}
    for sid, e in light["storylines"].items():
        absent = set(e.get("_absent") or [])
        s = {}
        for k, v in e.items():
            if k == "_absent":
                continue
            if k in ("series", "sum24h"):
                s[k] = unruns(v, P)
            elif k in KEY_FIELDS and isinstance(v, int):
                s[k] = P[v]
            elif k == "issue":
                s["issue_fr"], s["issue_en"] = I[v]
            else:
                s[k] = v
        if "title" in s:
            for k in ("title_last", "title_peak"):
                if k not in s and k not in absent:
                    s[k] = s["title"]
        if isinstance(s.get("series"), dict):
            for k, v in derived(s["series"]).items():
                if k not in s and k not in absent:
                    s[k] = v
        out[sid] = s
    return {"region": light["region"], "year": light["year"], "storylines": out}


def check(full, light):
    """Compare la recomposition au fichier complet ; renvoie la liste des écarts."""
    back = decode(json.loads(json.dumps(light)))
    errs = []
    S, B = full.get("storylines") or {}, back["storylines"]
    if set(S) != set(B):
        errs.append(f"événements différents : {len(S)} contre {len(B)}")
    for sid, s in S.items():
        want = {k: v for k, v in s.items() if k not in DROP}
        got = B.get(sid)
        if got != want:
            errs.append(sid)
        elif any(list(got[k]) != sorted(got[k]) for k in ("series", "sum24h") if isinstance(got.get(k), dict)):
            errs.append(sid + " (ordre des éditions)")
        if len(errs) > 10:
            break
    return errs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "out_r2"))
    a = ap.parse_args()
    src = os.path.join(a.out, "v2", "events", "storylines")
    files = sorted(glob.glob(os.path.join(src, "*", "*.json")))
    if not files:
        print(f"aucune fiche dans {src} : rien à alléger")
        return 0
    bad = 0
    for path in files:
        reg, name = os.path.basename(os.path.dirname(path)), os.path.basename(path)
        with open(path, encoding="utf-8") as f:
            full = json.load(f)
        # Les clés d'édition doivent déjà être en ordre dans le fichier complet : la
        # recomposition les rend triées, et certaines pages lisent l'ordre des clés.
        for sid, s in (full.get("storylines") or {}).items():
            for k in ("series", "sum24h"):
                m = s.get(k)
                if isinstance(m, dict) and list(m) != sorted(m):
                    s[k] = {kk: m[kk] for kk in sorted(m)}
        light = encode(full)
        errs = check(full, light)
        if errs:
            bad += 1
            print(f"ÉCART {reg}/{name} : " + ", ".join(errs[:10]), file=sys.stderr)
            continue
        dst = os.path.join(a.out, "v2", "events", "storylines-light", reg, name)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(light, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{reg}/{name} : {os.path.getsize(path):,} → {os.path.getsize(dst):,} octets, "
              f"{len(light['storylines'])} événements identiques")
    if bad:
        print(f"{bad} fichier(s) allégé(s) non conformes : arrêt", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
