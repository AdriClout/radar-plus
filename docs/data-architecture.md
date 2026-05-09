# Architecture des données — radar-plus

> **But du document** : cartographier où chaque donnée est extraite, transformée, et consommée, et **identifier ce qui devrait à terme migrer vers les raffineurs AWS** (`aws-refiners`) plutôt que rester dans ce repo.
>
> **Statut** : diagnostic. Aucune migration n'est planifiée tant que le site n'est pas finalisé côté UX. Ce document est une boussole pour *plus tard*.

## 1. Le modèle cible (rappel : pipeline Vitrine)

Référence canonique : <https://adriencloutier.com/documents/clessn/workflow-vitrine-2025-swimlanes.html>

```
┌──────────────┐  ┌────────────────┐  ┌──────────────────┐  ┌──────────┐
│ EXTRACTORS   │→ │ RAFFINEURS     │→ │ LOADER           │→ │ FRONTEND │
│ (Glue Python)│  │ (Lambda R Doc.)│  │ (vitrine-graph-  │  │ (S3 JSON)│
│ S3 raw CSVs  │  │ Datamart RDS/  │  │  data lambda)    │  │ Pure     │
│              │  │ Athena tables  │  │ JSON → S3        │  │ render   │
└──────────────┘  └────────────────┘  └──────────────────┘  └──────────┘
```

**Principes** :

- Le frontend ne calcule **rien** (zéro agrégation, zéro score, zéro filtre métier autre que UI).
- Tout calcul est fait par un raffineur lambda et publié en *datamart Athena* (table) ou en *JSON S3* (loader).
- Les raffineurs sont packagés Docker, déployés via `aws-infra` (CDK), orchestrés par EventBridge ~5-6×/jour.
- Connexion datamart via package interne `tube` : `tube::ellipse_connect()` / `ellipse_query()` / `ellipse_publish()`.

## 2. État actuel — radar-plus

