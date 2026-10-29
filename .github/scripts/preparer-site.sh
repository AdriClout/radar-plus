#!/usr/bin/env bash
# Prépare le dossier à déployer sur Cloudflare Pages à partir de site/.
# Usage : preparer-site.sh <dev|prod> <dossier de sortie>
#
# - Exclut les JSON générés (ils vivent dans R2, #52) et un éventuel CNAME (reliquat GitHub Pages).
# - N'injecte AUCUN secret : tout ce qui est déployé est lu par n'importe quel
#   visiteur (un jeton GitHub y a été publié du 16 mai au 27 oct. 2026).
# - Garde les en-têtes de sécurité de site/_headers ; en dev, y ajoute
#   X-Robots-Tag: noindex (site de travail, pas indexé).
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

# En-têtes de sécurité : site/_headers (CSP, HSTS, cadres interdits…), servis
# par Pages dans les deux environnements. En dev, on ajoute noindex à la règle /*.
if ! grep -q '^  Content-Security-Policy:' "${out}/_headers" 2>/dev/null; then
  echo "::error::_headers absent ou sans Content-Security-Policy : le site partirait sans ses en-têtes de sécurité" >&2
  exit 1
fi
if [ "${env}" = "dev" ]; then
  awk '{ print } $0 == "/*" { print "  X-Robots-Tag: noindex" }' "${out}/_headers" > "${out}/_headers.tmp"
  mv "${out}/_headers.tmp" "${out}/_headers"
fi

# Garde-fous : jamais de JSON générés ni de CNAME dans un déploiement Pages.
for f in graph.json timeseries.json articles.json monitor_input.json ticker.json CNAME; do
  if [ -e "${out}/${f}" ]; then echo "::error::${f} ne doit pas être déployé" >&2; exit 1; fi
done

# Garde-fou : aucun jeton ni clé reconnaissable dans le site déployé (GitHub
# ghp_/github_pat_/gho_/ghs_/ghu_, AWS AKIA…, Cloudflare/R2 dans un fichier .env).
if grep -rEl '(ghp_|gho_|ghs_|ghu_)[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|AKIA[0-9A-Z]{16}' "${out}" >/dev/null; then
  echo "::error::Un jeton ou une clé a été trouvé dans le site à déployer :" >&2
  grep -rElo '(ghp_|gho_|ghs_|ghu_)[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|AKIA[0-9A-Z]{16}' "${out}" >&2
  exit 1
fi

echo "Site préparé (${env}) : $(find "${out}" -type f | wc -l | tr -d ' ') fichiers dans ${out}"
