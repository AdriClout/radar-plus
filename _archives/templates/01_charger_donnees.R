################################################################################
# 📚 TEMPLATE - Chargement des Données RADAR+
#
# Ce template montre comment charger les différentes tables disponibles
# dans les datamarts de la Vitrine Démocratique.
#
# Copiez ce code comme point de départ pour vos analyses!
################################################################################

# ═══════════════════════════════════════════════════════════════════════════
# SETUP - Charger les utilitaires RADAR+
# ═══════════════════════════════════════════════════════════════════════════

library(dplyr)
library(lubridate)
library(ggplot2)
library(tube)

source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")

cat("\n📊 RADAR+ - Template de Chargement des Données\n\n")

# ═══════════════════════════════════════════════════════════════════════════
# DÉFINIR LA PÉRIODE D'ANALYSE
# ═══════════════════════════════════════════════════════════════════════════

# Option 1: Dates spécifiques
date_min <- as.Date("2025-01-01")
date_max <- as.Date("2025-01-31")

# Option 2: Période relative (7 derniers jours)
# date_max <- Sys.Date()
# date_min <- date_max - days(7)

# Option 3: Utiliser les helpers pour année/mois/semaine
# bounds <- get_period_bounds(2025, "year")
# date_min <- bounds$date_min
# date_max <- bounds$date_max

cat(sprintf("📅 Période: %s à %s\n\n", date_min, date_max))

# ═══════════════════════════════════════════════════════════════════════════
# CONNEXION AU DATAMART
# ═══════════════════════════════════════════════════════════════════════════

# Se connecter à DEV (données de test) ou PROD (données de production)
condm <- connect_datamart("DEV", "datamarts")

# ═══════════════════════════════════════════════════════════════════════════
# TABLE 1: OBJETS SAILLANTS (salient_headlines_objects)
# ═══════════════════════════════════════════════════════════════════════════
#
# Cette table contient TOUS les objets (personnes, lieux, événements, orgs)
# extraits des manchettes médiatiques par le LLM.
#
# 📊 Colonnes importantes:
#   - headline_start, headline_stop: Fenêtre temporelle 4h
#   - headline_minutes: Temps exact en Une (pour pondération)
#   - media_id: JDM, LAP, CNN, etc.
#   - country_id: QC, CAN, USA
#   - title, body: Contenu de l'article
#   - extracted_objects: JSON des objets extraits
#
# 💡 Utilisation: Pour analyser les objets bruts avant agrégation

cat("📦 Chargement des objets saillants...\n")

df_objects <- load_salient_objects(
  condm,
  date_min,
  date_max,
  country_id = "QC",      # Filtrer par pays (NULL = tous)
  media_id = NULL         # Filtrer par média (NULL = tous)
)

# Exemple: Top 10 objets les plus mentionnés
top_objects <- df_objects |>
  count(object_name, sort = TRUE) |>
  head(10)

print(top_objects)

# ═══════════════════════════════════════════════════════════════════════════
# TABLE 2: INDICE DE SAILLANCE (salient_index)
# ═══════════════════════════════════════════════════════════════════════════
#
# Cette table contient les SCORES DE SAILLANCE calculés par blocs de 4h.
#
# 📊 Colonnes importantes:
#   - country_id: QC, CAN, USA
#   - time_block: "00-04", "04-08", etc.
#   - object_name: Nom de l'objet
#   - salience_score: Score calculé (mentions × temps pondéré)
#   - mentions_count: Nombre de mentions
#
# 💡 Utilisation: Pour les analyses de saillance (c'est LA table principale!)

cat("\n📦 Chargement de l'indice de saillance...\n")

df_index <- load_salient_index(
  condm,
  date_min,
  date_max,
  country_id = "QC"       # NULL = tous les pays
)

# Exemple: Score total par objet
scores_totaux <- df_index |>
  group_by(object_name) |>
  summarise(
    score_total = sum(salience_score, na.rm = TRUE),
    mentions_total = sum(mentions_count, na.rm = TRUE),
    .groups = "drop"
  ) |>
  arrange(desc(score_total)) |>
  head(10)

print(scores_totaux)

# ═══════════════════════════════════════════════════════════════════════════
# TABLE 3: SCORES DES ENJEUX (issues_score_*)
# ═══════════════════════════════════════════════════════════════════════════
#
# Scores de saillance par enjeu politique (économie, santé, immigration, etc.)
#
# 📊 Tables disponibles:
#   - issues_score_day (quotidien, avec pass am/pm)
#   - issues_score_week (hebdomadaire)
#   - issues_score_month (mensuel)
#
# 📊 Colonnes:
#   - date: Date du score
#   - economy_and_labour, health, immigration, ... (une colonne par enjeu)
#   - pass: am/pm (seulement pour day)
#
# 💡 Utilisation: Pour analyser l'attention médiatique sur les enjeux

cat("\n📦 Chargement des scores d'enjeux (quotidien)...\n")

df_issues <- load_issues_score(
  condm,
  period = "day",         # "day", "week", ou "month"
  date_min,
  date_max
)

