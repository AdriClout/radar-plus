# ============================================================
# ANALYSE: Démission François Legault - Impact Saillance
# Date: 2026-01-16
# Auteur: Adrien & Claude
# 
# Analyse d'événement: Impact de la démission du PM du Québec
# sur la saillance médiatique (16 janvier 2026)
# ============================================================

# --- METADATA ---
analysis_name <- "legault_resignation_impact"
analysis_date <- Sys.Date()
cat("\n")
cat("==========================================================\n")
cat("  ANALYSE: Démission François Legault - Impact Saillance\n")
cat("  Date:", format(analysis_date, "%Y-%m-%d"), "\n")
cat("==========================================================\n\n")

# --- SETUP ---
source("utils/config.R")
source("utils/helpers.R")
source("scripts/load_data.R")

library(ggplot2)
library(scales)
library(dplyr)
library(tidyr)

timer <- start_timer()

# --- CONFIGURATION ---
log_msg("Configuration de l'analyse")

# Événement: Démission Legault mercredi 15 janvier 2026
event_date <- as.Date("2026-01-15")
analysis_start <- event_date - 7  # 1 semaine avant
analysis_end <- as.Date("2026-01-16")  # Aujourd'hui

editions <- list(
  qc = "QC",
  can = "CAN"
)

cat(sprintf("  Événement: Démission François Legault\n"))
cat(sprintf("  Date: %s (mercredi)\n", event_date))
cat(sprintf("  Période analysée: %s au %s (8 jours)\n", analysis_start, analysis_end))
cat(sprintf("  Éditions: %s\n\n", paste(unlist(editions), collapse=", ")))

# --- CHARGEMENT DONNÉES ---
log_msg("Connexion au datamart PROD")

condm <- connect_datamart("PROD", "datamarts")

# Charger données QC
log_msg("Chargement données QC (8 jours)")
df_qc <- load_salient_index(
  con = condm,
  date_min = as.character(analysis_start),
  date_max = as.character(analysis_end),
  country_id = "QC"
)

# Charger données CAN
log_msg("Chargement données CAN (8 jours)")
df_can <- load_salient_index(
  con = condm,
  date_min = as.character(analysis_start),
  date_max = as.character(analysis_end),
  country_id = "CAN"
)

# Charger Hot 20 QC de cette semaine (semaine du 13-19 janvier)
log_msg("Chargement Hot 20 QC (semaine 13-19 janvier)")
df_hot20 <- load_hot20(condm, "2026-01-13")

disconnect_datamart(condm)

log_msg(sprintf("✅ Données chargées: %d lignes QC, %d lignes CAN", 
                nrow(df_qc), nrow(df_can)))

# --- TRAITEMENT: IMPACT DIRECT ---
log_msg("Analyse 1: Impact direct sur 'François Legault'")

legault_qc <- df_qc |>
  filter(tolower(object_name) == "françois legault" | 
         tolower(object_name) == "francois legault") |>
  mutate(date = as.Date(date_montreal_tz)) |>
  group_by(date) |>
  summarise(
    score_jour = sum(salience_score, na.rm = TRUE),
    n_blocs = n(),
    .groups = "drop"
  ) |>
  arrange(date)

cat("\n📊 FRANÇOIS LEGAULT - Évolution Quotidienne QC\n")
print(legault_qc)

# Score avant (15-14 jan) vs après (16-17 jan)
avant_event <- df_qc |>
  filter(tolower(object_name) %in% c("françois legault", "francois legault"),
         date_montreal_tz < as.character(event_date + hours(1))) |>
  pull(salience_score) |>
  sum(na.rm = TRUE)

apres_event <- df_qc |>
  filter(tolower(object_name) %in% c("françois legault", "francois legault"),
         date_montreal_tz >= as.character(event_date + hours(1))) |>
  pull(salience_score) |>
  sum(na.rm = TRUE)

pct_increase <- if(avant_event > 0) ((apres_event - avant_event) / avant_event) * 100 else 999

