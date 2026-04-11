# Pipeline — Scripts ETL temporaires

> ⚠️ **Ces scripts sont temporaires.** L'objectif à terme est de remplacer chaque
> étape par un **raffineur** dans la plateforme CLESSN, et de charger directement
> les données propres depuis les tables AWS du datamart.

## Raffineurs à créer

| Script actuel             | Raffineur à créer                        | Table(s) source                                        | Statut       |
|---------------------------|------------------------------------------|---------------------------------------------------------|--------------|
| `fetch_data.py`           | **raffineur_salient_index**              | `vitrine_datamart-salient_index`, `vitrine_datamart-salient_headlines_objects` | À créer      |
| `build_data.R`            | **raffineur_constellation_json**         | Sortie du raffineur salient_index                       | À créer      |
| `fetch_ticker_data.py`    | **raffineur_ticker_headlines**           | Athena DWH + Slack channel (manchettes temps réel)      | À créer      |
| `build_ticker.R`          | **raffineur_ticker_json**                | Sortie du raffineur ticker_headlines                    | À créer      |

## Architecture cible

```
AWS Athena (datamart) → Raffineurs CLESSN → Tables propres → site/ charge directement
```

Quand les raffineurs existeront, ce dossier `pipeline/` pourra être supprimé.
Les workflows GitHub Actions (`refresh-constellation.yml`, `refresh-ticker.yml`)
seront remplacés par un simple déclencheur qui copie les JSON depuis S3 vers `site/`.

## En attendant

Les scripts ici font le travail de transformation :
- `fetch_data.py` / `fetch_ticker_data.py` — Extraction (Athena → CSV local)
- `build_data.R` / `build_ticker.R` — Transformation (CSV → JSON dans `site/`)

Les CSV intermédiaires restent dans `pipeline/` et sont gitignorés.
Les JSON finaux sont écrits dans `site/` (déployé via GitHub Pages).