```
┌─────────────────────────────────────────────────────────────────────────┐
│  EXTRACTORS Athena (Python boto3, GH Actions)                           │
│  pipeline/fetch_data.py        → salient_index.csv, salient_objects.csv │
│  pipeline/fetch_ticker_data.py → ticker_objects.csv, ticker_index.csv   │
│        (lit aussi S3 raw + Athena warehouse direct)                     │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  RAFFINEUR + LOADER (R, GH Actions)                                     │
│  pipeline/build_data.R                                                  │
│   • compute_alert_metrics() — z-scores 30 j glissants                   │
│   • alert_top_share — part vs Top 1 du pays·période                     │
│   • niveaux strong / alert / watch / emerging                           │
│   • co-occurrences df_edges / df_edges_media                            │
│   • Top N par période × pays                                            │
│   • Exclusions par pays                                                 │
│   • Assemblage final en JSON                                            │
│  pipeline/build_ticker.R                                                │
│   • dédup hour-bucket, lookup titres, filtre 48 h                       │
│  Sortie : site/{graph,timeseries,articles,ticker,monitor_input}.json    │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FRONTEND (HTML/JS, GitHub Pages)                                       │
│  Fait des transformations significatives :                              │
│   • aggregateNodes / buildSlots — agrégation 4h→day/week/month/year     │
│   • renderHot20 — calcul Hot 20                                         │
│   • computeStats — toutes les stats par objet                           │
│   • periodConvergenceScore + getDailyConvergenceScores — heatmap        │
│   • filterTopLinks — anti-hairball graph                                │
│   • buildAllTimeScores — somme saillance toutes périodes                │
│   • getAlertGroups + getLatestActiveMap — statut current/ended          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Écart vs Vitrine** :

| Rôle | Vitrine | radar-plus actuel | Verdict |
|---|---|---|---|
| Extracteur | Glue jobs Python AWS | GH Actions Python boto3 | Acceptable mais redondant |
| Raffineur | Lambda Docker R, écrit datamart | GH Actions R écrit JSON locaux | **À migrer** |
| Loader | `vitrine-graph-data` lambda → S3 | Confondu avec raffineur dans `build_data.R` | **À séparer** |
| Frontend | Pure consommation JSON | Beaucoup d'agrégation JS | **À alléger** |

## 3. Catalogue des données

### 3.1 Sources lues par radar-plus

| Source | Type | Lue par | Statut côté Vitrine |
|---|---|---|---|
| `vitrine_datamart-salient_index` | Athena datamart | `fetch_data.py`, `fetch_ticker_data.py` | Déjà raffinée par `radar-salient-index` lambda ✓ |
| `vitrine_datamart-salient_headlines_objects` | Athena datamart | `fetch_data.py`, `fetch_ticker_data.py` | Déjà raffinée par `radar-salient-objects` lambda ✓ |
| `r-media-headlines/{MEDIA}/{processed,unprocessed}/*.csv` | S3 warehouse raw | `fetch_ticker_data.py` (primary) | Source brute scraper Lambdas |
| `r-media-headlines` (Athena warehouse) | Athena warehouse | `fetch_ticker_data.py` (fallback) | Parquet refresh ~4 h |

**Bon point** : on consomme les datamarts Vitrine — pas de duplication d'extraction primaire.

### 3.2 Transformations — où elles vivent et où elles devraient vivre

Légende verdict :
- 🟢 **Garder ici** — purement présentation/UI.
- 🟡 **Borderline** — peut rester, mais migrable si on veut le pattern pur.
- 🔴 **Migrer en raffineur** — calcul métier qui devrait être pré-calculé côté AWS.

#### Pipeline R (radar-plus/pipeline/)

| Transformation | Fichier | Ligne | Verdict | Raffineur cible suggéré |
|---|---|---|---|---|
| Filtrage temporel `date >= history_start` | `build_data.R` | 217 | 🟡 | À pousser dans le query SQL |
| Z-score d'alerte (rolling 180 périodes, MAD/SD) | `build_data.R` | 75-202 | 🔴 | `radar-alerts-score` (nouveau) |
| `alert_top_share` (part vs Top 1 période) | `build_data.R` | 258-265 | 🔴 | idem `radar-alerts-score` |
| Niveaux strong/alert/watch/emerging + downgrade | `build_data.R` | 250-270 | 🔴 | idem `radar-alerts-score` |
| Top N par période × pays (slice_max) | `build_data.R` | 276-279 | 🔴 | `radar-graph-data` (nouveau) |
| Co-occurrences nœuds (`df_edges`) | `build_data.R` | 298-319 | 🔴 | `radar-cooccurrences` (nouveau) |
| Co-occurrences avec médias (`df_edges_media`) | `build_data.R` | 321-341 | 🔴 | idem `radar-cooccurrences` |
| Exclusions par pays (`EXCLUSION_BY_COUNTRY`) | `build_data.R` | 48-52 | 🔴 | Config raffineur (cohérent avec `radar-hot-20` qui a la même règle) |
| Assemblage `graph.json` | `build_data.R` | 434-523 | 🟡 (loader) | Lambda `radar-graph-data` style `vitrine-graph-data` |
| Assemblage `timeseries.json` | `build_data.R` | 525-619 | 🟡 (loader) | idem |
| Assemblage `articles.json` | `build_data.R` | (lazy) | 🟡 (loader) | idem |
| Cascade ticker (raw S3 → Athena warehouse → datamart) | `fetch_ticker_data.py` | 244-287 | 🔴 | `radar-ticker` raffineur dédié |
| Dédup hour-bucket + lookup titres + filtre 48 h | `build_ticker.R` | 88-116 | 🔴 | idem `radar-ticker` |

#### Frontend (site/)

| Transformation | Fichier | Ligne | Verdict | Raffineur cible suggéré |
|---|---|---|---|---|
| `buildSlots` — bucket day/week/month/year/total | `index.html` | 1556 | 🔴 | Pré-calculé : tables `radar_*_day/week/month` (pattern Vitrine `issues_score_day`) |
| `aggregateNodes` — somme size + dédup articles par slot | `index.html` | 1630 | 🔴 | idem |
| `buildAllTimeScores` — somme par objet sur tout l'historique | `index.html` | 1420 | 🔴 | Table `radar_alltime_scores` |
| `renderHot20` — calcul Hot 20 par pays | `index.html` | n/a | 🔴 | Raffineur `radar-hot-20` **existe déjà** côté Vitrine (hebdo) — étendre ou créer `radar-hot-10` quotidien |
| `aggregateSlot` constellation | `constellation.html` | 1150 | 🔴 | Pré-calculé par granularité |
| `filterTopLinks` (max links per node) | `constellation.html`, `evolution.html` | 637, 732 | 🔴 | À pré-calculer en raffineur |
| `getWinPeriodGD` — agrège 4h→day | `evolution.html` | 756 | 🔴 | Pré-calculé |
| `periodConvergenceScore` + `getDailyConvergenceScores` | `evolution.html` | 785, 816 | 🔴 | Table `radar_convergence_day` |
| `buildRankedSlots` — Hot 10 cumulé par bucket | `evolution.html` | 1199 | 🔴 | idem Hot 20 |
| `computeStats` — peak rank, mentions totales, etc. | `statistiques.html` | 1145 | 🔴 | Table `radar_object_stats` |
| `buildSearchMeta` | `statistiques.html` | 1786 | 🔴 | idem |
| `getAlertGroups` + `getLatestActiveMap` (statut current/ended) | `alertes.html` | 530, 578 | 🔴 | Calcul statut dans `radar-alerts-score` |
| `updateEvolutionCta` — pays avec le plus d'alertes | `alertes.html` | 725 | 🟡 | Petit calcul UI, peut rester |
| Filtres UI (pays, niveau, search) | `alertes.html` | 810+ | 🟢 | Pure UI |
| Tracking mode multi-objets | `evolution.html` | n/a | 🟢 | Pure UI |
| Force graph rendering | `constellation.html` | n/a | 🟢 | Pure UI |
| `buildKpis`, `buildTrendAndTop`, `buildQualityTable` | `sonar.html` | 570, 638, 677 | 🟡 | Sonar est un dashboard de monitoring, OK qu'il vive ici, mais à harmoniser avec le raffineur `sonar` existant |

### 3.3 Sorties produites par radar-plus

| Fichier | Source | Consommateurs | Statut |
|---|---|---|---|
| `site/graph.json` | `build_data.R` | constellation, alertes, sonar, statistiques, index, alert-bar, evolution (partiel) | À remplacer par JSONs raffinés S3 |
| `site/timeseries.json` | `build_data.R` | evolution, statistiques, index, sonar | idem |
| `site/articles.json` | `build_data.R` | evolution, index (lazy) | idem |
| `site/ticker.json` | `build_ticker.R` | unes, ticker section toutes pages | À produire par `radar-ticker` raffineur |
| `site/monitor_input.json` | `build_data.R` | sonar | À harmoniser avec raffineur `sonar` |

## 4. Plan de migration suggéré (à exécuter *après* finalisation UX)

> **Phase 0** (maintenant → site finalisé) : aucune migration, on continue ici.

### Phase 1 — Raffineur `radar-alerts-score` (priorité haute)

**Pourquoi en premier** : c'est la prochaine grosse évolution UX (clustering événementiel — voir conversation alertes), et c'est le code le plus risqué à laisser au mauvais endroit (calcul statistique + déjà eu un crash CI dû à vctrs).

- Source : `vitrine_datamart-salient_index` (table déjà raffinée)
- Calcule : z-score, top_share, niveau, statut current/ended, **clustering événementiel** (Jaccard + pivot)
- Publie : `vitrine_datamart-radar_alerts` (une ligne par objet × période × pays) + `vitrine_datamart-radar_alert_events` (cluster d'événements)
- Trigger EventBridge : aligné sur `radar-salient-index` (~6×/jour)

### Phase 2 — Raffineur `radar-graph-data` (loader, parallèle à `vitrine-graph-data`)

- Source : `vitrine_datamart-salient_index` + `vitrine_datamart-radar_alerts` + co-occurrences à pré-calculer
- Produit : `graph.json`, `timeseries.json`, `articles.json` ; les pousse vers le bucket S3 du frontend radar-plus
- À ce stade, `pipeline/build_data.R` est supprimé du repo
- `pipeline/fetch_data.py` aussi (le loader connaît directement le datamart)

### Phase 3 — Raffineurs d'agrégation multi-granularité

Pattern Vitrine : tables séparées par granularité (`_day`, `_week`, `_month`).

- `radar-hot-10-day` (et étendre `radar-hot-20` existant pour les autres granularités)
- `radar-object-stats` (peak rank, mentions totales, séries pour `statistiques.html`)
- `radar-convergence-day` (heatmap timeline)
- `radar-graph-aggregated-{day,week,month}` (pré-agrégations slot)

À ce stade, `index.html`, `evolution.html`, `statistiques.html`, `constellation.html` n'agrègent plus rien.

### Phase 4 — Raffineur `radar-ticker`

- Gère la cascade (raw S3 → warehouse Parquet → datamart)
- Publie `ticker.json` toutes les ~10 min
- `fetch_ticker_data.py` + `build_ticker.R` disparaissent

### Phase 5 — Repo radar-plus = pure frontend statique

À l'issue : ce repo ne contient plus que `site/` (HTML, CSS, JS de rendu, i18n) + `.github/workflows/deploy-github-pages.yml`. Aucun pipeline, aucune transformation, aucun secret AWS dans GitHub Actions.

## 5. Conventions à suivre quand on migrera

- **Naming raffineurs** : préfixe `radar-` (cf. `radar-salient-index`, `radar-hot-20`).
- **Table datamart** : `vitrine_datamart-radar_<nom>` (préfixe `vitrine_datamart-` pour cohérence avec l'existant).
- **Granularités** : suffixes `_day`, `_week`, `_month` (jamais d'agrégation à la volée si on veut suivre Vitrine).
- **Loader S3** : un seul lambda `radar-graph-data` qui produit tous les JSON consommés par le site, écrit sous `data/refined/{day|week|month}/<file>.json`. Le frontend pointe vers `https://radarplus.org/data/refined/...`.
- **Tags `ellipse_publish`** : `app="radar"`, `pole="..."`, `type="..."`, `dimensions="..."`, `data="..."` (à préciser avec l'équipe).
- **Trigger EventBridge** : aligner sur la cadence des sources (`radar-salient-index` = 6×/jour aux mêmes heures).

## 6. Notes & risques

- Les exclusions `EXCLUSION_BY_COUNTRY` (Canada, Ottawa, etc.) doivent être centralisées **côté raffineur** — actuellement elles sont aussi dans `radar-hot-20`, donc il y a déjà une duplication latente à régler.
- `pipeline/fetch_ticker_data.py` lit directement le bucket warehouse PROD (`bucket-stack-datawarehousebucketa0f23e27-...`). Cette dépendance dure n'a pas sa place dans GH Actions — un lambda IAM-scopé est plus propre.
- Le passage par GH Actions pour `Refresh Constellation Data` impose un secret `GH_PAT` + creds AWS dans GitHub. La migration en lambda élimine ces secrets côté repo public.
- Plusieurs pages frontend dupliquent `aggregateNodes` / `buildSlots` (index, evolution, statistiques, constellation). À factoriser au passage en migration, ou supprimer si pré-agrégé.

---

**Mainteneur de ce document** : tenir à jour à chaque migration ou changement de frontière. Quand un raffineur naît, déplacer la ligne correspondante de `pipeline/` ou `site/` dans la section "migré" et noter la date.