print(head(df_issues))

# ═══════════════════════════════════════════════════════════════════════════
# TABLE 4: SCORES DES PARTIS POLITIQUES (parties_score_*)
# ═══════════════════════════════════════════════════════════════════════════
#
# Scores de saillance des partis politiques (fédéral et provincial)
#
# 📊 Tables disponibles:
#   - federal_parties_score_day/week/month
#   - provincial_parties_score_day/week/month
#
# 📊 Colonnes:
#   - date: Date du score
#   - party: Nom du parti (PLQ, PQ, CAQ, LPC, CPC, etc.)
#   - weighted_mentions: Mentions pondérées
#   - weighted_score: Score pondéré
#
# 💡 Utilisation: Pour analyser la couverture médiatique des partis

cat("\n📦 Chargement des scores de partis (provinciaux, quotidien)...\n")

df_parties <- load_parties_score(
  condm,
  level = "provincial",   # "federal" ou "provincial"
  period = "day",         # "day", "week", ou "month"
  date_min,
  date_max
)

# Exemple: Top 3 partis par score moyen
top_parties <- df_parties |>
  group_by(party) |>
  summarise(score_moyen = mean(weighted_score, na.rm = TRUE), .groups = "drop") |>
  arrange(desc(score_moyen)) |>
  head(3)

print(top_parties)

# ═══════════════════════════════════════════════════════════════════════════
# TABLE 5: HOT 20 HEBDOMADAIRE (hot_20_headlines)
# ═══════════════════════════════════════════════════════════════════════════
#
# Classement des 20 objets les plus saillants de la semaine
#
# 📊 Colonnes:
#   - country_id: QC, CAN, USA
#   - week_start: Début de la semaine
#   - object_name: Nom de l'objet
#   - rank: Position (1-20)
#   - total_score: Score agrégé de la semaine
#
# 💡 Utilisation: Pour voir le Top 20 officiel de la semaine
# 🔄 Périodicité: Généré chaque vendredi à 16:30 UTC

cat("\n📦 Chargement du Hot 20...\n")

df_hot20 <- load_hot20(
  condm,
  date_min,
  date_max,
  country_id = "QC"
)

print(head(df_hot20, 20))

# ═══════════════════════════════════════════════════════════════════════════
# TABLE 6: REFLETS MÉDIATIQUES (reflet_*)
# ═══════════════════════════════════════════════════════════════════════════
#
# Résumés textuels générés par LLM (Claude) pour chaque enjeu
#
# 📊 Tables disponibles:
#   - reflet_day (quotidien, avec pass am/pm)
#   - reflet_week (hebdomadaire)
#   - reflet_month (mensuel)
#
# 📊 Colonnes:
#   - issue: Nom de l'enjeu
#   - summary: Texte généré par le LLM
#   - source_tag: Version source
#
# 💡 Utilisation: Pour obtenir des résumés narratifs des enjeux

cat("\n📦 Chargement des reflets (hebdomadaire)...\n")

df_reflets <- load_reflet(
  condm,
  period = "week",
  date_min,
  date_max
)

# Exemple: Afficher le résumé de l'enjeu "Santé"
reflet_sante <- df_reflets |>
  filter(issue == "health") |>
  select(date, summary)

if (nrow(reflet_sante) > 0) {
  cat("\n📰 Reflet - Santé:\n")
  cat(reflet_sante$summary[1], "\n")
}

# ═══════════════════════════════════════════════════════════════════════════
# DÉCONNEXION
# ═══════════════════════════════════════════════════════════════════════════

disconnect_datamart(condm)

# ═══════════════════════════════════════════════════════════════════════════
# UTILISER LE CACHE POUR ÉVITER RECHARGEMENTS
# ═══════════════════════════════════════════════════════════════════════════
#
# Pour les analyses longues, utilisez le système de cache:

# cache_file <- "data/cache/mon_analyse.rds"
# 
# df <- load_with_cache(cache_file, function() {
#   condm <- connect_datamart("DEV", "datamarts")
#   data <- load_salient_index(condm, date_min, date_max, "QC")
#   disconnect_datamart(condm)
#   return(data)
# })

# ═══════════════════════════════════════════════════════════════════════════
# FONCTION HELPER COMPLÈTE AVEC CACHE (HOT 20)
# ═══════════════════════════════════════════════════════════════════════════
#
# La fonction load_hot20_data() charge automatiquement toutes les données
# nécessaires pour une analyse Hot 20, avec cache intégré:

# data <- load_hot20_data(
#   year = 2025,
#   edition = "QC",
#   cache_dir = "data/cache",
#   force_reload = FALSE
# )
# 
# # Contient:
# # - data$objects (salient_headlines_objects)
# # - data$index (salient_index)
# # - data$year, data$edition, data$date_min, data$date_max

cat("\n✅ Template terminé! Toutes les tables ont été chargées.\n")
cat("\n💡 Copiez ce code et adaptez-le pour votre analyse.\n\n")
