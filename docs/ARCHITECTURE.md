# 🏗️ Architecture de la Vitrine Démocratique

Ce document décrit l'architecture complète du système **Vitrine Démocratique** et comment les données circulent depuis la collecte jusqu'aux analyses RADAR+.

---

## 📐 Vue d'ensemble

La Vitrine Démocratique est un **pipeline de raffineurs AWS Lambda** qui:

1. 🕷️ **Collecte** les manchettes médiatiques de 15 médias QC/CAN/USA (toutes les 4h)
2. 🔍 **Extrait** les objets saillants (personnes, lieux, événements, organisations)
3. 📊 **Calcule** des indices de saillance et scores d'enjeux/partis
4. 🤖 **Génère** des reflets médiatiques via LLM (Claude)
5. 📤 **Publie** des JSON pour le frontend et des heatmaps sur Slack

**Stack technique** :
- **R** (tidyverse, tube, ellipsellm)
- **AWS Lambda** (conteneurs Docker)
- **Athena** (requêtes SQL sur S3)
- **S3** (datawarehouse et datamarts)

---

## 🔄 Flux de données

### Étape 1 : Collecte (Datawarehouse)

**Table source** : `r-media-headlines`

**Fréquence** : Toutes les 4h (00:03, 04:03, 08:03, 12:03, 16:03, 20:03 UTC)

**Mécanisme** : GLUE_JOB scrape les sites médias et stocke :
- `headline_start`, `headline_stop` : Fenêtre temporelle 4h
- `media_id` : JDM, LAP, CNN, etc.
- `title`, `body`, `author` : Contenu de l'article
- `headline_minutes` : Temps exact d'apparition en Une

**Médias couverts** :
- **QC** (6) : JDM, LAP, LED, RCI, TVA, MG
- **CAN** (7) : CBC, CTV, GN, GAM, NP, TTS, VS
- **USA** (2) : CNN, FXN

---

### Étape 2 : Extraction des objets saillants

**Raffineur** : `radar-salient-objects.R`

**Horaire** : 00:16, 04:16, 08:16, 12:16, 16:16, 20:16 UTC (16 min après GLUE_JOB)

**Input** : `r-media-headlines`

**Output** : `salient_headlines_objects` (datamart)

**Fonction** : Utilise le LLM Claude pour extraire tous les objets mentionnés dans les manchettes :
- **Personnes** : Donald Trump, Justin Trudeau, etc.
- **Lieux** : Québec, Washington, Gaza, etc.
- **Événements** : Élection 2025, COP29, etc.
- **Organisations** : PLQ, NATO, UN, etc.

**Colonnes clés** :
```
headline_start, headline_stop       # Période 4h
headline_minutes                    # Timestamp exact
media_id, country_id                # Média et pays
title, body, author                 # Contenu article
extracted_objects                   # Liste JSON des objets
tag                                 # Version du raffineur
```

---

### Étape 3 : Calcul des indices de saillance

**Raffineur** : `radar-salient-index.R`

**Horaire** : 00:20, 04:20, 08:20, 12:20, 16:20, 20:20 UTC

**Input** : `salient_headlines_objects`

**Output** : `salient_index` (datamart)

**Fonction** : Agrège et normalise les scores de saillance par blocs de 4h

**Formule de saillance** :
```
Score = (Nombre de mentions) × (Temps pondéré en Une)

Où :
- Temps pondéré = headline_minutes normalisé par la moyenne globale
- Permet de comparer équitablement TVA, La Presse, CNN, etc.
```

**Colonnes clés** :
```
country_id                  # QC, CAN, USA
time_block                  # "00-04", "04-08", etc.
object_name                 # Nom de l'objet
salience_score              # Score calculé
mentions_count              # Nombre de mentions
tag
```

---

### Étape 4 : Raffineurs secondaires

Ces raffineurs consomment `salient_headlines_objects` et `salient_index` pour produire des analyses spécifiques.

#### A. Scores des enjeux politiques

**Raffineur** : `radar-issues-score.R`

**Horaires** :
- Quotidien (3×/jour) : 08:09, 12:09, 16:09 UTC
- Hebdomadaire : 16:11 UTC
- Mensuel : 16:14 UTC

**Outputs** :
- `issues_score_day` (avec paramètre `pass` : am/pm)
- `issues_score_week`
- `issues_score_month`

**Enjeux suivis** :
- Économie et emploi
- Santé
- Immigration
- Environnement
- Éducation
- Justice et sécurité
- Relations internationales

**Colonnes** :
```
date                        # Date du score
economy_and_labour          # Score économie
health                      # Score santé
immigration                 # Score immigration
...                         # Autres enjeux
pass                        # am/pm (day seulement)
tag
```

#### B. Scores des partis politiques

**Raffineur** : `radar-party-score.R`

**Horaires** : Similaires à issues-score (quotidien 3×, hebdo, mensuel)

**Outputs** :
- `federal_parties_score_day/week/month`
- `provincial_parties_score_day/week/month`

**Partis suivis** :
- **Fédéral** : LPC, CPC, NDP, BQ, GPC
- **Provincial QC** : PLQ, PQ, CAQ, QS

**Colonnes** :
```
date
party                       # Nom du parti
weighted_mentions           # Mentions pondérées
weighted_score              # Score pondéré
pass                        # am/pm (day seulement)
tag
```

#### C. Association manchettes-enjeux

**Raffineur** : `radar-headlines-issues.R`

**Output** : `headlines_issues_day/week/month`

Associe chaque manchette à ses enjeux principaux pour permettre le drill-down.

---

