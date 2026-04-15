# RADAR+ • Analyse de Saillance Médiatique

Outil pour analyser la saillance médiatique d'événements au Québec et au Canada via les données de la Vitrine Démocratique.

---

## 🚀 Démarrage Rapide

### 1. Setup (première fois seulement)

```bash
# Configurer credentials AWS
cp .Renviron.example ~/.Renviron
# Éditer ~/.Renviron avec vos credentials AWS

# Installer packages R (si besoin)
install.packages(c("dplyr", "ggplot2", "scales"))
remotes::install_github("clessn/tube")
```

### 2. Créer une Analyse

```bash
# Copier un template
cp templates/02_analyse_complete.R mon_analyse.R

# Éditer pour votre événement
nano mon_analyse.R  # Adapter dates, objets, éditions

# Exécuter
Rscript mon_analyse.R
```

### 3. Explorer les Résultats

Les résultats (PNG, RDS, HTML) sont générés dans le dossier de votre analyse.

---

## 📁 Structure du Repo (Très Simple)

```
radar-plus/
├── analyses/                              # Vos analyses
│   └── 2026_01_16_saillance_legault_demission/
│       ├── analyse_legault.R              # Script d'analyse
│       ├── rapport.html                   # Dashboard interactif
│       ├── graphique_*.png                # Visualisations
│       └── donnees.rds                    # Export données
│
├── templates/                             # Templates R
│   ├── 01_charger_donnees.R               # Charger données AWS
│   ├── 02_analyse_complete.R              # Analyse complète 7-étapes
│   └── 04_visualizations_gallery.R        # 7 types de graphiques
│
├── docs/                                  # Documentation
│   ├── RADAR_5MIN.md                      # Vue d'ensemble (5 min)
│   ├── ARCHITECTURE.md                    # Détails Vitrine Démocratique
│   ├── METRIQUES.md                       # Calculs & métriques
│   ├── SOURCES.md                         # Liste médias 15 sources
│   └── POUR_CLAUDE.md                     # Guide IA collaboration
│
└── README.md (ce fichier)
```

---

## 📚 Documentation

| Document | Contenu |
|----------|---------|
| `docs/RADAR_5MIN.md` | Système en 5 minutes |
| `docs/ARCHITECTURE.md` | Architecture technique |
| `docs/METRIQUES.md` | Formules & calculs |
| `docs/SOURCES.md` | 15 médias (QC/CAN/USA) |
| `docs/POUR_CLAUDE.md` | Collaboration avec IA |

---

## 💾 Données

- **QC**: Québec (6 médias)
- **CAN**: Canada (7 médias)
- **USA**: États-Unis (2 médias)

**Politique**: Zéro stockage local. Données chargées d'AWS Athena uniquement.

---

## 🔧 Dépendances

- R ≥ 4.0.0
- `dplyr`, `ggplot2`, `scales`, `tube`
- Credentials AWS

---

**Status**: Production Ready ✅  
**Créé par**: Adrien & Claude  
**16 janvier 2026**

## 🌐 Hébergement (Primaire + Backup)

- **Primaire**: Netlify (`https://radarplus.org/`)
- **Backup**: GitHub Pages (`https://adriclout.github.io/radar-plus/`)

Pour SONAR:

- Primaire: `https://radarplus.org/sonar.html`
- Backup: `https://adriclout.github.io/radar-plus/sonar.html`

Le backup GitHub Pages est déployé automatiquement via `.github/workflows/deploy-github-pages.yml`.

## Gouvernance, CI et Sécurité

### Gouvernance des merges

- La branche `main` est protégée par ruleset GitHub.
- Les contributions passent par Pull Request (pas de push direct humain sur `main`).
- 1 approbation est requise, avec revue Code Owners et conversations résolues.
- Le check CI `quality-gate` est obligatoire avant fusion.

### Quality Gate (PR)

Le workflow `.github/workflows/pr-quality-gate.yml` exécute automatiquement:

- Validation JSON sur `site/*.json`.
- Vérification des liens internes statiques dans `site/*.html`.
- Lint des workflows GitHub Actions avec `actionlint`.

### Sécurité

- Politique de divulgation: voir `SECURITY.md`.
- Dépendances Actions surveillées par Dependabot: `.github/dependabot.yml`.
- Guide contribution (incluant règles sécurité): `CONTRIBUTING.md`.

### Politique d'accès aux données

- Principe: accès contrôlé, usage scientifique, pas de redistribution brute.
- Point d'entrée public: `site/acces-donnees.html`.

Le dossier `templates/` contient **4 templates essentiels** pour démarrer rapidement:

| Template | Description | Quand l'utiliser? |
|----------|-------------|-------------------|
| **01_charger_donnees.R** | Exemples de chargement des 6 tables principales | Première fois, référence |
| **02_analyse_complete.R** | Workflow complet (chargement → analyse → viz → export) | Analyses standards |
| **03_rapport_template.md** | Structure de rapport markdown | Documenter analyses |
| **04_visualizations_gallery.R** | 7 templates de graphiques (bar, line, heatmap, etc.) | Créer visualisations |

### Exemple Complet

