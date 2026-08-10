---
name: rafraichir-donnees-radar
description: >
  Régénère les JSON de données de RADAR+ (site/graph.json, timeseries.json,
  articles.json, monitor_input.json, ticker.json) en relançant le pipeline ETL
  (Athena → CSV → JSON). À utiliser quand on demande de « rafraîchir », « mettre
  à jour » ou « régénérer » les données du site, la constellation, l'évolution
  ou le ticker, ou quand un JSON de site/ est périmé. Déclencheurs : « rafraîchis
  les données », « mets à jour la constellation », « régénère le ticker »,
  « relance le pipeline ».
---

# Rafraîchir les données de RADAR+

Les JSON de données dans `site/` sont **générés** par le pipeline ETL, jamais
édités à la main (le garde-fou `.claude/hooks/guard.py` bloque l'édition). Pour
les mettre à jour, relancer le pipeline.

## Prérequis

- Identifiants AWS **lecture seule** (le pipeline lit le datamart Athena de la
  CLESSN). En CI c'est le secret `GH_PAT` + boto3 ; en local, la config AWS
  habituelle.
- R + les packages du pipeline ; Python 3 + boto3.

## Constellation / Évolution

Régénère `graph.json`, `timeseries.json`, `articles.json`, `monitor_input.json` :

```bash
python3 pipeline/fetch_data.py     # Athena → CSV intermédiaires (gitignorés) dans pipeline/
Rscript  pipeline/build_data.R     # CSV → JSON dans site/
```

## Ticker

Régénère `ticker.json` :

```bash
python3 pipeline/fetch_ticker_data.py
Rscript  pipeline/build_ticker.R
```

## Rappels

- **Ne jamais** éditer les JSON de `site/` à la main — le garde-fou bloque, et
  le prochain refresh les écraserait de toute façon.
- Les CSV intermédiaires de `pipeline/` sont gitignorés (données brutes).
- En production, ces étapes tournent automatiquement via `.github/workflows/`
  (`refresh-constellation.yml` 6×/jour, `refresh-ticker.yml` ~10 min ; crons en
  heure de Montréal).
- Vérifier le rendu en local : `python3 -m http.server 8000` puis `/site/`.
- Ces scripts sont **temporaires** : la cible est de les remplacer par des
  raffineurs CLESSN (voir `pipeline/README.md`).
