# 🎯 RADAR+ en 5 Minutes

> Guide ultra-concis pour comprendre le système RADAR+ de saillance médiatique

---

## Qu'est-ce que RADAR+?

**RADAR+** mesure l'**attention médiatique** accordée aux objets (personnes, lieux, événements) dans l'espace public canadien.

**Comment?** En analysant automatiquement les manchettes de 15 médias d'information, 24/7.

---

## 📰 Les Données

### 15 Médias Suivis

| Région | Médias | Langue |
|--------|--------|--------|
| **QC** (6) | JDM, LAP, LED, RCI, TVA, MG | 🇫🇷 Français |
| **CAN** (7) | CBC, CTV, GN, GAM, NP, TTS, VS | 🇬🇧 Anglais |
| **USA** (2) | CNN, FXN | 🇬🇧 Anglais |

### Collecte

- **Fréquence**: Toutes les 4 heures
- **Horaires**: 00:03, 04:03, 08:03, 12:03, 16:03, 20:03 UTC
- **Méthode**: Scraping automatique (GLUE_JOB)

---

## 🔄 Le Pipeline (simplifié)

```
1. SCRAPER        → Collecte les manchettes toutes les 4h
                     Table: r-media-headlines

2. EXTRACTOR      → Extrait les objets (Claude LLM)
                     Table: salient_headlines_objects
                     Ex: "Donald Trump", "Gaza", "Ottawa"

3. CALCULATOR     → Calcule les scores de saillance
                     Table: salient_index
                     Score = mentions × temps en Une

4. AGGREGATORS    → Génère analyses quotidiennes/hebdo/mensuelles
                     Tables: issues_score_*, parties_score_*, reflet_*

5. PUBLISHER      → Publie les JSON pour le frontend
                     Outputs: JSON sur S3
```

---

## 📊 Les Tables Essentielles

| Table | Contenu | Utilité |
|-------|---------|---------|
| **salient_index** | Scores de saillance par objet et bloc 4h | 🎯 **LA** table principale pour analyses |
| salient_headlines_objects | Objets bruts extraits des manchettes | Pour analyses détaillées |
| issues_score_* | Scores des enjeux (économie, santé, etc.) | Analyses thématiques |
| parties_score_* | Scores des partis politiques | Couverture politique |
| hot_20_headlines | Top 20 hebdomadaire officiel | Classements |
| reflet_* | Résumés LLM par enjeu | Narratifs |

---

## 🧮 La Métrique Principale: Score de Saillance

### Formule

```
Score = (Nombre de mentions) × (Temps pondéré en Une)
```

### Exemple

```
"Donald Trump" durant la semaine du 6-12 janvier 2025:

- Mentions: 50 manchettes
- Temps pondéré: 200 unités normalisées

→ Score hebdomadaire = 50 × 200 = 10,000 points
```

### Pourquoi Pondéré?

Pour comparer équitablement:
- Un journal (1 édition/jour) vs
- Un site web (MAJ continues)

---

## 💻 Utiliser les Données en R

### Setup Minimal

```r
# 1. Charger les utilitaires
source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")

# 2. Se connecter
condm <- connect_datamart("DEV", "datamarts")

# 3. Charger les données
df <- load_salient_index(
  condm,
  date_min = "2025-01-01",
  date_max = "2025-01-31",
  country_id = "QC"
)

# 4. Déconnexion
disconnect_datamart(condm)
```

### Analyse Simple

```r
# Top 10 objets du mois
top10 <- df |>
  group_by(object_name) |>
  summarise(score_total = sum(salience_score)) |>
  arrange(desc(score_total)) |>
  head(10)

print(top10)
```

---

## 🎨 Les Raffineurs (pour comprendre l'architecture)

Les **raffineurs** sont des scripts R qui tournent automatiquement sur AWS Lambda.

### Raffineurs Primaires (toutes les 4h)

- `salient-objects` → Extrait les objets des manchettes
- `salient-index` → Calcule les scores de saillance

### Raffineurs Secondaires (quotidiens)

- `issues-score` → Scores des enjeux
- `party-score` → Scores des partis
- `headline-of-headlines` → Manchette des manchettes

### Raffineurs Hebdomadaires

- `hot-20` → Top 20 de la semaine (vendredi 16:30 UTC)
- `reflet-weekly` → Résumés hebdomadaires

### Raffineur de Publication (5×/jour)

- `vitrine-graph-data` → Génère tous les JSON pour le frontend

---

## 📖 Pour Aller Plus Loin

| Doc | Quand l'utiliser? |
|-----|-------------------|
| `docs/QUICKSTART.md` | Premier setup (5 min) |
| `docs/METRIQUES.md` | Comprendre les calculs en détail |
| `docs/SOURCES.md` | Détails sur chaque média |
| `docs/ARCHITECTURE.md` | Architecture complète du système |
| `templates/01_charger_donnees.R` | Exemples de code commentés |
| `templates/02_analyse_complete.R` | Template d'analyse complète |

---

## 🎯 Cas d'Usage Typiques

### 1. "Qui domine l'actualité cette semaine?"

```r
# Charger salient_index pour les 7 derniers jours
# Agréger par object_name
# Trier par score décroissant
# Top 10
```

### 2. "Comparer QC vs CAN"

```r
# Charger salient_index pour QC
# Charger salient_index pour CAN
# Trouver top 20 de chaque
# Calculer objets convergents/divergents
```

### 3. "Évolution d'un objet dans le temps"

```r
# Filtrer salient_index pour object_name = "Trump"
# Grouper par date
# Créer line chart
```

### 4. "Quels enjeux sont saillants?"

```r
# Charger issues_score_week
# Comparer les colonnes (economy, health, immigration, etc.)
```

---

## ⚡ Tips Rapides

1. **Toujours utiliser `salient_index`** pour les analyses de saillance
2. **Cache = ton ami** → `load_with_cache()` pour éviter rechargements AWS
3. **Période de 4h** → Les données sont par blocs (00-04, 04-08, etc.)
4. **QC ≠ Canada** → "QC" = médias québécois, "CAN" = médias canadiens anglais
5. **DEV vs PROD** → Tester sur DEV, analyser sur PROD

---

## 🆘 Aide

**Problème?** Consulter dans cet ordre:
1. `docs/QUICKSTART.md`
2. `templates/01_charger_donnees.R` (exemples commentés)
3. `CONTRIBUTING.md` (conventions)
4. Ouvrir une issue GitHub

---

**C'est tout!** Vous êtes prêt à analyser la saillance médiatique 🚀

Pour une analyse complète, voir `templates/02_analyse_complete.R`
