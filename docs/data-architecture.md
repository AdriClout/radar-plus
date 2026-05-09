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
│   • compute_alert_metrics() — z-scores 30 j glissants + alert_streak    │
│     (run-length encoding des blocs anormaux consécutifs)                │
│   • alert_top_share — part vs Top 1 du pays·période                     │
│   • assign_alert_tier — 6 tiers basés sur persistance + dominance       │
│     (surveillance / watch / alert / strong / eclipse / tsunami)         │
│   • build_alert_events — clustering événementiel par pivot d'articles  │
│     (containment ≥ 50 %, sélection précision×rappel)                    │
│   • salience_tiers — paliers absolus par pays (p50/p80/p95/p99 sur     │
│     saillances ≥ 1) recalibrés à chaque run                             │
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
│   • buildPerCountryDayMatrix + buildEpisodesForObject — page Cycles     │
│     (heatmap sujet × jour, runs continus, peak salience par épisode)    │
│   • getSalienceTier (alertes + cycles) — mapping saillance → palier     │
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
| Z-score d'alerte (rolling 180 périodes, MAD/SD) | `build_data.R` | `compute_alert_metrics` | 🔴 | `radar-alerts-score` (nouveau) |
| **`alert_streak`** : run-length de blocs anormaux consécutifs | `build_data.R` | `compute_alert_metrics` | 🔴 | idem `radar-alerts-score` |
| `alert_top_share` (part vs Top 1 période) | `build_data.R` | post-traitement par groupe | 🔴 | idem `radar-alerts-score` |
| **`assign_alert_tier`** — taxonomie 6 tiers basée sur persistance + dominance (surveillance/watch/alert/strong/eclipse/tsunami) | `build_data.R` | `assign_alert_tier` | 🔴 | idem `radar-alerts-score` |
| **`build_alert_events`** — clustering événementiel : containment d'articles ≥ 50 %, sélection pivot par précision × rappel, marche gloutonne | `build_data.R` | `build_alert_events` | 🔴 | `radar-alerts-events` (nouveau, dépend de `radar-alerts-score`) |
| **`salience_tiers`** — paliers absolus calibrés par pays (p50/p80/p95/p99 sur saillances ≥ 1), recalibration auto à chaque run | `build_data.R` | section dédiée | 🔴 | `radar-salience-tiers` (nouveau, ou intégré à `radar-alerts-score`) |
| Top N par période × pays (slice_max) | `build_data.R` | `df_nodes` | 🔴 | `radar-graph-data` (nouveau) |
| Co-occurrences nœuds (`df_edges`) | `build_data.R` | section liens | 🔴 | `radar-cooccurrences` (nouveau) |
| Co-occurrences avec médias (`df_edges_media`) | `build_data.R` | section liens | 🔴 | idem `radar-cooccurrences` |
| Exclusions par pays (`EXCLUSION_BY_COUNTRY`) | `build_data.R` | constantes | 🔴 | Config raffineur (cohérent avec `radar-hot-20` qui a la même règle) |
| Assemblage `graph.json` (avec events, salience_tiers, streak) | `build_data.R` | section export | 🟡 (loader) | Lambda `radar-graph-data` style `vitrine-graph-data` |
| Assemblage `timeseries.json` (avec streak, salience_tiers) | `build_data.R` | section export | 🟡 (loader) | idem |
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
| `getAlertGroups` + `getLatestActiveMap` (statut current/ended) | `alertes.html` | `getAlertGroups` | 🔴 | Calcul statut dans `radar-alerts-score` |
| `updateEvolutionCta` — pays avec le plus d'alertes | `alertes.html` | `updateEvolutionCta` | 🟡 | Petit calcul UI, peut rester |
| Filtres UI (pays, niveau, search) | `alertes.html` | filtres | 🟢 | Pure UI |
| **Mini-timeline alertes** — agrégation alerts/event count par période 4h sur 14 j | `alertes.html` | `buildTimelineData` | 🔴 | Pré-calculer dans `radar-alerts-score` (tables temporelles déjà nécessaires pour le z-score) |
| **Sous-groupement par pays** + tri | `alertes.html` | `getActiveCountries` | 🟢 | Pure UI |
| **Localisation labels période** (May→mai, EDT→HAE) | `alertes.html` | `formatPeriodLabel` | 🟢 | Pure UI (i18n) |
| **`buildPerCountryDayMatrix`** — agrège niveau max + size max par jour pour chaque objet sur 130 j | `cycles.html` | `buildPerCountryDayMatrix` | 🔴 | `radar-cycles-day` (nouveau) — agrège timeseries 4h → jour |
| **`buildEpisodesForObject`** — runs continus de jours niveau ≥ alerte, avec peak salience | `cycles.html` | `buildEpisodesForObject` | 🔴 | idem `radar-cycles-day` ou table dédiée `radar_alert_episodes` |
| **`getSalienceTier`** (mapping size → palier) | `alertes.html`, `cycles.html`, `evolution.html` | helpers | 🟢 | Pure UI (lit `meta.salience_tiers` pré-calculé) |
| Tracking mode multi-objets | `evolution.html` | n/a | 🟢 | Pure UI |
| **4 lignes paliers de saillance** sur le chart | `evolution.html` | `renderEvolutionChart` | 🟢 | Pure UI (lit `meta.salience_tiers` pré-calculé) |
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

