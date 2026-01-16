################################################################################
# 📊 TEMPLATE - Analyse Complète RADAR+
#
# Template d'analyse complète qui montre:
# 1. Chargement des données
# 2. Traitement et calculs
# 3. Visualisations
# 4. Export des résultats
#
# Adapté de: exemple_top10.R
################################################################################

# ═══════════════════════════════════════════════════════════════════════════
# 📋 MÉTADONNÉES DE L'ANALYSE
# ═══════════════════════════════════════════════════════════════════════════

TITRE_ANALYSE <- "Votre Titre d'Analyse"
AUTEUR <- "Votre Nom"
DATE_ANALYSE <- Sys.Date()
DESCRIPTION <- "Description courte de ce que fait cette analyse"

cat("\n")
cat("═══════════════════════════════════════════════════════════════\n")
cat(sprintf("  %s\n", TITRE_ANALYSE))
cat("═══════════════════════════════════════════════════════════════\n")
cat(sprintf("  Auteur: %s\n", AUTEUR))
cat(sprintf("  Date: %s\n", DATE_ANALYSE))
cat(sprintf("  Description: %s\n", DESCRIPTION))
cat("═══════════════════════════════════════════════════════════════\n\n")

# ═══════════════════════════════════════════════════════════════════════════
# 1️⃣ SETUP - Charger les librairies et utilitaires
# ═══════════════════════════════════════════════════════════════════════════

library(dplyr)
library(tidyr)
library(lubridate)
library(ggplot2)
library(scales)
library(tube)

source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")

# Démarrer le timer
timer <- start_timer()

# Créer les dossiers de sortie
ensure_dirs(c(
  "outputs/html",
  "outputs/visualizations",
  "outputs/exports"
))

# ═══════════════════════════════════════════════════════════════════════════
# 2️⃣ CONFIGURATION - Définir les paramètres de l'analyse
# ═══════════════════════════════════════════════════════════════════════════

# Période d'analyse
DATE_MIN <- as.Date("2025-01-01")
DATE_MAX <- as.Date("2025-01-31")

# Édition (QC, CAN, USA)
EDITION <- "QC"

# Médias à analyser (NULL = tous)
MEDIAS <- MEDIAS_BY_EDITION[[EDITION]]

# Nombre d'objets dans le Top N
TOP_N <- 10

cat(sprintf("📅 Période: %s à %s\n", DATE_MIN, DATE_MAX))
cat(sprintf("🌍 Édition: %s\n", EDITION))
cat(sprintf("📰 Médias: %s\n", paste(MEDIAS, collapse = ", ")))
cat(sprintf("🏆 Top: %d objets\n\n", TOP_N))

# ═══════════════════════════════════════════════════════════════════════════
# 3️⃣ CHARGEMENT DES DONNÉES
# ═══════════════════════════════════════════════════════════════════════════

cat("📦 Chargement des données...\n\n")

# Option A: Charger directement depuis AWS
condm <- connect_datamart("DEV", "datamarts")

df_index <- load_salient_index(
  condm,
  DATE_MIN,
  DATE_MAX,
  country_id = EDITION
)

disconnect_datamart(condm)

# Option B: Utiliser le cache (recommandé pour analyses répétées)
# cache_file <- sprintf("data/cache/analyse_%s_%s_%s.rds", 
#                       EDITION, DATE_MIN, DATE_MAX)
# 
# df_index <- load_with_cache(cache_file, function() {
#   condm <- connect_datamart("DEV", "datamarts")
#   data <- load_salient_index(condm, DATE_MIN, DATE_MAX, EDITION)
#   disconnect_datamart(condm)
#   return(data)
# })

# ═══════════════════════════════════════════════════════════════════════════
# 4️⃣ TRAITEMENT - Calculer les métriques
# ═══════════════════════════════════════════════════════════════════════════

cat("⚙️  Traitement des données...\n\n")

# Calculer le score total par objet
df_top <- df_index |>
  group_by(object_name) |>
  summarise(
    score_total = sum(salience_score, na.rm = TRUE),
    mentions_total = sum(mentions_count, na.rm = TRUE),
    nb_blocs = n(),  # Nombre de blocs 4h où l'objet apparaît
    .groups = "drop"
  ) |>
  arrange(desc(score_total)) |>
  head(TOP_N) |>
  mutate(
    rank = row_number(),
    score_pct = score_total / sum(score_total) * 100
  )

