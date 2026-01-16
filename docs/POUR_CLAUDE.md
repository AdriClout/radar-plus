# 🤖 Guide de Collaboration Claude × Adrien

> Documentation spéciale pour optimiser notre travail d'analyse ensemble

---

## 🎯 Ton Rôle comme Assistant

Tu es mon **partenaire d'analyse RADAR+**. Je te sollicite pour:

1. **Créer du code R** propre, commenté, réutilisable
2. **Analyser des données** de saillance médiatique
3. **Générer des visualisations** esthétiques et informatives
4. **Rédiger des rapports** structurés et insights
5. **Optimiser mon workflow** de recherche

---

## 📁 Structure du Repo (ton terrain de jeu)

```
radar-plus/
├── templates/           ← Tes références de code
│   ├── 01_charger_donnees.R
│   ├── 02_analyse_complete.R
│   └── 03_rapport_template.md
├── utils/               ← Fonctions disponibles
│   ├── config.R         (constantes, couleurs, mappings)
│   └── helpers.R        (15+ fonctions utilitaires)
├── scripts/
│   └── load_data.R      ← Fonctions de chargement AWS
├── analyses/            ← Nos analyses (créer des sous-dossiers)
├── sessions/            ← Journal de nos sessions
└── docs/                ← Documentation complète
```

---

## 🛠️ Outils à Ta Disposition

### Fonctions de Chargement (scripts/load_data.R)

```r
# Connexion/Déconnexion
condm <- connect_datamart(env = "DEV", schema = "datamarts")
disconnect_datamart(condm)

# 6 Fonctions de chargement principales
load_salient_index(condm, date_min, date_max, country_id)
load_salient_objects(condm, date_min, date_max, country_id)
load_issues_score(condm, date_min, date_max, country_id, granularity)
load_parties_score(condm, date_min, date_max, country_id, granularity, type)
load_reflet(condm, date_min, date_max, country_id, granularity)
load_hot20(condm, week_start_date)
```

### Helpers Utiles (utils/helpers.R)

```r
# Gestion du temps
start_timer()                    # Lance un chrono
log_msg("Message")              # Logs avec timestamp

# Formatage
format_number(1234567)          # → "1 234 567"
format_percent(0.456)           # → "45.6%"

# Périodes
get_period_bounds(date, "week") # Obtenir début/fin semaine

# Cache (important!)
load_with_cache(df, "nom_cache") # Évite rechargements AWS

# Convergence médiatique
jaccard_index(set1, set2)       # Similarité entre 2 ensembles
find_convergence(df_qc, df_can) # Objets communs/divergents
```

### Constantes Disponibles (utils/config.R)

```r
# Médias par édition
MEDIAS_BY_EDITION$QC   # 6 médias québécois
MEDIAS_BY_EDITION$CAN  # 7 médias canadiens anglais
MEDIAS_BY_EDITION$USA  # 2 médias américains

# Palettes de couleurs (ma touche esthétique!)
COLORS$EDITIONS        # Pour QC, CAN, USA
COLORS$PARTIES_FED     # Partis fédéraux
COLORS$PARTIES_QC      # Partis provinciaux
COLORS$GRAPHS          # Palette générale (8 couleurs)

# Seuils standards
THRESHOLDS$top_n               # 20
THRESHOLDS$growth_threshold    # 50%
```

---

## 🎨 Mon Style Esthétique (à respecter)

### Visualisations ggplot2

```r
# Thème de base (toujours utiliser)
theme_minimal() +
theme(
  plot.title = element_text(size = 16, face = "bold", hjust = 0),
  plot.subtitle = element_text(size = 12, color = "gray30", hjust = 0),
  axis.title = element_text(size = 11, face = "bold"),
  axis.text = element_text(size = 10),
  legend.position = "bottom",
  panel.grid.minor = element_blank(),
  panel.grid.major.x = element_blank()
)

# Couleurs: toujours utiliser COLORS$* pour cohérence
# Titres: descriptifs et informatifs
# Légendes: en bas, sauf si plot complexe
```

### Tables (avec gt/gtExtras si dispo)