Un exemple d'analyse **démonstrative complète** est disponible:

```r
# Voir: analyses/exemples/2026-01-16_demo_top10_qc.R
source("analyses/exemples/2026-01-16_demo_top10_qc.R")
```

**Outputs générés**:
- 📊 2 visualisations PNG (bar chart + évolution temporelle)
- 📄 1 rapport markdown complet
- 💾 Données CSV + RDS

**Rapport**: [`analyses/exemples/2026-01-16_demo_top10_qc_RAPPORT.md`](analyses/exemples/2026-01-16_demo_top10_qc_RAPPORT.md)

### Workflow Recommandé

1. **Copier un template** vers `analyses/{catégorie}/`
2. **Adapter** dates, édition, top_n selon besoin
3. **Exécuter** et générer visualisations
4. **Documenter** avec template de rapport
5. **Commiter** résultats



## 📊 Données et Métriques

### Tables Principales (Datamarts)

| Table | Utilité | Fréquence |
|-------|---------|-----------|
| **salient_index** ⭐ | Scores de saillance par objet (TABLE PRINCIPALE) | 4h |
| salient_headlines_objects | Objets bruts extraits des manchettes | 4h |
| hot_20_headlines | Top 20 hebdomadaire officiel | Hebdo |
| issues_score_* | Scores des enjeux (économie, santé, etc.) | Day/Week/Month |
| parties_score_* | Scores des partis politiques | Day/Week/Month |
| reflet_* | Résumés narratifs par LLM | Day/Week/Month |

**💡 Astuce**: Utiliser `salient_index` pour 90% des analyses. Voir [`templates/01_charger_donnees.R`](templates/01_charger_donnees.R) pour exemples.

### Médias Suivis (15 sources)

- **🇫🇷 QC** (6): JDM, LAP, LED, RCI, TVA, MG
- **🇬🇧 CAN** (7): CBC, CTV, GN, GAM, NP, TTS, VS  
- **🇺🇸 USA** (2): CNN, FXN

### Métriques Clés

- **Score de Saillance** = Mentions × Temps Pondéré en Une
- **Persistence** = % du temps où l'objet est présent
- **Croissance** = Variation du score période à période
- **Convergence** = Objets communs entre éditions (Jaccard Index)

📖 **Guide complet**: [`docs/METRIQUES.md`](docs/METRIQUES.md)



## 🛠️ Utilitaires Disponibles

### Configuration (`utils/config.R`)

```r
# Médias par édition
MEDIAS_BY_EDITION$QC   # c("JDM", "LAP", "LED", "RCI", "TVA", "MG")
MEDIAS_BY_EDITION$CAN  # c("CBC", "CTV", "GN", "GAM", "NP", "TTS", "VS")

# Palettes de couleurs
COLORS$EDITIONS        # QC, CAN, USA
COLORS$PARTIES_FED     # Partis fédéraux
COLORS$GRAPHS          # Palette générale (8 couleurs)

# Seuils standards
THRESHOLDS$top_n               # 20
THRESHOLDS$growth_threshold    # 50%
```

### Helpers (`utils/helpers.R`)

```r
# Gestion temps
start_timer()              # Chrono
log_msg("Message")        # Log avec timestamp

# Formatage
format_number(1234567)    # "1 234 567"
format_percent(0.456)     # "45.6%"

# Périodes
get_period_bounds(date, "week")  # Début/fin semaine

# Cache
load_with_cache(df, "nom")  # Évite rechargements AWS

# Convergence
find_convergence(df_qc, df_can)  # Objets communs/divergents
```

### Chargement Données (`scripts/load_data.R`)

```r
# Connexion
condm <- connect_datamart("DEV", "datamarts")

# 6 fonctions de chargement
load_salient_index(condm, date_min, date_max, country_id)
load_salient_objects(condm, ...)
load_issues_score(condm, ...)
load_parties_score(condm, ...)
load_reflet(condm, ...)
load_hot20(condm, week_start_date)

# Déconnexion
disconnect_datamart(condm)
```

📚 **Exemples d'usage**: Voir [`templates/01_charger_donnees.R`](templates/01_charger_donnees.R)



## 📝 Conventions et Bonnes Pratiques

### Style de Code

```r
# ✅ RECOMMANDÉ
source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")

# Pipe natif
df |> filter(...) |> mutate(...)

# Namespace explicite (au début)
dplyr::filter(df, ...)

# Connexion/Déconnexion
condm <- connect_datamart("DEV", "datamarts")
# ... travail ...
disconnect_datamart(condm)

# Cache pour éviter rechargements
df <- load_with_cache(df, "nom_cache")

# ❌ À ÉVITER
library(tidyverse)  # Trop large, préférer packages spécifiques
df %>% filter(...)  # Pipe magrittr (utiliser |>)
```

### Organisation Analyses

```
analyses/{catégorie}/{date}_{description}.R

Exemples:
analyses/exploration/2026-01-16_top10_qc.R
analyses/comparatives/2026-01-16_qc_vs_can.R
analyses/temporelles/2026-01-16_evolution_trump.R
```

### Structure Script Type

