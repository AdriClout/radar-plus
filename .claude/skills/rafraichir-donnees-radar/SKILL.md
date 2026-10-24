---
name: rafraichir-donnees-radar
description: >
  Régénère les données de RADAR+ en relançant le pipeline ETL (Athena → CSV →
  JSON) : les sorties v2 découpées (index, latest, jours, articles, séries,
  épisodes) publiées dans le bucket R2, les anciens fichiers graph/timeseries/
  articles/monitor_input encore écrits, et le ticker. À utiliser quand on demande
  de « rafraîchir », « mettre à jour » ou « régénérer » les données du site, la
  constellation, l'évolution ou le ticker, quand une page affiche des données
  périmées, ou pour tester un changement de pipeline avant fusion.
---

# Rafraîchir les données de RADAR+

Les données du site sont **générées** par le pipeline ETL, jamais éditées à la
main (le garde-fou `.claude/hooks/guard.py` bloque l'édition des anciens JSON) et
**jamais commitées** : elles vivent dans le bucket Cloudflare R2 `radar-plus-data`,
servi sur `https://data.radarplus.org` (adresse dans `site/assets/js/config.js`).
Un run local les écrit sur disque (gitignoré) ; pour mettre à jour la copie en
ligne, relancer le **workflow**, pas commiter.

## Ce que produit `build_data.R` (état au 24 oct. 2026)

| Sortie | Où | Qui la lit |
|---|---|---|
| **v2 découpé** : `index.json`, `latest.json`, `periods/{AAAA}`, `days/{pays}/{date}`, `articles/{pays}/{date}`, `series/{pays}/{AAAA}`, `episodes/{pays}/{AAAA}` | `pipeline/out_r2/v2/` → R2 `v2/` via `pipeline/publish_r2.py` (fichiers modifiés seulement) | toutes les pages, via `site/assets/js/radar-data.js` |
| anciens `graph.json`, `timeseries.json`, `articles.json` | `site/` (gitignoré) → racine du bucket via `wrangler r2 object put` | plus personne depuis la tranche 3 (#59) ; retrait prévu (tranche 4) |
| `monitor_input.json` | idem | `monitoring.html` |

Contrat v2 détaillé : `pipeline/README.md`. `build_ticker.R` produit `ticker.json`
(racine du bucket), lu par le ticker de toutes les pages.

## Rafraîchir en ligne (cas courant)

```bash
gh workflow run refresh-constellation.yml --ref develop   # graph/timeseries/articles/monitor_input + v2
gh workflow run refresh-ticker.yml --ref develop          # ticker
gh run watch <id> --exit-status --interval 15
```

Les crons tournent sur la branche **par défaut (`develop`)**. Un lancement manuel
de `refresh-constellation` archive aussi `pipeline/out_r2` en artefact `out_r2`
(3 jours), pratique pour tester une page en local :

```bash
gh run download <run_id> -n out_r2 -D pipeline/out_r2
# puis http://localhost:8000/site/index.html?data_base=http://localhost:8000/pipeline/out_r2
```

Tester un changement de pipeline avant fusion : `--ref <branche>` (il publie dans
le même bucket que la prod, données identiques).

Secrets utilisés en CI : `AWS_ACCESS_KEY_ID_DEV`/`_PROD` + secret (lecture seule
Athena), `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` (anciens fichiers,
wrangler), `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (v2, API S3 de R2).

## Rafraîchir en local

Prérequis : identifiants AWS lecture seule (profil `default`, `aws sso login` si
le jeton a expiré), R 4.4 + packages du pipeline, Python 3 + boto3.

```bash
python3 pipeline/fetch_data.py     # Athena → CSV intermédiaires (gitignorés) dans pipeline/
Rscript  pipeline/build_data.R     # CSV → site/*.json + pipeline/out_r2/v2/
python3 pipeline/fetch_ticker_data.py && Rscript pipeline/build_ticker.R
```

Publier à la main (rare ; la CI le fait) :

```bash
CLOUDFLARE_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
  python3 pipeline/publish_r2.py pipeline/out_r2 --dry-run
```

## Vérifier

- `curl -s https://data.radarplus.org/v2/index.json | jq .generated_at` et
  `…/ticker.json | jq .meta.generated_at`.
- `monitoring.html` (Sonar) affiche le lag de génération.
- Le contrôle « Validate live … » des workflows lit `data.radarplus.org` avec un
  cache-buster `?v=`.

## Pièges

- **jsonlite `auto_unbox`** transforme un vecteur de longueur 1 en scalaire JSON :
  tout champ qui doit rester un tableau (`years`, `dates`, `media_ids`, `periods`
  d'une série, `countries`) est enveloppé dans `I()`.
- Le pipeline recalcule paliers, épisodes et regroupements sur toute la fenêtre
  (130 jours) à chaque run : des fichiers de jours anciens peuvent donc changer ;
  `publish_r2.py` compare MD5 et ETag et n'envoie que les différences.
- Cache R en CI : clé = `r-constellation-vN` + empreinte de l'image (Ubuntu + ICU).
  Un échec `dyn.load … libicu` = image du runner changée → incrémenter N.
- Un `workflow_dispatch` et un cron qui se chevauchent : le plus récent annule
  l'autre (`concurrency`, cancel-in-progress) ; relancer si besoin.
- Ne jamais éditer les JSON générés à la main ni les commiter ; les CSV
  intermédiaires sont gitignorés (données brutes).
- Ces scripts sont **temporaires** : la cible est de les remplacer par des
  raffineurs CLESSN (voir `pipeline/README.md`).
