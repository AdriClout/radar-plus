# RADAR+ — Roadmap & Architecture Cible

## Vision

Le site RADAR+ doit être un **pur frontend** : il charge des JSON pré-calculés depuis AWS et les affiche. **Aucune transformation de données ne doit se faire dans ce repo.** Toute logique de calcul, d'agrégation et de formatage doit vivre dans des raffineurs AWS (Glue ETL) qui produisent des tables propres dans le Data Mart.

---

## État actuel — Raffineurs & tables AWS existants

### Raffineurs existants (Glue ETL, repo `aws-infra`)

| Raffineur | Table produite (Data Mart) | Fréquence | Description |
|-----------|---------------------------|-----------|-------------|
| `radar-salient-objects.R` | `vitrine_datamart-salient_headlines_objects` | 4h | Extraction d'objets (entités nommées) depuis les manchettes via Claude LLM |
| `radar-salient-index.R` | `vitrine_datamart-salient_index` | 4h | Calcul de l'indice de saillance normalisé par objet × pays × période |

### Tables Data Warehouse (raw, scraper Lambdas)

| Table | Chemin S3 | Fréquence | Description |
|-------|-----------|-----------|-------------|
| `r-media-headlines` | `s3://data-warehouse-bucket/r-media-headlines/{MEDIA_ID}/unprocessed/` | ~10 min | Manchettes brutes scrapées (15 médias canadiens + 2 US) |

---

## Transformations locales à éliminer

Actuellement, le repo `radar-plus` fait **beaucoup trop de travail** côté pipeline :

### 1. `build_data.R` — Constellation & Évolution

**Transformations locales actuelles :**
- Top 30 objets par période × pays (`slice_max`)
- Normalisation des noms d'objets (lowercase, ponctuation)
- Exclusion de termes génériques par pays (« quebec », « canada », etc.)
- Calcul de co-occurrences (liens entre objets partageant des URLs)
- Construction de la liste d'articles par objet (max 15, avec titres/URLs/media_ids)
- Sérialisation en `graph.json` (14 jours) et `timeseries.json` (90 jours)

### 2. `build_ticker.R` — Ticker live

**Transformations locales actuelles :**
- Jointure ticker_objects ↔ lookup table de titres
- Déduplication par (media_id, url)
- Filtre lookback 12h
- Sélection du dernier article par média
- Génération de titres fallback depuis l'URL
- Sérialisation en `ticker.json` (max 120 items)

### 3. `fetch_ticker_data.py` — Accès brut S3

**Transformations locales actuelles :**
- Découverte dynamique du bucket via Glue catalog
- Scan de 15 dossiers S3 `unprocessed/`
- Parsing des partitions (extraction_year/month/day/time)
- Déduplication par (media_id, url)
- Filtre par LastModified (12h)

---

## Architecture cible — Nouveaux raffineurs à créer

### Raffineur 1 : `radar-constellation.R` (ou `.py`)

> **Remplace** : `fetch_data.py` + `build_data.R`

| Aspect | Détail |
|--------|--------|
| **Input** | Tables existantes : `salient_index`, `salient_headlines_objects` |
| **Logique** | Top N objets, exclusions, co-occurrences, articles par objet, séparation graph/timeseries |
| **Output** | Nouvelle table `vitrine_datamart-radar_constellation` (JSON-ready ou colonnes structurées) |
| **Format** | Soit un JSON sérialisé stocké en S3, soit une table Parquet avec la structure finale |
| **Fréquence** | 4h (aligné sur le refresh des tables sources) |

### Raffineur 2 : `radar-ticker.R` (ou `.py`)

> **Remplace** : `fetch_ticker_data.py` + `build_ticker.R`

| Aspect | Détail |
|--------|--------|
| **Input** | Table `r-media-headlines` (raw data warehouse) |
| **Logique** | Déduplication, filtre lookback, jointure titres, sélection latest par média, max 120 items |
| **Output** | Nouvelle table `vitrine_datamart-radar_ticker` |
| **Format** | Table Parquet avec colonnes : ts_utc, media_id, country_id, title, url |
| **Fréquence** | Idéalement ~10 min (ou au minimum chaque heure) pour garder le ticker frais |

### Raffineur 3 : `radar-hot20.R` *(optionnel, futur)*

> **Pour** : Hot 20 pré-calculé côté AWS

| Aspect | Détail |
|--------|--------|
| **Input** | `salient_index` |
| **Logique** | Top 20 objets actuels toutes périodes confondues, score agrégé, tendance (hausse/baisse) |
| **Output** | Nouvelle table `vitrine_datamart-radar_hot20` |

---

## Pipeline cible (post-raffineurs)

