################################################################################
# Configuration - RADAR+ Analytics
#
# Ce fichier contient toutes les configurations et constantes utilisées
# dans les analyses RADAR+.
################################################################################

# Environnement AWS
ENVIRONNEMENT <- "DEV"  # "DEV" ou "PROD"

# Régions médiatiques
EDITIONS <- c("QC", "CAN", "USA")

# Médias par édition
MEDIAS_QC <- c("JDM", "LAP", "LED", "RCI", "TVA", "MG")
MEDIAS_CAN <- c("CBC", "CTV", "GN", "GAM", "NP", "TTS", "VS")
MEDIAS_USA <- c("CNN", "FXN")

# Mapping édition -> médias
MEDIAS_BY_EDITION <- list(
  QC = MEDIAS_QC,
  CAN = MEDIAS_CAN,
  USA = MEDIAS_USA
)

# Tous les médias
ALL_MEDIAS <- c(MEDIAS_QC, MEDIAS_CAN, MEDIAS_USA)

# Noms complets des médias (pour affichage)
MEDIA_NAMES <- list(
  JDM = "Journal de Montréal",
  LAP = "La Presse",
  LED = "Le Devoir",
  RCI = "Radio-Canada Info",
  TVA = "TVA Nouvelles",
  MG = "Métro Gatineau",
  CBC = "CBC News",
  CTV = "CTV News",
  GN = "Global News",
  GAM = "Globe and Mail",
  NP = "National Post",
  TTS = "Toronto Star",
  VS = "Vancouver Sun",
  CNN = "CNN",
  FXN = "Fox News"
)

# Mapping country_id
COUNTRY_MAPPING <- list(
  QC = "QC",
  CAN = "CAN",
  USA = "USA"
)

# Tables datamarts disponibles
DATAMARTS <- list(
  # Tables de base
  headlines_objects = "vitrine_datamart-salient_headlines_objects",
  salient_index = "vitrine_datamart-salient_index",
  
  # Scores enjeux
  issues_day = "vitrine_datamart-issues_score_day",
  issues_week = "vitrine_datamart-issues_score_week",
  issues_month = "vitrine_datamart-issues_score_month",
  
  # Scores partis fédéraux
  federal_parties_day = "vitrine_datamart-federal_parties_score_day",
  federal_parties_week = "vitrine_datamart-federal_parties_score_week",
  federal_parties_month = "vitrine_datamart-federal_parties_score_month",
  
  # Scores partis provinciaux
  provincial_parties_day = "vitrine_datamart-provincial_parties_score_day",
  provincial_parties_week = "vitrine_datamart-provincial_parties_score_week",
  provincial_parties_month = "vitrine_datamart-provincial_parties_score_month",
  
  # Autres tables
  headline_of_headlines = "vitrine_datamart-headline_of_headlines",
  reflet_day = "vitrine_datamart-reflet_day",
  reflet_week = "vitrine_datamart-reflet_week",
  reflet_month = "vitrine_datamart-reflet_month",
  hot_20 = "vitrine_datamart-hot_20_headlines",
  headlines_issues_day = "vitrine_datamart-headlines_issues_day",
  headlines_issues_week = "vitrine_datamart-headlines_issues_week",
  headlines_issues_month = "vitrine_datamart-headlines_issues_month",
  
  # SONAR
  sonar_quality = "sonar-data_quality_14_days"
)

# Palettes de couleurs
COLORS <- list(
  # Éditions
  editions = c(
    QC = "#0072B2",   # Bleu
    CAN = "#D55E00",  # Orange
    USA = "#CC79A7"   # Rose
  ),
  
  # Partis politiques QC
  parties_qc = c(
    PLQ = "#ED1B2E",   # Rouge
    PQ = "#004C9D",    # Bleu
    CAQ = "#00A9E0",   # Cyan
    QS = "#FF6600"     # Orange
  ),
  
  # Partis politiques fédéraux
  parties_fed = c(
    LPC = "#D71920",   # Rouge
    CPC = "#1A4782",   # Bleu
    NDP = "#F37021",   # Orange
    BQ = "#33B2CC",    # Cyan
    GPC = "#3D9B35"    # Vert
  ),
  
  # Visualisations (palette qualitative)
  viz_qualitative = c(
    "#E69F00", "#56B4E9", "#009E73", "#F0E442",
    "#0072B2", "#D55E00", "#CC79A7", "#999999",
    "#8B4513", "#2E8B57"
  ),
  
  # Heatmap divergente (pour convergence/divergence)
  heatmap_div = c("#2166AC", "#F7F7F7", "#B2182B"),
  
  # Séquentielle (pour scores, saillance)
  seq_blues = c("#EFF3FF", "#BDD7E7", "#6BAED6", "#3182BD", "#08519C"),
  seq_reds = c("#FEE5D9", "#FCAE91", "#FB6A4A", "#DE2D26", "#A50F15")
)

# Timezone
TZ_MONTREAL <- "America/Montreal"
TZ_UTC <- "UTC"

# Paramètres de visualisation par défaut
VIZ_DEFAULTS <- list(
  width = 12,
  height = 8,
  dpi = 300,
  theme = "minimal",
  base_size = 12
)

# Seuils pour analyses
THRESHOLDS <- list(
  # Hot 20
  top_n = 20,
  top_viz = 10,  # Top 10 pour les visualisations
  
  # Taux de croissance
  growth_threshold = 50,  # % minimum pour être considéré "forte croissance"
  
  # Persistance
  min_weeks = 2,  # Minimum de semaines pour être considéré "persistant"
  
  # Convergence
  jaccard_threshold = 0.3  # Seuil similarité Jaccard
)

# Messages de logging standardisés
MSG <- list(
  connect = "📡 Connexion au datamart %s...",
  disconnect = "❌ Déconnexion du datamart...",
  load_data = "📊 Chargement des données: %s",
  cache_found = "📦 Cache trouvé! Chargement depuis %s",
  cache_save = "💾 Sauvegarde du cache: %s",
  process = "⚙️  Traitement: %s",
  save_viz = "📊 Sauvegarde visualisation: %s",
  save_html = "📄 Sauvegarde HTML: %s",
  done = "✅ Terminé! Durée: %.1f secondes"
)