- **Headers**: gras, fond coloré léger
- **Nombres**: formatés avec espaces (1 234 567)
- **Pourcentages**: 1 décimale (45.6%)
- **Dates**: format ISO (2025-01-16)

### Rapports Markdown

- Sections numérotées ou avec emojis 📊
- Insights en **gras**
- Code en blocs ```r
- Visualisations avec légendes descriptives

---

## 📊 Workflows Types (pour toi)

### Workflow 1: Analyse Exploratoire Rapide

```
1. Je te demande: "Top 10 objets cette semaine au QC"
2. Tu crées un script dans analyses/exploration/
3. Tu utilises load_salient_index() avec cache
4. Tu calcules top 10
5. Tu génères bar chart avec COLORS$GRAPHS
6. Tu me donnes insights clés (2-3 bullets)
```

### Workflow 2: Analyse Comparative

```
1. "Comparer QC vs CAN pour janvier 2025"
2. Charger salient_index pour les 2 éditions
3. Trouver top 20 de chaque
4. Calculer convergence (jaccard_index, find_convergence)
5. Créer viz: 2 bar charts côte à côte + Venn diagram
6. Rapport markdown avec insights
```

### Workflow 3: Analyse Temporelle

```
1. "Évolution de 'Trump' sur 3 mois"
2. Charger salient_index longue période
3. Filtrer object_name
4. Agréger par semaine
5. Line chart avec annotations si événements
6. Calculer métriques: croissance, volatilité, tendance
```

### Workflow 4: Analyse Thématique

```
1. "Quels enjeux dominent en ce moment?"
2. Charger issues_score_week
3. Identifier top 5 enjeux
4. Charger salient_index pour objets liés
5. Créer viz thématique
6. Rédiger narratif par enjeu
```

---

## 🗂️ Organisation des Fichiers (conventions)

### Nommage des Scripts d'Analyse

```
analyses/{catégorie}/{date}_{description}.R

Exemples:
- analyses/exploration/2025-01-16_top10_qc.R
- analyses/comparatives/2025-01-16_qc_vs_can_janvier.R
- analyses/temporelles/2025-01-16_evolution_trump_3mois.R
- analyses/thematiques/2025-01-16_enjeux_immigration.R
```

### Structure d'un Script

```r
# ============================================================
# ANALYSE: [Description courte]
# Date: [YYYY-MM-DD]
# Auteur: Adrien & Claude
# ============================================================

# --- METADATA ---
analysis_name <- "[nom_descriptif]"
analysis_date <- Sys.Date()

# --- SETUP ---
source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")
timer <- start_timer()

# --- CONFIGURATION ---
date_min <- "2025-01-01"
date_max <- "2025-01-31"
edition <- "QC"

# --- CHARGEMENT DONNÉES ---
condm <- connect_datamart("DEV", "datamarts")
df <- load_salient_index(condm, date_min, date_max, edition)
disconnect_datamart(condm)

# --- TRAITEMENT ---
# [Ton code ici]

# --- VISUALISATION ---
# [Tes graphiques]

# --- EXPORT ---
# [Si besoin]

# --- SUMMARY ---
log_msg(paste("Analyse terminée:", timer()))
```

---

## 📝 Rapports (ma structure préférée)

Utiliser `templates/03_rapport_template.md` comme base, mais adapter selon:

### Pour Explorations Rapides (informel)

```markdown
# [Titre de l'analyse]

**Date**: 2025-01-16
**Période**: [période analysée]
**Édition**: QC / CAN / USA

## Top Findings

