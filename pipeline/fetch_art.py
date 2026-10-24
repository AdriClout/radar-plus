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
    keys = set()
    for region, data in (latest.get("by_region") or {}).items():
        for ev in data.get("events") or []:
            if (v_story and ev.get("storyline") == v_story) or (v_event and ev.get("id") == v_event):
                keys.add(ev.get("storyline"))
        for cur in data.get("current") or []:
            if (v_story and cur.get("storyline") == v_story) or (v_event and cur.get("last_event_id") == v_event):
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