cat(sprintf("\n⚡ IMPACT ÉVÉNEMENT:\n"))
cat(sprintf("  Avant (13-14 jan): %s pts\n", format_number(round(avant_event))))
cat(sprintf("  Après (15-16 jan): %s pts\n", format_number(round(apres_event))))
cat(sprintf("  Augmentation: %+.0f%%\n\n", pct_increase))

# --- TRAITEMENT: OBJETS LIÉS ---
log_msg("Analyse 2: Objets liés à l'événement")

# Top 10 objets QC cette période
top_objects_qc <- df_qc |>
  group_by(object_name) |>
  summarise(
    score_total = sum(salience_score, na.rm = TRUE),
    n_mentions = n(),
    .groups = "drop"
  ) |>
  arrange(desc(score_total)) |>
  head(10)

cat("\n🏆 TOP 10 OBJETS QC (8 derniers jours)\n")
top_objects_qc_display <- top_objects_qc |>
  mutate(
    rang = row_number(),
    score = format_number(round(score_total)),
    mentions = n_mentions
  ) |>
  select(rang, object_name, score, mentions)
print(top_objects_qc_display)

# Vérifier si Legault est dans le top 10
legault_rank <- which(tolower(top_objects_qc$object_name) %in% 
                       c("françois legault", "francois legault"))
if(length(legault_rank) > 0) {
  cat(sprintf("\n✅ François Legault au rang #%d du Top 10 QC\n", legault_rank))
}

# --- TRAITEMENT: HOT 20 ---
log_msg("Analyse 3: Position dans Hot 20 officiel")

if(nrow(df_hot20) > 0) {
  hot20_qc <- df_hot20 |>
    filter(country_id == "QC") |>
    arrange(desc(salience_score)) |>
    head(20)
  
  legault_in_hot20 <- which(tolower(hot20_qc$object_name) %in% 
                             c("françois legault", "francois legault"))
  
  cat("\n📋 HOT 20 QC - SEMAINE 13-19 JANVIER\n")
  cat(sprintf("  Nombre d'objets: %d\n", nrow(hot20_qc)))
  
  if(length(legault_in_hot20) > 0) {
    legault_hot20 <- hot20_qc[legault_in_hot20[1], ]
    cat(sprintf("  📍 François Legault: Rang #%d\n", legault_in_hot20[1]))
    cat(sprintf("     Score: %s pts\n", format_number(round(legault_hot20$salience_score))))
  } else {
    cat(sprintf("  ❌ François Legault: Hors Top 20\n"))
  }
}

# --- TRAITEMENT: COMPARAISON QC vs CAN ---
log_msg("Analyse 4: Couverture QC vs CAN")

# Legault en QC vs CAN
legault_can <- df_can |>
  filter(tolower(object_name) %in% c("françois legault", "francois legault")) |>
  pull(salience_score) |>
  sum(na.rm = TRUE)

legault_qc_total <- df_qc |>
  filter(tolower(object_name) %in% c("françois legault", "francois legault")) |>
  pull(salience_score) |>
  sum(na.rm = TRUE)

ratio_qc_can <- if(legault_can > 0) legault_qc_total / legault_can else 999

cat(sprintf("\n🇨🇦 COMPARAISON QC vs CAN:\n"))
cat(sprintf("  Legault - Score QC: %s pts\n", format_number(round(legault_qc_total))))
cat(sprintf("  Legault - Score CAN: %s pts\n", format_number(round(legault_can))))
cat(sprintf("  Ratio QC/CAN: %.1fx (normal pour événement provincial)\n\n", ratio_qc_can))

# --- TRAITEMENT: ÉVÉNEMENTS COMPARABLES ---
log_msg("Analyse 5: Événements de saillance comparable")

