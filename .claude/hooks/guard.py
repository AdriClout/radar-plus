#!/usr/bin/env python3
"""PreToolUse guard — applique de façon déterministe deux règles dures d'AGENTS.md (radar-plus).

Reçoit le JSON du tool sur stdin. Code de sortie 2 = bloque l'action (le message
stderr est renvoyé à l'agent). Sinon 0 = autorise.
"""
import os, sys, json

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)  # en cas de doute, ne pas bloquer

t = data.get("tool_input", {}) or {}
path = t.get("file_path", "") or ""

# Concatène tout le contenu écrit, y compris les sous-éditions de MultiEdit.
content = t.get("content") or t.get("new_string") or ""
for e in (t.get("edits") or []):
    content += "\n" + (e.get("new_string") or "")

# Règle dure #1 — les JSON de données de site/ sont générés par le pipeline
# (pipeline/build_data.R, build_events.R et build_ticker.R) et réécrits par
# les workflows de refresh ; jamais édités à la main. Les JSON éditables
# (site/i18n/ui.*.json, site/qualite.json) ne sont volontairement PAS dans
# cette liste.
DATA_JSON = {"graph.json", "timeseries.json", "articles.json",
             "monitor_input.json", "ticker.json", "events.json",
             "classement.json"}
base = os.path.basename(path)
norm = path.replace("\\", "/")
if base in DATA_JSON and ("/site/" in norm or norm.startswith("site/")):
    sys.stderr.write(
        f"BLOQUÉ — site/{base} est généré par le pipeline (pipeline/build_data.R "
        "ou build_ticker.R) et réécrit par les workflows de refresh ; ne jamais "
        "l'éditer à la main (AGENTS.md, règle dure #1). Pour changer les données, "
        "modifie pipeline/ (skill : rafraichir-donnees-radar).\n"
    )
    sys.exit(2)

# Règle dure #3 — aucun chemin de déploiement AWS dans ce repo (GitHub Pages seulement).
if "aws-actions/configure-aws-credentials" in content:
    sys.stderr.write(
        "BLOQUÉ — radar-plus n'a aucun chemin de déploiement AWS (AGENTS.md, règle dure #3). "
        "Les identifiants AWS servent uniquement à l'extraction en lecture seule (workflows "
        "refresh). Le site est déployé sur GitHub Pages.\n"
    )
    sys.exit(2)

sys.exit(0)