```
┌─────────────────────────────────────────────────────┐
│  AWS (Glue ETL — raffineurs)                        │
│                                                     │
│  Lambda scrapers (10 min)                           │
│       ↓                                             │
│  r-media-headlines (raw)                            │
│       ↓                                             │
│  radar-salient-objects → salient_headlines_objects   │
│  radar-salient-index   → salient_index              │
│       ↓                                             │
│  radar-constellation   → radar_constellation  ←NEW  │
│  radar-ticker          → radar_ticker         ←NEW  │
│  radar-hot20           → radar_hot20          ←NEW  │
└─────────────────┬───────────────────────────────────┘
                  │
                  │  GitHub Actions (simple fetch)
                  │
┌─────────────────▼───────────────────────────────────┐
│  radar-plus repo                                    │
│                                                     │
│  pipeline/fetch_and_copy.py  ← UN SEUL SCRIPT       │
│    - Athena SELECT * FROM radar_constellation       │
│    - Athena SELECT * FROM radar_ticker              │
│    - Sérialise en JSON → site/                      │
│                                                     │
│  site/  (pur frontend, zéro logique métier)         │
│    - graph.json                                     │
│    - timeseries.json                                │
│    - ticker.json                                    │
│    - index.html, evolution.html, etc.               │
└─────────────────────────────────────────────────────┘
```

---

## Idées d'amélioration — Frontend & UX

### Priorité haute

- [ ] **Filtres par pays** — Boutons CAN / QC / USA dans la constellation pour filtrer les nœuds
- [ ] **Mode comparaison** — Afficher 2 périodes côte à côte dans l'Évolution
- [ ] **Ticker : indicateurs de fraîcheur** — Badge vert/jaune/rouge selon l'âge de la dernière manchette
- [ ] **Recherche dans le ticker** — Filtrer les manchettes en temps réel par mot-clé
- [ ] **Panel article amélioré** — Quand on clique un nœud, montrer les articles groupés par média avec aperçu

### Priorité moyenne

- [ ] **Hot 20 interactif** — Cliquer un objet dans le Hot 20 le highlight dans la constellation
- [ ] **Tendances dans le Hot 20** — Flèches ↑↓ ou sparklines montrant l'évolution sur 7 jours
- [ ] **Animation de transition** — Morphing fluide quand on change de période dans la constellation
- [ ] **Timeline slider** — Barre de temps draggable pour naviguer les périodes (au lieu de boutons)
- [ ] **Export** — Bouton pour exporter le graphe en image (PNG/SVG) ou les données en CSV
- [ ] **Dark/light mode** — Toggle de thème (actuellement dark only)

### Priorité basse / exploration

- [ ] **Alertes SONAR** — Notifications push quand un objet explose en saillance
- [ ] **Cartes géo** — Visualisation géographique des médias par province/ville
- [ ] **API publique** — Endpoint REST pour accéder aux données de saillance
- [ ] **Embeddings & clustering** — Grouper les objets sémantiquement proches (via embeddings LLM)
- [ ] **Sentiment** — Ajouter une couche de sentiment par objet (positif/négatif/neutre)
- [ ] **Page « À propos »** — Expliquer la méthodologie, les sources, et l'indice de saillance

---

## Idées d'amélioration — Pipeline & Infra

- [ ] **Raffineur constellation** — Créer `radar-constellation` dans `aws-infra` (priorité #1)
- [ ] **Raffineur ticker** — Créer `radar-ticker` dans `aws-infra` (priorité #1)
- [ ] **Supprimer `build_data.R` et `build_ticker.R`** une fois les raffineurs en place
- [ ] **Réduire `fetch_data.py` et `fetch_ticker_data.py`** à de simples `SELECT *` + sérialisation JSON
- [ ] **Cache S3** — Stocker les JSON finaux dans un bucket S3 public, servir directement via CloudFront
- [ ] **Monitoring** — Dashboard CloudWatch pour surveiller la fraîcheur des données (âge du dernier scrape, dernier ETL)
- [ ] **Tests de régression** — Valider le schéma JSON produit par les raffineurs avant déploiement
- [ ] **Versioning des données** — Tag les JSON avec un hash pour cache-busting côté frontend

---

## Médias couverts (15 sources)

| ID | Média | Pays | URL |
|----|-------|------|-----|
| JDM | Journal de Montréal | QC | journaldemontreal.com |
| LAP | La Presse | QC | lapresse.ca |
| LED | Le Devoir | QC | ledevoir.com |
| RCI | ICI Radio-Canada | QC | ici.radio-canada.ca |
| TVA | TVA Nouvelles | QC | tvanouvelles.ca |
| MG | Montreal Gazette | QC | montrealgazette.com |
| CBC | CBC News | CAN | cbc.ca |
| CTV | CTV News | CAN | ctvnews.ca |
| GN | Global News | CAN | globalnews.ca |
| GAM | The Globe and Mail | CAN | theglobeandmail.com |
| NP | National Post | CAN | nationalpost.com |
| TTS | Toronto Star | CAN | thestar.com |
| VS | Vancouver Sun | CAN | vancouversun.com |
| CNN | CNN | USA | cnn.com |
| FXN | Fox News | USA | foxnews.com |