# Calculer des métriques additionnelles (optionnel)
df_top <- df_top |>
  mutate(
    score_moyen_par_bloc = score_total / nb_blocs,
    mentions_moyennes = mentions_total / nb_blocs
  )

# ═══════════════════════════════════════════════════════════════════════════
# 5️⃣ AFFICHAGE - Résultats dans la console
# ═══════════════════════════════════════════════════════════════════════════

cat(sprintf("\n📊 Top %d Objets les Plus Saillants (%s)\n", TOP_N, EDITION))
cat(sprintf("   Période: %s à %s\n\n", DATE_MIN, DATE_MAX))

for (i in 1:nrow(df_top)) {
  cat(sprintf(
    "%2d. %-30s | Score: %8s | Mentions: %5d | %5.1f%%\n",
    df_top$rank[i],
    df_top$object_name[i],
    format_number(df_top$score_total[i]),
    df_top$mentions_total[i],
    df_top$score_pct[i]
  ))
}

# ═══════════════════════════════════════════════════════════════════════════
# 6️⃣ VISUALISATION 1 - Graphique à barres
# ═══════════════════════════════════════════════════════════════════════════

cat("\n📊 Création des visualisations...\n\n")

plot1 <- ggplot(df_top, aes(x = reorder(object_name, score_total), 
                            y = score_total)) +
  geom_col(fill = COLORS$editions[EDITION]) +
  geom_text(
    aes(label = format_number(score_total)), 
    hjust = -0.1, 
    size = 3.5,
    color = "gray30"
  ) +
  coord_flip() +
  labs(
    title = sprintf("Top %d Objets les Plus Saillants - %s", 
                    TOP_N, 
                    names(COLORS$editions[EDITION])),
    subtitle = sprintf("Du %s au %s", DATE_MIN, DATE_MAX),
    x = NULL,
    y = "Score de Saillance",
    caption = "Source: RADAR+ Vitrine Démocratique | CLESSN"
  ) +
  theme_minimal(base_size = 13) +
  theme(
    plot.title = element_text(face = "bold", size = 16, hjust = 0),
    plot.subtitle = element_text(color = "gray40", size = 11),
    plot.caption = element_text(color = "gray50", size = 8, hjust = 1),
    panel.grid.major.y = element_blank(),
    panel.grid.minor = element_blank(),
    axis.text.y = element_text(size = 11)
  ) +
  scale_y_continuous(
    labels = scales::comma_format(),
    expand = expansion(mult = c(0, 0.15))
  )

# Sauvegarder
output_file1 <- sprintf("outputs/visualizations/top%d_%s_%s_%s.png", 
                        TOP_N, EDITION, DATE_MIN, DATE_MAX)
save_plot(plot1, output_file1, width = 10, height = 7)

# ═══════════════════════════════════════════════════════════════════════════
# 7️⃣ VISUALISATION 2 - Graphique avec mentions (optionnel)
# ═══════════════════════════════════════════════════════════════════════════

# Préparer les données pour double axe (score et mentions)
df_top_long <- df_top |>
  select(object_name, score_total, mentions_total) |>
  tidyr::pivot_longer(
    cols = c(score_total, mentions_total),
    names_to = "metric",
    values_to = "value"
  ) |>
  mutate(
    metric_label = ifelse(metric == "score_total", 
                          "Score de Saillance", 
                          "Nombre de Mentions")
  )

plot2 <- ggplot(df_top_long, 
                aes(x = reorder(object_name, value), 
                    y = value, 
                    fill = metric_label)) +
  geom_col(position = "dodge") +
  coord_flip() +
  scale_fill_manual(values = c("Score de Saillance" = COLORS$editions[EDITION],
                                "Nombre de Mentions" = "gray60")) +
  labs(
    title = sprintf("Top %d - Score vs Mentions (%s)", TOP_N, EDITION),
    subtitle = sprintf("Du %s au %s", DATE_MIN, DATE_MAX),
    x = NULL,
    y = "Valeur",
    fill = "Métrique",
    caption = "Source: RADAR+ | CLESSN"
  ) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title = element_text(face = "bold", size = 14),
    legend.position = "bottom"
  )

