#!/usr/bin/env bash
# Prépare le dossier à déployer sur Cloudflare Pages à partir de site/.
# Usage : preparer-site.sh <dev|prod> <dossier de sortie>
#
# - Exclut les JSON générés (ils vivent dans R2, #52) et un éventuel CNAME (reliquat GitHub Pages).
# - Injecte le jeton public de signalement dans shared-menu.js (même mécanisme
#   que deploy-github-pages.yml) si RADAR_REPORT_DISPATCH_TOKEN est défini.
# - En dev : _headers avec X-Robots-Tag: noindex (site de travail, pas indexé).
set -euo pipefail

env="${1:?usage: preparer-site.sh <dev|prod> <dossier>}"
out="${2:?usage: preparer-site.sh <dev|prod> <dossier>}"
case "${env}" in dev|prod) ;; *) echo "env inconnu : ${env}" >&2; exit 1 ;; esac

rm -rf "${out}"
mkdir -p "${out}"
rsync -a \
  --exclude='.DS_Store' \
  --exclude='CNAME' \
  --exclude='graph.json' \
  --exclude='timeseries.json' \
  --exclude='articles.json' \
  --exclude='monitor_input.json' \
  --exclude='ticker.json' \
  site/ "${out}/"

if [ -n "${RADAR_REPORT_DISPATCH_TOKEN:-}" ]; then
  python3 - "${out}/assets/js/shared-menu.js" <<'PY'
import os, sys
path = sys.argv[1]
placeholder = "__RADAR_REPORT_DISPATCH_TOKEN__"
src = open(path, encoding="utf-8").read()
if placeholder not in src:
    sys.exit("Placeholder du jeton de signalement introuvable dans shared-menu.js")
open(path, "w", encoding="utf-8").write(src.replace(placeholder, os.environ["RADAR_REPORT_DISPATCH_TOKEN"]))
print("Jeton de signalement injecté dans shared-menu.js")
PY
else
  echo "RADAR_REPORT_DISPATCH_TOKEN absent : le formulaire de signalement reste hors ligne"
fi

# Version des ressources : Pages sert les .js/.css avec max-age=14400 (4 h), donc
# un navigateur peut garder l'ancien script sous un HTML neuf → page cassée après
# un déploiement (vécu le 24 oct. 2026 : articleStore is not a function). On
# suffixe chaque référence ./assets/…/x.js|css par ?v=<sha court> dans les HTML.
version="${ASSET_VERSION:-${GITHUB_SHA:-$(date +%s)}}"
version="${version:0:12}"
find "${out}" -maxdepth 1 -name '*.html' -print0 | xargs -0 sed -i.bak -E \
  "s#(\./assets/(js|css)/[A-Za-z0-9_.-]+\.(js|css))\"#\1?v=${version}\"#g"
find "${out}" -name '*.html.bak' -delete
echo "Ressources versionnées : ?v=${version}"

if [ "${env}" = "dev" ]; then
  printf '/*\n  X-Robots-Tag: noindex\n' > "${out}/_headers"
fi

# Garde-fous : jamais de JSON générés ni de CNAME dans un déploiement Pages.
for f in graph.json timeseries.json articles.json monitor_input.json ticker.json CNAME; do
  if [ -e "${out}/${f}" ]; then echo "::error::${f} ne doit pas être déployé" >&2; exit 1; fi
done

echo "Site préparé (${env}) : $(find "${out}" -type f | wc -l | tr -d ' ') fichiers dans ${out}"
