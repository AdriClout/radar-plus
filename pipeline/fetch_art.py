#!/usr/bin/env python3
"""Récupère l'illustration de « La Une des Unes » de la Vitrine démocratique et
l'archive par storyline dans les sorties v2 de Radar+ (chantier 2, #49).

La Vitrine génère une image par storyline au build (OpenAI, direction
artistique Mathieu Fortin / Anorak Studio) et la garde dans un bucket R2 privé.
Elle ne publie publiquement que l'image de la Une COURANTE :
    https://vitrinedemocratique.com/data/generated-art/latest.webp
et le fichier qui dit quelle histoire elle illustre :
    https://vitrinedemocratique.com/data/hero-selection.json  (event_id, storyline_id)

À chaque rafraîchissement, ce script :
  1. lit hero-selection.json ;
  2. retrouve l'histoire correspondante dans NOTRE events/latest.json (même
     storyline, ou même event_id dans le dernier bloc — les deux chaînes lisent
     la même table, mais la Vitrine peut porter un autre identifiant de
     storyline pour la même histoire) ;
  3. enregistre latest.webp sous events/art/<storyline>.webp pour chaque clé
     appariée (la nôtre et celle de la Vitrine).

Les images s'accumulent dans R2 (publish_r2.py n'efface jamais) : Radar+ garde
ainsi l'illustration de chaque Une passée. Le site affiche
events/art/<storyline>.webp si elle existe, rien sinon — jamais l'image d'une
autre Une (règle éditoriale de la Vitrine).

Usage : python3 pipeline/fetch_art.py   (après build_events.R, avant publish_r2.py)
"""
import json
import os
import sys
import urllib.request

VITRINE = "https://vitrinedemocratique.com"
HERO_URL = VITRINE + "/data/hero-selection.json"
ART_URL = VITRINE + "/data/generated-art/latest.webp"
UA = "radar-plus fetch_art (https://radarplus.org)"


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else json.loads(data.decode("utf-8"))


def family(storyline: str) -> str:
    """« story-france-26a66a62 » → « story-france » (sans le hachage final)."""
    parts = storyline.rsplit("-", 1)
    return parts[0] if len(parts) == 2 and len(parts[1]) >= 6 else storyline


def words(text: str) -> set:
    import re
    import unicodedata
    t = unicodedata.normalize("NFKD", text.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    return {w for w in re.findall(r"[a-z0-9]+", t) if len(w) >= 4}


def jaccard(a: str, b: str) -> float:
    wa, wb = words(a), words(b)
    if not wa or not wb:
        return 0.0
    return len(wa & wb) / len(wa | wb)


def main() -> int:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    events_dir = os.path.join(script_dir, "out_r2", "v2", "events")
    latest_path = os.path.join(events_dir, "latest.json")
    if not os.path.exists(latest_path):
        print("events/latest.json absent : lancer build_events.R d'abord", file=sys.stderr)
        return 0  # pas bloquant

    try:
        hero = get(HERO_URL)
    except Exception as e:  # noqa: BLE001
        print(f"hero-selection.json indisponible ({e}) : pas d'illustration cette fois")
        return 0

    v_story = hero.get("storyline_id") or None
    v_event = hero.get("event_id") or None
    v_key = v_story or v_event
    if not v_key:
        print("hero-selection.json sans storyline_id ni event_id : rien à faire")
        return 0

    latest = json.load(open(latest_path, encoding="utf-8"))
    v_title = hero.get("title") or ""
    v_sum = hero.get("sum_qc")  # indice 24h QC de la Une de la Vitrine
    v_block = hero.get("latest_block") or {}
    v_block_key = (f"{v_block.get('date_utc')}_{v_block.get('time_interval_utc')}"
                   if v_block.get("date_utc") and v_block.get("time_interval_utc") else None)

    def same_story(storyline, event_id, title, sum24h=None, last_key=None):
        # Même storyline ou même event_id : certain. Sinon, même famille de
        # storyline (« story-<slug>-<hash> » : le slug est le sujet) ET, soit des
        # titres très proches (Jaccard des mots ≥ 0,5), soit exactement le même
        # indice 24h au même bloc (la mesure est la même des deux côtés) : la
        # Vitrine et Radar+ lisent la même table mais peuvent porter des
        # identifiants ET des titres différents pour la même histoire (vu le
        # 24 oct. 2026 : story-france-26a66a62 / -44245166 ; le 31 oct. 2026 :
        # story-cyclist-68d345cd / -4da0e5ff, titres à 0,44 de Jaccard, même
        # indice 23,14 — l'illustration manquait sur Radar+).
        if v_story and storyline == v_story:
            return True
        if v_event and event_id == v_event:
            return True
        if not (v_story and storyline and family(storyline) == family(v_story)):
            return False
        if jaccard(title, v_title) >= 0.5:
            return True
        if (isinstance(v_sum, (int, float)) and isinstance(sum24h, (int, float))
                and abs(float(sum24h) - float(v_sum)) < 0.02
                and (v_block_key is None or last_key == v_block_key)):
            return True
        return False

    keys = set()
    for region, data in (latest.get("by_region") or {}).items():
        for ev in data.get("events") or []:
            if same_story(ev.get("storyline"), ev.get("id"), ev.get("title") or ""):
                keys.add(ev.get("storyline"))
        for cur in data.get("current") or []:
            if same_story(cur.get("storyline"), cur.get("last_event_id"), cur.get("title") or "",
                          cur.get("sum24h"), cur.get("last_key")):
                keys.add(cur.get("storyline"))
    keys.discard(None)
    keys.add(v_key)  # clé de la Vitrine, toujours archivée

    try:
        img = get(ART_URL, binary=True)
    except Exception as e:  # noqa: BLE001
        print(f"latest.webp indisponible ({e}) : pas d'illustration cette fois")
        return 0
    if len(img) < 1000 or img[:4] != b"RIFF":
        print("latest.webp ne ressemble pas à un WebP : ignoré")
        return 0

    art_dir = os.path.join(events_dir, "art")
    os.makedirs(art_dir, exist_ok=True)
    for key in sorted(keys):
        safe = "".join(ch for ch in key if ch.isalnum() or ch in "-_")
        if safe != key:
            print(f"clé ignorée (caractères inattendus) : {key!r}")
            continue
        with open(os.path.join(art_dir, f"{key}.webp"), "wb") as f:
            f.write(img)
    print(f"✓ illustration de la Vitrine ({v_key}, {len(img)//1024} ko) archivée sous {len(keys)} clé(s) : {', '.join(sorted(keys))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