**Pourquoi en premier** : c'est le code le plus risqué à laisser dans GH Actions (calcul statistique non trivial, déjà eu un crash CI dû à vctrs ; et désormais beaucoup plus complexe avec la taxonomie 6 tiers, le streak temporel et les paliers de saillance). Toute la logique d'alertes, qui pilote 3 pages (Alertes / Cycles / Évolution), doit résider en un point unique du datamart.

**Source unique** : `vitrine_datamart-salient_index` (déjà raffinée).

**Calculs** (refonte du `compute_alert_metrics` + post-traitements actuels) :

1. **Z-score robuste glissant** sur 180 périodes 4h (médiane log + MAD/SD), `alert_score`, `alert_baseline`, `alert_peak_ratio`, `alert_year_peak`.
2. **`alert_streak`** — run-length encoding des blocs consécutifs anormaux par (pays, objet) ordonnés par date+période. C'est *la* nouveauté de la taxonomie 2026 : un seul bloc 4h anormal isolé n'est plus une « alerte forte ».
3. **`alert_top_share`** — saillance / Top 1 du pays·période, pour la dimension dominance.
4. **`alert_level`** — assignation 6 tiers (`surveillance`, `watch`, `alert`, `strong`, `eclipse`, `tsunami`) en combinant streak + top_share. Logique paramétrée par seuils (`ALERT_STREAK_*`, `ALERT_TOP_SHARE_*`).
5. **Statut current/ended** — actuellement re-dérivé côté JS, à publier directement par le raffineur.
6. **Clustering événementiel** (`build_alert_events`) — pour chaque (pays, période courante), grouper les alertes par pivot d'articles : `containment(membre → pivot) ≥ 0.5`, sélection pivot par `precision × recall`, marche gloutonne pour qu'aucune alerte n'appartienne à deux clusters. Garde aussi `shared_articles` matérialisé.
7. **`salience_tiers` par pays** — calibration empirique des paliers `moderate`/`high`/`very_high`/`extreme` sur les percentiles (p50/p80/p95/p99) des saillances ≥ `ALERT_MIN_ABS_SCORE`. Recalcul à chaque run, par pays. Sert d'**échelle de référence absolue** pour positionner toute saillance — utilisée par evolution.html, alertes.html, cycles.html.

**Tables datamart à publier** :

- `vitrine_datamart-radar_alerts` — une ligne par (pays, objet, date, time_interval), avec score / streak / level / top_share / etc.
- `vitrine_datamart-radar_alert_events` — un cluster par (pays, période, pivot), avec `members` (jsonb), `shared_articles`, `containment` par membre.
- `vitrine_datamart-radar_salience_tiers` — une ligne par pays × run timestamp, avec les 4 percentiles. Permet de retracer comment l'échelle évolue.

**Trigger EventBridge** : aligné sur `radar-salient-index` (~6×/jour aux mêmes heures).

**Pourquoi un seul raffineur (pas N petits)** : le streak nécessite l'historique complet par objet, le clustering événementiel utilise les alertes actives sortantes du z-score, les paliers calibrent sur la même distribution. Tout dépend de la même lecture de `salient_index` — un seul I/O.

**Note conceptuelle importante** : les **paliers de saillance** et la **convergence** sont deux **mesures de référence** sur l'agenda médiatique :
- Paliers = position d'un objet dans la distribution des saillances (où en est-il sur l'échelle ?)
- Convergence = à quel point l'agenda est concentré sur peu de sujets (à un moment donné, à quel point un seul sujet domine ?)

Ces deux indices sont conceptuellement adjacents au `top_share` qui pilote déjà la détection eclipse/tsunami. La convergence pourrait à terme **enrichir** la logique d'alerte (ex: une éclipse n'est pas qu'un sujet à top_share élevé, c'est aussi un agenda devenu globalement convergent). À garder en tête pour la conception de `radar-convergence-day` (Phase 3) — il pourrait fournir une feature à `radar-alerts-score`.