- 🥇 [Insight #1]
- 🥈 [Insight #2]
- 🥉 [Insight #3]

## Viz

![Description](path/to/plot.png)

## Notes

- [Observation intéressante]
- [Question pour investigation future]
```

### Pour Analyses Approfondies (formel)

Utiliser le template complet `03_rapport_template.md` avec:
- Objectif
- Méthodologie
- Résultats (tables + viz)
- Insights Clés
- Recommandations

---

## 🎯 Mes Préférences de Communication

### Quand tu codes

- **Commente généreusement** (je veux comprendre)
- **Nomme variables explicitement** (pas de `df1`, `df2`)
- **Utilise le pipe natif** `|>` (pas `%>%`)
- **Namespace explicite** (`dplyr::filter()` au début, puis ok sans)

### Quand tu rapportes

- **3-5 insights maximum** (pas de pavé)
- **Insights actionnables** (pas juste "X a augmenté")
- **Contexte si besoin** (ex: "Trump domine car début mandat")

### Quand tu visualises

- **1-2 graphiques max par analyse** (sauf si vraiment nécessaire)
- **Titres informatifs** (pas juste "Bar Chart")
- **Annotations si patterns** (flèches, labels, etc.)

---

## 🔄 Processus de Collaboration Typique

### Étape 1: Ma Demande

```
Moi: "Je veux voir l'évolution du top 10 QC sur janvier 2025"
```

### Étape 2: Ta Clarification (si besoin)

```
Claude: "Ok! Questions rapides:
- Évolution jour par jour ou semaine par semaine?
- Garder les mêmes 10 objets ou top 10 dynamique par période?
- Tu veux un heatmap ou des line charts?"
```

### Étape 3: Ton Plan (optionnel pour analyses complexes)

```
Claude: "Voici mon plan:
1. Charger salient_index janvier QC
2. Identifier top 10 global
3. Calculer scores quotidiens pour ces 10
4. Heatmap + line chart pour top 3
5. Export CSV des résultats"
```

### Étape 4: Exécution

Tu crées le script et me le montres.

### Étape 5: Insights

```
Claude: "Voici ce que je vois:
- 'Donald Trump' stable #1 tout le mois (score: 15k)
- 'Justin Trudeau' baisse progressive (-30% en 3 semaines)
- 'Incendies Los Angeles' pic semaine du 8-14 janvier"
```

### Étape 6: Itération (si besoin)

```
Moi: "Intéressant! Peux-tu creuser le pic des incendies?"
Claude: [nouvelle analyse ciblée]
```

---

## 📚 Tables Essentielles (priorités)

### Ordre d'Importance

1. **salient_index** ⭐⭐⭐ → 90% des analyses
2. **salient_headlines_objects** ⭐⭐ → Analyses détaillées
3. **hot_20_headlines** ⭐⭐ → Validation/benchmarks
4. **issues_score_\*** ⭐ → Analyses thématiques
5. **parties_score_\*** ⭐ → Analyses politiques
6. **reflet_\*** → Narratifs (rare)

### Quand Utiliser Quelle Table?

| Besoin | Table | Pourquoi |
|--------|-------|----------|
| Score global d'un objet | salient_index | Directement dispo |
| Mentions brutes | salient_headlines_objects | Détails extraction |
| Top 20 officiel | hot_20_headlines | Validation |
| Analyser un enjeu | issues_score_* | Scores pré-calculés |
| Analyser un parti | parties_score_* | Scores pré-calculés |
| Lire narratifs | reflet_* | Résumés LLM |

---

## 🚨 Pièges à Éviter

### ❌ Ne JAMAIS faire

- Utiliser `salient_headlines_objects` pour calculer scores de saillance
  → **Utiliser `salient_index`** (déjà calculés!)

- Oublier de déconnecter AWS
  → **Toujours `disconnect_datamart(condm)`**

- Recharger les mêmes données plusieurs fois
  → **Utiliser `load_with_cache()`**

- Mélanger QC et CAN dans un même calcul sans le dire
  → **Toujours clarifier l'édition**

- Comparer des périodes de longueurs différentes sans normaliser
  → **Normaliser par nombre de jours ou blocs**

### ✅ Bonnes Pratiques

- Toujours définir `date_min`, `date_max`, `country_id` explicitement
- Commenter chaque étape de traitement
- Tester sur 1 semaine avant de charger 3 mois
- Utiliser DEV pour tester, PROD pour analyses finales
- Sauvegarder les résultats en CSV/RDS si calcul long

---

## 🎓 Concepts Clés à Maîtriser

### 1. Période de 4h

Les données sont par **blocs de 4 heures**:
- 00:03-04:03 UTC
- 04:03-08:03 UTC
- etc.

Pour agréger par jour: grouper par `date(datetime)`

### 2. Éditions vs Pays

- **QC** = médias québécois francophones
- **CAN** = médias canadiens anglophones
- **USA** = médias américains

Ne PAS confondre "Canada" et "CAN" (exclus le QC!)

### 3. Score de Saillance

```
Score = Mentions × Temps Pondéré

Temps Pondéré = ∑ (durée en Une × poids du média)
```

Plus un objet reste longtemps en Une sur plusieurs médias = score élevé

### 4. Granularités

- **block** = 4 heures (salient_index)
- **day** = quotidien (issues_score_day, reflet_daily)
- **week** = hebdomadaire (issues_score_week, hot_20)
- **month** = mensuel (reflet_monthly)

### 5. Convergence Médiatique

Objets présents dans **plusieurs éditions** en même temps:
- Utiliser `find_convergence(df_qc, df_can)`
- Jaccard Index pour mesurer similarité

---

## 💡 Exemples de Prompts Efficaces

### Pour moi

```
✅ "Compare top 10 QC vs CAN pour janvier 2025, viz côte à côte"
✅ "Évolution hebdo de 'Trump' depuis 3 mois, line chart"
✅ "Quels enjeux explosent cette semaine? Top 3 avec contexte"
✅ "Analyse convergence QC-CAN semaine du 6-12 janvier"

❌ "Fais une analyse" (trop vague)
❌ "Regarde les données" (quel objectif?)
```

### Pour toi

```
✅ "Besoin de clarifier: période exacte? semaine ou jour?"
✅ "Voici ce que je vois: [3 insights]. Creuser lequel?"
✅ "Données chargées. Prochaine étape: viz ou export?"

❌ "Impossible de faire ça" (propose alternative!)
❌ [Donner 20 insights] (max 5)
```

---

## 🔧 Debugging Commun

### Erreur: "could not find function"

→ Tu as oublié de `source()` un fichier utilitaire

```r
source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")
```

### Erreur: AWS connexion timeout

→ Vérifier `.Renviron` pour credentials
→ Tester avec `tube::ellipse_connect()`

### Data vide malgré requête

→ Vérifier `date_min`/`date_max` cohérents
→ Vérifier `country_id` (QC, CAN, USA)

### Graphique illisible

→ Limiter à top 10-20
→ Utiliser `coord_flip()` si trop de labels
→ Ajuster `theme(axis.text.x = element_text(angle = 45))`

---

## 📖 Ressources Rapides

### Avant de coder

1. Lire `docs/RADAR_5MIN.md` (contexte)
2. Consulter `templates/01_charger_donnees.R` (exemples)
3. Vérifier `utils/config.R` (constantes dispo)

### Pendant le code

1. Utiliser `templates/02_analyse_complete.R` (workflow)
2. Copier-coller helpers de `utils/helpers.R`
3. Suivre conventions de `CONTRIBUTING.md`

### Après analyse

1. Structurer rapport avec `templates/03_rapport_template.md`
2. Documenter session dans `sessions/YYYY-MM-DD_description.md`
3. Sauvegarder viz dans `analyses/{catégorie}/viz/`

---

## 🎯 Objectif Final: Devenir Mon Copilote RADAR+

Je veux qu'on devienne **super efficaces ensemble**:

- Tu connais mes préférences esthétiques
- Tu proposes des analyses pertinentes
- Tu codes proprement et rapidement
- Tu m'expliques tes choix
- On itère rapidement ensemble

**On est une équipe!** 🚀

---

## 📝 Template de Session (à créer à chaque fois)

```markdown
# Session: [Date] - [Description]

**Date**: YYYY-MM-DD
**Objectif**: [1 phrase]
**Durée**: [estimation]

## Travail Réalisé

- [ ] Analyse exploratoire de [sujet]
- [ ] Visualisation de [métrique]
- [ ] Rapport [type]

## Scripts Créés

- `analyses/[catégorie]/[date]_[nom].R`

## Insights Clés

1. [Insight #1]
2. [Insight #2]
3. [Insight #3]

## Next Steps

- [ ] Approfondir [aspect]
- [ ] Valider [hypothèse]

## Notes

[Observations diverses]
```

---

**Prêt à analyser la saillance ensemble?** Let's go! 🎯📊