```r
# === METADATA ===
analysis_name <- "nom_analyse"
analysis_date <- Sys.Date()

# === SETUP ===
source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")
timer <- start_timer()

# === CONFIG ===
date_min <- "2026-01-01"
date_max <- "2026-01-31"
edition <- "QC"

# === DONNÉES ===
condm <- connect_datamart("DEV", "datamarts")
df <- load_salient_index(condm, date_min, date_max, edition)
disconnect_datamart(condm)

# === TRAITEMENT ===
# ...

# === VISUALISATION ===
# ...

# === EXPORT ===
# ...

# === SUMMARY ===
log_msg(paste("Terminé:", timer()))
```

📖 **Template complet**: [`templates/02_analyse_complete.R`](templates/02_analyse_complete.R)



## 📚 Documentation

### Guides Principaux

| Guide | Description | Temps |
|-------|-------------|-------|
| **[QUICKSTART.md](docs/QUICKSTART.md)** | Setup complet pas-à-pas | 5 min |
| **[RADAR_5MIN.md](docs/RADAR_5MIN.md)** | Guide ultra-concis RADAR+ | 5 min |
| **[POUR_CLAUDE.md](docs/POUR_CLAUDE.md)** | Guide collaboration IA | 10 min |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture Vitrine (pipeline, raffineurs) | 15 min |
| [METRIQUES.md](docs/METRIQUES.md) | Guide complet des métriques | 20 min |
| [SOURCES.md](docs/SOURCES.md) | Sources médias et datamarts | 5 min |
| [STRUCTURE.md](docs/STRUCTURE.md) | Structure détaillée du repo | 5 min |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Comment contribuer | 10 min |
| [RECAP.md](docs/RECAP.md) | Récapitulatif complet | 15 min |

### Templates Code

- [`templates/01_charger_donnees.R`](templates/01_charger_donnees.R) - Chargement des 6 tables
- [`templates/02_analyse_complete.R`](templates/02_analyse_complete.R) - Workflow complet
- [`templates/03_rapport_template.md`](templates/03_rapport_template.md) - Rapport markdown
- [`templates/04_visualizations_gallery.R`](templates/04_visualizations_gallery.R) - 7 types de graphiques

### Analyses Exemples

- [`analyses/exemples/2026-01-16_demo_top10_qc.R`](analyses/exemples/2026-01-16_demo_top10_qc.R) - Analyse démonstrative complète
- [`analyses/exemples/2026-01-16_demo_top10_qc_RAPPORT.md`](analyses/exemples/2026-01-16_demo_top10_qc_RAPPORT.md) - Rapport associé



## 🤝 Contribution et Workflow

### Workflow Recommandé

1. **📝 Session** : Créer `sessions/YYYY-MM-DD_description.md` (utiliser template)
2. **🔬 Exploration** : Développer dans `analyses/exploration/`
3. **📊 Production** : Migrer vers catégorie (`analyses/hot20/`, `analyses/partis/`, etc.)
4. **📚 Documentation** : Documenter dans session + mettre à jour docs si nécessaire
5. **💾 Commit** : Commiter avec message descriptif

### Structure Session

```markdown
# Session: [Date] - [Description]

**Objectif**: [1 phrase]

## Travail Réalisé
- [ ] Analyse de X
- [ ] Visualisation de Y

## Scripts Créés
- `analyses/catégorie/2026-01-16_nom.R`

## Insights Clés
1. [Insight]
2. [Insight]

## Next Steps
- [ ] Approfondir X
```

📄 **Template**: [`sessions/template.md`](sessions/template.md)

### Contribuer

Pour proposer une nouvelle analyse:
1. Fork ou créer branche
2. Utiliser templates comme base
3. Documenter dans session
4. Soumettre PR avec description claire



## 🚨 FAQ et Troubleshooting

### Erreur: "could not find function"

```r
# Solution: Charger les utilitaires
source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")
```

### Erreur: AWS connexion timeout

```r
# Vérifier .Renviron
usethis::edit_r_environ(scope = "project")

# Tester connexion
library(tube)
condm <- ellipse_connect("DEV", "datamarts")
```

### Data vide après requête

```r
# Vérifier dates cohérentes
date_min <- "2026-01-01"  # Format ISO
date_max <- "2026-01-31"

# Vérifier country_id
country_id <- "QC"  # Ou "CAN", "USA"
```

### Rechargement AWS lent

```r
# Utiliser le cache!
df <- load_with_cache(df, "nom_cache_descriptif")
```

### Graphique illisible

```r
# Limiter à top 10-20
df_top <- df |> slice(1:20)

# Rotation labels si besoin
theme(axis.text.x = element_text(angle = 45, hjust = 1))

# Flip coordonnées
p + coord_flip()
```

---

## 📄 License & Contact

**© CLESSN** - Usage interne uniquement

**Questions?** Consulter [POUR_CLAUDE.md](docs/POUR_CLAUDE.md) ou ouvrir une issue.

---

**Dernière mise à jour**: 2026-01-16  
**Version**: 2.0 (Restructuration complète avec templates)  
**Maintainer**: Adrien Cloutier