### Phase 2 — Raffineur `radar-graph-data` (loader, parallèle à `vitrine-graph-data`)

- Source : `vitrine_datamart-salient_index` + `vitrine_datamart-radar_alerts` + co-occurrences à pré-calculer
- Produit : `graph.json`, `timeseries.json`, `articles.json` ; les pousse vers le bucket S3 du frontend radar-plus
- À ce stade, `pipeline/build_data.R` est supprimé du repo
- `pipeline/fetch_data.py` aussi (le loader connaît directement le datamart)

### Phase 3 — Raffineurs d'agrégation multi-granularité + indices d'agenda

Pattern Vitrine : tables séparées par granularité (`_day`, `_week`, `_month`).

- **`radar-hot-10-day`** (et étendre `radar-hot-20` existant pour les autres granularités)
- **`radar-object-stats`** — peak rank, mentions totales, séries pour `statistiques.html`
- **`radar-convergence-day`** — indice de convergence de l'agenda par jour
  - Aujourd'hui calculé en JS (`periodConvergenceScore` dans evolution.html) : combine saillance des Top 3 + densité de co-occurrence forte. Sert au coloriage de la barre temporelle.
  - À migrer en raffineur car (1) c'est un indice métier non trivial, (2) il devrait éventuellement **alimenter `radar-alerts-score`** : une éclipse / tsunami est qualitativement plus fort dans un agenda déjà convergent. Tables suggérées : `radar_convergence_day`, potentiellement aussi `radar_convergence_4h` pour la granularité fine.
  - Voir aussi : entropie de Shannon sur la distribution de saillance (Pinto 2018), divergence de Jensen-Shannon entre périodes — métriques alternatives ou complémentaires.
- **`radar-cycles-day`** — pour la page Cycles : matrice (pays, sujet, jour) avec niveau max + size max + niveau d'épisode, et tables d'épisodes consécutifs. Aujourd'hui calculé en JS dans `cycles.html` à chaque chargement de page (130 j × ~50 sujets actifs). Coût négligeable côté backend, gros gain de simplicité côté frontend.
- **`radar-graph-aggregated-{day,week,month}`** — pré-agrégations slot pour evolution / index / constellation.

À ce stade, `index.html`, `evolution.html`, `statistiques.html`, `constellation.html`, `cycles.html` n'agrègent plus rien.

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

- **Paramètres ETL = jamais hardcodés côté frontend**. Les seuils d'alerte (`ALERT_STREAK_*`, `ALERT_TOP_SHARE_*`, `ALERT_Z_THRESHOLD`, etc.) ainsi que les paliers de saillance (p50/p80/p95/p99) sont **calculés / appliqués en raffineur**. Le frontend ne fait que les **lire** depuis `meta.alert_thresholds` / `meta.salience_tiers`. Ce contrat est déjà respecté aujourd'hui — à conserver impérativement à la migration : pas de duplication des seuils côté JS, sinon drift garanti dès qu'on ajustera la logique côté raffineur.
- **Indices d'agenda** (paliers de saillance, convergence) sont des entrées **conceptuellement adjacentes** à la logique d'alerte. La taxonomie 6 tiers actuelle utilise `top_share` (dominance ponctuelle) ; un futur enrichissement pourrait croiser avec `convergence` (dominance globale de l'agenda) pour qualifier plus finement les éclipses/tsunamis. À garder en tête lors de la conception de `radar-convergence-day` (Phase 3) — pourrait devenir une feature de `radar-alerts-score` plutôt qu'un raffineur indépendant.
- Les exclusions `EXCLUSION_BY_COUNTRY` (Canada, Ottawa, etc.) doivent être centralisées **côté raffineur** — actuellement elles sont aussi dans `radar-hot-20`, donc il y a déjà une duplication latente à régler.
- `pipeline/fetch_ticker_data.py` lit directement le bucket warehouse PROD (`bucket-stack-datawarehousebucketa0f23e27-...`). Cette dépendance dure n'a pas sa place dans GH Actions — un lambda IAM-scopé est plus propre.
- Le passage par GH Actions pour `Refresh Constellation Data` impose un secret `GH_PAT` + creds AWS dans GitHub. La migration en lambda élimine ces secrets côté repo public.
- Plusieurs pages frontend dupliquent `aggregateNodes` / `buildSlots` (index, evolution, statistiques, constellation). À factoriser au passage en migration, ou supprimer si pré-agrégé.

---

**Mainteneur de ce document** : tenir à jour à chaque migration ou changement de frontière. Quand un raffineur naît, déplacer la ligne correspondante de `pipeline/` ou `site/` dans la section "migré" et noter la date.