output_file2 <- sprintf("outputs/visualizations/top%d_metrics_%s_%s_%s.png", 
                        TOP_N, EDITION, DATE_MIN, DATE_MAX)
save_plot(plot2, output_file2, width = 10, height = 7)

# ═══════════════════════════════════════════════════════════════════════════
# 8️⃣ EXPORT - Sauvegarder les résultats
# ═══════════════════════════════════════════════════════════════════════════

cat("\n💾 Export des résultats...\n\n")

# Export CSV
export_file <- sprintf("outputs/exports/top%d_%s_%s_%s.csv", 
                       TOP_N, EDITION, DATE_MIN, DATE_MAX)
write.csv(df_top, export_file, row.names = FALSE)
log_msg(sprintf("Export CSV: %s", export_file))

# Export RDS (pour réutilisation en R)
export_rds <- sprintf("outputs/exports/top%d_%s_%s_%s.rds", 
                      TOP_N, EDITION, DATE_MIN, DATE_MAX)
saveRDS(df_top, export_rds)
log_msg(sprintf("Export RDS: %s", export_rds))

# ═══════════════════════════════════════════════════════════════════════════
# 9️⃣ RÉSUMÉ - Statistiques finales
# ═══════════════════════════════════════════════════════════════════════════

cat("\n")
cat("═══════════════════════════════════════════════════════════════\n")
cat("  📈 RÉSUMÉ DE L'ANALYSE\n")
cat("═══════════════════════════════════════════════════════════════\n\n")

cat(sprintf("  Période analysée: %d jours\n", 
            as.numeric(DATE_MAX - DATE_MIN)))
cat(sprintf("  Nombre d'objets total: %d\n", 
            length(unique(df_index$object_name))))
cat(sprintf("  Top %d sélectionné: %d objets\n", TOP_N, nrow(df_top)))
cat(sprintf("  Score total (top %d): %s\n", 
            TOP_N, format_number(sum(df_top$score_total))))
cat(sprintf("  Mentions totales: %s\n", 
            format_number(sum(df_top$mentions_total))))

cat("\n")
cat(sprintf("  🥇 #1: %s (score: %s)\n", 
            df_top$object_name[1], 
            format_number(df_top$score_total[1])))
cat(sprintf("  🥈 #2: %s (score: %s)\n", 
            df_top$object_name[2], 
            format_number(df_top$score_total[2])))
cat(sprintf("  🥉 #3: %s (score: %s)\n", 
            df_top$object_name[3], 
            format_number(df_top$score_total[3])))

cat("\n")
cat("  📁 Fichiers générés:\n")
cat(sprintf("    • %s\n", output_file1))
cat(sprintf("    • %s\n", output_file2))
cat(sprintf("    • %s\n", export_file))

cat("\n")
duration <- timer()
cat(sprintf("  ⏱️  Durée d'exécution: %.1f secondes\n", duration))
cat("\n")
cat("═══════════════════════════════════════════════════════════════\n")
cat("  ✅ ANALYSE TERMINÉE!\n")
cat("═══════════════════════════════════════════════════════════════\n\n")

# ═══════════════════════════════════════════════════════════════════════════
# 🎯 PROCHAINES ÉTAPES SUGGÉRÉES
# ═══════════════════════════════════════════════════════════════════════════
#
# 1. Analyser l'évolution temporelle:
#    - Créer un line chart avec score par jour/semaine
#
# 2. Comparer les éditions:
#    - Exécuter cette analyse pour QC, CAN, USA
#    - Faire un graphique de convergence
#
# 3. Approfondir un objet spécifique:
#    - Filtrer df_index pour un objet précis
#    - Analyser sa présence par média, par bloc horaire
#
# 4. Analyser les co-occurrences:
#    - Charger salient_headlines_objects
#    - Créer un réseau de co-occurrence
#
# 5. Intégrer les enjeux:
#    - Charger headlines_issues_*
#    - Voir quels enjeux sont associés au top 10