# Chercher d'autres objets avec saillance similaire
major_objects <- df_qc |>
  group_by(object_name) |>
  summarise(
    score_total = sum(salience_score, na.rm = TRUE),
    .groups = "drop"
  ) |>
  filter(score_total >= legault_qc_total * 0.7) |>
  arrange(desc(score_total)) |>
  head(5)

cat("\n⚡ ÉVÉNEMENTS DE SAILLANCE COMPARABLE\n")
cat(sprintf("  (Score ≥ %.0f%% du score Legault)\n\n", 70))
for(i in 1:nrow(major_objects)) {
  cat(sprintf("  • %s: %s pts\n", 
              major_objects$object_name[i],
              format_number(round(major_objects$score_total[i]))))
}

# --- VISUALISATION 1: ÉVOLUTION LEGAULT ---
log_msg("Génération visualisation 1: Évolution Legault")

viz_data <- legault_qc
if(nrow(viz_data) > 0) {
  p1 <- ggplot(viz_data, aes(x = date, y = score_jour)) +
    geom_col(fill = COLORS$EDITIONS["QC"], alpha = 0.85) +
    geom_vline(xintercept = as.Date(event_date), 
               linetype = "dashed", color = "red", size = 1) +
    annotate("text", x = event_date, y = max(viz_data$score_jour) * 0.9,
             label = "Démission\n15 jan", hjust = -0.1, color = "red", 
             size = 3, fontface = "bold") +
    scale_y_continuous(labels = label_number(scale = 1, big.mark = " ")) +
    scale_x_date(date_breaks = "1 day", date_labels = "%d %b") +
    labs(
      title = "Impact de la Démission: Saillance de François Legault",
      subtitle = "Score quotidien • Québec • 9-16 janvier 2026",
      x = "Date",
      y = "Score de Saillance",
      caption = "Source: RADAR+ • Démission annoncée mercredi 15 janvier"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50"),
      axis.title = element_text(size = 11, face = "bold"),
      axis.text.x = element_text(angle = 45, hjust = 1),
      panel.grid.minor = element_blank()
    )
  
  ggsave("analyses/exploration/legault_resignation_evolution.png",
         plot = p1, width = 11, height = 6, dpi = 300)
  log_msg("✅ Visualisation 1 sauvegardée")
}

# --- VISUALISATION 2: TOP 10 QC ---
log_msg("Génération visualisation 2: Top 10 QC")

viz_top10 <- top_objects_qc |>
  arrange(score_total) |>
  mutate(object_name = factor(object_name, levels = object_name),
         is_legault = tolower(object_name) %in% c("françois legault", "francois legault"),
         score_fmt = format_number(round(score_total)))

p2 <- ggplot(viz_top10, aes(x = score_total, y = object_name, 
                             fill = is_legault)) +
  geom_col(alpha = 0.85) +
  geom_text(aes(label = score_fmt), hjust = -0.1, size = 3, color = "gray20") +
  scale_fill_manual(
    values = c("FALSE" = COLORS$GRAPHS[1], "TRUE" = "#e74c3c"),
    guide = "none"
  ) +
  scale_x_continuous(labels = label_number(scale = 1, big.mark = " "),
                     expand = expansion(mult = c(0, 0.15))) +
  labs(
    title = "Top 10 Objets Médiatiques - Québec",
    subtitle = "9-16 janvier 2026 • François Legault en rouge",
    x = "Score Total",
    y = NULL,
    caption = "Source: RADAR+"
  ) +
  theme_minimal() +
  theme(
    plot.title = element_text(size = 16, face = "bold", hjust = 0),
    plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
    axis.title.x = element_text(size = 11, face = "bold"),
    axis.text.y = element_text(size = 10, face = "bold"),
    panel.grid.major.y = element_blank(),
    panel.grid.minor = element_blank()
  )

ggsave("analyses/exploration/legault_resignation_top10.png",
       plot = p2, width = 10, height = 6, dpi = 300)
log_msg("✅ Visualisation 2 sauvegardée")

# --- VISUALISATION 3: QC vs CAN ---
log_msg("Génération visualisation 3: QC vs CAN")

