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
seront remplacés par un simple déclencheur qui copie les JSON depuis S3 vers le bucket R2 du site.

## En attendant

Les scripts ici font le travail de transformation :
- `fetch_data.py` / `fetch_ticker_data.py` — Extraction (Athena → CSV local)
- `build_data.R` / `build_ticker.R` — Transformation (CSV → JSON dans `site/`)

Les CSV intermédiaires restent dans `pipeline/` et sont gitignorés.
Les JSON finaux sont écrits dans `site/` (gitignorés). En CI, les workflows les publient
ensuite dans le bucket Cloudflare R2 `radar-plus-data` (https://data.radarplus.org),
que le site lit directement (`site/assets/js/config.js`). Aucun JSON généré n'est commité.

## Sorties v2 : données découpées (chantier 7, #59)

Depuis le 24 oct. 2026, `build_data.R` écrit AUSSI, dans `pipeline/out_r2/v2/`
(gitignoré), des petits fichiers publiés tels quels dans le bucket R2 sous le
préfixe `v2/` (`pipeline/publish_r2.py`, fichiers modifiés seulement, via l'API
S3 de R2 : secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`). Le site les
charge à la demande avec `site/assets/js/radar-data.js`, qui sait recomposer
l'ancienne forme (`timeseries` / `graph` / `articles`) pour migrer les pages une
à une. Les anciens fichiers (`graph.json`, `timeseries.json`, `articles.json`)
restent publiés tant qu'une page les lit encore.

| Fichier | Contenu | Taille typique |
|---|---|---|
| `index.json` | `generated_at`, pays, `salience_tiers`, `alert_thresholds`, `index`, `media_ids`, fenêtre (`window`, `years`, `dates` par pays), `latest_period` par pays | ~10 ko |
| `latest.json` | par pays : dernière période (`period`), `nodes` complets (articles + `media_ids`), `links`, `events` | ~150 ko |
| `periods/{AAAA}.json` | liste des blocs 4 h de l'année (`key`, `date`, `interval`, `label`) | ~100 ko / an |
| `days/{pays}/{AAAA-MM-JJ}.json` | `periods[key] = { nodes (sans articles, avec media_ids et champs alert_*), links, events }` — liens et événements seulement dans la fenêtre « graph » (14 j) | ~60-250 ko |
| `articles/{pays}/{AAAA-MM-JJ}.json` | `periods[key][objet] = [ { title, url, media_id } ]` | ~70 ko |
| `series/{pays}/{AAAA}.json` | `periods` (clés de l'année) et `objects[id] = [[idx_bloc, size, n, niveau], …]` ; niveau : 0 none, 1 élevé, 2 très élevé, 3 extrême | ~1 Mo / an / pays |
| `episodes/{pays}/{AAAA}.json` | `episodes` (objet, premier/dernier jour, `n_days`, `peak`, `status`, `level`, `cluster_*`) et `context` (membres contextuels) | ~50 ko |

Règle : une page ne télécharge que ce qu'elle affiche. Le menu lit `latest.json` ;
Statistiques lit `index` + `periods` + `series` + `episodes` + `latest`. Les
agrégats précalculés (`agg/`) et les fichiers par objet viendront dans une
tranche suivante si les séries par année deviennent trop lourdes.