### Étape 5 : Raffineurs tertiaires

#### A. Manchette des manchettes

**Raffineur** : `radar-headline-of-headlines.R`

**Horaire** : 00:28, 04:28, 08:28, 12:28, 16:28, 20:28 UTC

**Input** : `salient_index`

**Output** : `headline_of_headlines`

**Fonction** : Sélectionne l'objet le plus saillant de chaque bloc 4h et génère un titre éditorial via LLM.

**Colonnes** :
```
country_id
time_block
objects                     # Liste des objets saillants
title                       # Titre généré
text                        # Texte explicatif
main_issue                  # Enjeu principal
tag
```

#### B. Hot 20 hebdomadaire

**Raffineur** : `radar-hot-20.R`

**Horaire** : Vendredis 16:30 UTC

**Input** : `salient_index` (agrégé sur 7 jours)

**Output** :
- `hot_20_headlines` (datamart)
- PNG + HTML tables → Slack #02_radar_plus_hot_20

**Fonction** : Classement des 20 objets les plus saillants de la semaine pour QC, CAN, USA.

#### C. Reflets médiatiques (LLM)

**Raffineurs** :
- `radar-reflet-daily-weekly.R` : 08:25, 12:25, 16:25 UTC (quotidien) + 16:28 UTC (hebdo)
- `radar-reflet-monthly.R` : 16:30 UTC (mensuel)

**Inputs** : `issues_score_*`, `headlines_issues_*`

**Outputs** : `reflet_day/week/month`

**Fonction** : Génère des résumés textuels des enjeux via Claude, style journalistique.

**Colonnes** :
```
issue                       # Enjeu analysé
summary                     # Texte généré par LLM
source_tag                  # Version source
pass                        # am/pm (day seulement)
tag
```

---

### Étape 6 : Publication frontend

**Raffineur** : `vitrine-graph-data.R`

**Horaire** : 04:39, 08:39, 12:39, 16:39, 20:39 UTC

**Inputs** : Toutes les tables finales

**Outputs** : Fichiers JSON publiés sur S3

**Fichiers générés** :
```
data/refined/day/
  - headline_of_headlines.json
  - issues_score_day.json
  - federal_parties_score_day.json
  - provincial_parties_score_day.json
  - reflet_day.json

data/refined/week/
  - issues_score_week.json
  - federal_parties_score_week.json
  - provincial_parties_score_week.json
  - reflet_week.json

data/refined/month/
  - issues_score_month.json
  - federal_parties_score_month.json
  - provincial_parties_score_month.json
  - reflet_month.json
```

Ces JSON sont consommés par le frontend de la Vitrine Démocratique.

---

## 🔧 Système SONAR (monitoring)

**Objectif** : Surveiller la qualité du scraping (14 derniers jours)

### Raffineur SONAR

**Horaire** : 12:00 UTC (quotidien)

**Input** : `r-media-frontpages` (datawarehouse)

**Output** : `sonar-data_quality_14_days` (datamart `sonar`)

**Métriques suivies** (par média, par jour) :
- `fp_*` : Nombre de frontpages scrapées
- `uh_*` : Nombre de unique headlines
- `body_*` : Articles avec body
- `title_*` : Articles avec title
- `author_*` : Articles avec author
- `words_*` : Nombre total de mots

**Structure** : 84 colonnes de données (14 jours × 6 métriques) + 1 colonne `media`

### Heatmaps SONAR

**Raffineur** : `sonar-heatmap.R`

**Horaire** : Mercredis 12:30 UTC

**Output** : 6 PNG heatmaps → Slack #02_radar_plus_sonar

**Visualisations** :
1. Frontpages heatmap
2. Unique headlines heatmap
3. Body text heatmap
4. Title heatmap
5. Author heatmap
6. Word count heatmap

---

## 🗄️ Accès aux datamarts (pour analyses RADAR+)

### Via le package `tube`

```r
library(tube)
library(dplyr)

# Connexion au datamart DEV
condm <- ellipse_connect("DEV", "datamarts")

# Query avec syntaxe dplyr
df <- ellipse_query(condm, "vitrine_datamart-salient_headlines_objects") |>
  filter(headline_stop >= "2025-01-01") |>
  select(media_id, title, extracted_objects) |>
  collect()

# Déconnexion
ellipse_disconnect(condm)
```

### Tables disponibles

**Datamart `vitrine_datamart`** :
- `salient_headlines_objects` - Objets extraits (temps réel 4h)
- `salient_index` - Indices de saillance par blocs 4h
- `issues_score_day/week/month` - Scores enjeux
- `federal_parties_score_*` - Scores partis fédéraux
- `provincial_parties_score_*` - Scores partis provinciaux
- `headline_of_headlines` - Manchette des manchettes
- `reflet_day/week/month` - Reflets LLM
- `hot_20_headlines` - Top 20 hebdomadaire
- `headlines_issues_*` - Association manchettes-enjeux

**Datamart `sonar`** :
- `data_quality_14_days` - Monitoring qualité scraping

---

## 📊 Diagrammes de référence

Le diagramme complet du dataflow se trouve dans :
**`aws-refiners/docs/vitrine-dataflow-2025.drawio`**

Il contient 21 onglets documentant :
- Vue d'ensemble du workflow
- Pipelines par JSON final (13 onglets)
- Pipelines d'outputs visuels (7 onglets)

---

## 🔗 Ressources

- **Package tube** : https://github.com/ellipse-science/tube
- **Documentation complète** : `aws-refiners/docs/CLAUDE.md`
- **Code des raffineurs** : `aws-refiners/refiners/*/runtime.R`