# Comparer top 5 objets QC vs leur saillance en CAN
top5_qc_names <- top_objects_qc$object_name[1:5]

comp_data <- tibble(
  object = character(),
  edition = character(),
  score = numeric()
)

for(obj in top5_qc_names) {
  score_qc <- df_qc |>
    filter(tolower(object_name) == tolower(obj)) |>
    pull(salience_score) |>
    sum(na.rm = TRUE)
  
  score_can <- df_can |>
    filter(tolower(object_name) == tolower(obj)) |>
    pull(salience_score) |>
    sum(na.rm = TRUE)
  
  comp_data <- bind_rows(
    comp_data,
    tibble(object = obj, edition = "QC", score = score_qc),
    tibble(object = obj, edition = "CAN", score = score_can)
  )
}

comp_data <- comp_data |>
  mutate(object = factor(object, levels = rev(top5_qc_names)))

p3 <- ggplot(comp_data, aes(x = score, y = object, fill = edition)) +
  geom_col(position = "dodge", alpha = 0.85) +
  scale_fill_manual(
    values = c("QC" = COLORS$EDITIONS["QC"], "CAN" = COLORS$EDITIONS["CAN"]),
    name = "Édition"
  ) +
  scale_x_continuous(labels = label_number(scale = 1, big.mark = " ")) +
  labs(
    title = "Top 5 QC: Comparaison Couverture QC vs CAN",
    subtitle = "9-16 janvier 2026",
    x = "Score de Saillance",
    y = NULL,
    caption = "Source: RADAR+"
  ) +
  theme_minimal() +
  theme(
    plot.title = element_text(size = 16, face = "bold", hjust = 0),
    plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
    axis.title.x = element_text(size = 11, face = "bold"),
    axis.text.y = element_text(size = 10, face = "bold"),
    legend.position = "bottom",
    panel.grid.major.y = element_blank(),
    panel.grid.minor = element_blank()
  )

ggsave("analyses/exploration/legault_resignation_qc_vs_can.png",
       plot = p3, width = 11, height = 6, dpi = 300)
log_msg("✅ Visualisation 3 sauvegardée")

# --- EXPORT DONNÉES ---
log_msg("Export données")

export_data <- list(
  legault_evolution = legault_qc,
  top_10_qc = top_objects_qc,
  comparison_qc_can = comp_data,
  hot20_qc = if(nrow(df_hot20) > 0) filter(df_hot20, country_id == "QC") else NULL,
  summary = tibble(
    metric = c("Score Legault QC", "Score Legault CAN", "Rank QC", 
               "Rank CAN", "Impact %"),
    value = c(
      format_number(round(legault_qc_total)),
      format_number(round(legault_can)),
      as.character(if(length(legault_rank) > 0) legault_rank else "Hors top10"),
      as.character(if(length(legault_in_hot20) > 0) legault_in_hot20 else "N/A"),
      sprintf("%+.0f%%", pct_increase)
    )
  )
)

saveRDS(export_data, "analyses/exploration/legault_resignation_data.rds")
log_msg("✅ Données exportées: legault_resignation_data.rds")

# --- SUMMARY ---
cat("\n")
cat("==========================================================\n")
cat("  ANALYSE TERMINÉE\n")
cat("==========================================================\n\n")

elapsed <- timer()
cat(sprintf("⏱️  Durée: %s\n", elapsed))
cat(sprintf("📊 Visualisations: 3 graphiques (PNG)\n"))
cat(sprintf("💾 Données: 1 export RDS\n\n"))

cat("📁 Fichiers générés:\n")
cat("   • legault_resignation_evolution.png\n")
cat("   • legault_resignation_top10.png\n")
cat("   • legault_resignation_qc_vs_can.png\n")
cat("   • legault_resignation_data.rds\n\n")

cat("✨ Analyse complète de l'impact de la démission de François Legault!\n\n")
