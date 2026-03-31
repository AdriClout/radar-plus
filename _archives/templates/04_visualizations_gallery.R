# ============================================================
# TEMPLATES DE VISUALISATIONS RADAR+
# 
# Ce fichier contient des exemples de visualisations types
# pour les analyses de saillance médiatique, avec le style
# esthétique cohérent du projet.
#
# Date: 2026-01-16
# Auteur: Adrien & Claude
# ============================================================

# --- SETUP ---
library(ggplot2)
library(dplyr)
library(tidyr)
library(scales)
library(lubridate)

# Charger config et helpers
source("utils/config.R")
source("utils/helpers.R")

# --- DONNÉES SIMULÉES POUR DÉMONSTRATION ---
# (En pratique, charger depuis load_data.R)

set.seed(42)

# Simuler top 10 objets
demo_top10 <- tibble(
  rang = 1:10,
  object_name = c(
    "Donald Trump", "Justin Trudeau", "François Legault",
    "Gaza", "Hockey Canadien", "Inflation",
    "Élections USA", "Santé Publique", "Éducation", "Environnement"
  ),
  score_total = c(15000, 12000, 10500, 9000, 7500, 6500, 5800, 5200, 4800, 4200),
  persistence_pct = c(85, 90, 95, 60, 70, 80, 45, 75, 65, 55)
)

# Simuler évolution temporelle
demo_evolution <- expand_grid(
  date = seq(as.Date("2026-01-01"), as.Date("2026-01-31"), by = "1 day"),
  object_name = demo_top10$object_name[1:5]
) |>
  mutate(
    score_jour = case_when(
      object_name == "Donald Trump" ~ rnorm(n(), 500, 100),
      object_name == "Justin Trudeau" ~ rnorm(n(), 400, 80),
      object_name == "François Legault" ~ rnorm(n(), 350, 60),
      object_name == "Gaza" ~ rnorm(n(), 300, 120),
      object_name == "Hockey Canadien" ~ rnorm(n(), 250, 90)
    ),
    score_jour = pmax(score_jour, 0)  # Pas de scores négatifs
  )

# Simuler comparaison QC vs CAN
demo_comparison <- tibble(
  object_name = c("Trump", "Trudeau", "Gaza", "Ukraine", "Biden", 
                  "Inflation", "Hockey", "NBA", "Économie", "Santé"),
  score_qc = c(8000, 9000, 5000, 3000, 2000, 4000, 6000, 1500, 3500, 4500),
  score_can = c(12000, 7000, 6000, 5000, 8000, 3500, 2000, 5000, 4000, 3000)
)

# Simuler heatmap (objets × semaines)
demo_heatmap <- expand_grid(
  semaine = paste0("S", 1:4),
  object_name = demo_top10$object_name[1:8]
) |>
  mutate(
    score = runif(n(), 1000, 5000)
  )

################################################################################
# TEMPLATE 1: BAR CHART HORIZONTAL (top N)
################################################################################

viz_1_bar_horizontal <- function(data = demo_top10, top_n = 10, edition = "QC") {
  
  # Préparer les données (ordre inversé pour affichage)
  plot_data <- data |>
    slice(1:top_n) |>
    arrange(score_total) |>
    mutate(
      object_name = factor(object_name, levels = object_name),
      score_fmt = format_number(score_total)
    )
  
  # Graphique
  ggplot(plot_data, aes(x = score_total, y = object_name)) +
    geom_col(fill = COLORS$EDITIONS[edition], alpha = 0.85) +
    geom_text(
      aes(label = score_fmt),
      hjust = -0.1,
      size = 3.5,
      color = "gray20",
      fontface = "bold"
    ) +
    scale_x_continuous(
      labels = label_number(scale = 1, big.mark = " "),
      expand = expansion(mult = c(0, 0.15))
    ) +
    labs(
      title = sprintf("Top %d Objets Médiatiques", top_n),
      subtitle = sprintf("Édition %s • Janvier 2026", edition),
      x = "Score de Saillance",
      y = NULL,
      caption = "Source: RADAR+ • vitrine.clessn.ca"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50", hjust = 1),
      axis.title.x = element_text(size = 11, face = "bold", margin = margin(t = 10)),
      axis.text.y = element_text(size = 10, face = "bold", color = "gray20"),
      axis.text.x = element_text(size = 9),
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank()
    )
}

# Tester
p1 <- viz_1_bar_horizontal(demo_top10, top_n = 10, edition = "QC")
print(p1)

################################################################################
# TEMPLATE 2: LINE CHART (évolution temporelle)
################################################################################

viz_2_line_evolution <- function(data = demo_evolution, 
                                  objects = NULL,
                                  date_breaks = "3 days") {
  
  # Filtrer objets si spécifié
  if (!is.null(objects)) {
    data <- data |> filter(object_name %in% objects)
  }
  
  # Nombre d'objets
  n_objects <- n_distinct(data$object_name)
  colors_to_use <- COLORS$GRAPHS[1:n_objects]
  
  # Graphique
  ggplot(data, aes(x = date, y = score_jour, color = object_name)) +
    geom_line(linewidth = 1.2, alpha = 0.8) +
    geom_point(size = 1.8, alpha = 0.6) +
    scale_color_manual(
      values = colors_to_use,
      name = "Objet"
    ) +
    scale_x_date(
      date_breaks = date_breaks,
      date_labels = "%d %b",
      expand = expansion(mult = c(0.02, 0.02))
    ) +
    scale_y_continuous(
      labels = label_number(scale = 1, big.mark = " ")
    ) +
    labs(
      title = "Évolution Temporelle de la Saillance",
      subtitle = "Score quotidien • Janvier 2026",
      x = "Date",
      y = "Score de Saillance",
      caption = "Source: RADAR+ • vitrine.clessn.ca"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50", hjust = 1),
      axis.title = element_text(size = 11, face = "bold"),
      axis.text = element_text(size = 9),
      legend.position = "bottom",
      legend.title = element_text(size = 10, face = "bold"),
      legend.text = element_text(size = 9),
      panel.grid.minor = element_blank()
    ) +
    guides(color = guide_legend(nrow = 2))
}

# Tester
p2 <- viz_2_line_evolution(demo_evolution, objects = demo_top10$object_name[1:5])
print(p2)

################################################################################
# TEMPLATE 3: BAR CHART COMPARATIF (2 éditions côte à côte)
################################################################################

viz_3_bar_comparison <- function(data = demo_comparison, top_n = 10) {
  
  # Préparer les données pour format long
  plot_data <- data |>
    slice(1:top_n) |>
    pivot_longer(
      cols = c(score_qc, score_can),
      names_to = "edition",
      values_to = "score"
    ) |>
    mutate(
      edition = recode(edition, "score_qc" = "QC", "score_can" = "CAN"),
      # Ordonner par score total
      total_score = score_qc + score_can
    ) |>
    arrange(desc(total_score)) |>
    mutate(
      object_name = factor(object_name, levels = unique(object_name))
    )
  
  # Graphique
  ggplot(plot_data, aes(x = score, y = object_name, fill = edition)) +
    geom_col(position = position_dodge(width = 0.8), alpha = 0.85) +
    geom_text(
      aes(label = format_number(score)),
      position = position_dodge(width = 0.8),
      hjust = -0.1,
      size = 3,
      color = "gray20"
    ) +
    scale_fill_manual(
      values = c("QC" = COLORS$EDITIONS["QC"], "CAN" = COLORS$EDITIONS["CAN"]),
      name = "Édition"
    ) +
    scale_x_continuous(
      labels = label_number(scale = 1, big.mark = " "),
      expand = expansion(mult = c(0, 0.20))
    ) +
    labs(
      title = "Comparaison QC vs CAN",
      subtitle = "Score de saillance • Top 10 objets • Janvier 2026",
      x = "Score de Saillance",
      y = NULL,
      caption = "Source: RADAR+ • vitrine.clessn.ca"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50", hjust = 1),
      axis.title.x = element_text(size = 11, face = "bold", margin = margin(t = 10)),
      axis.text.y = element_text(size = 10, face = "bold"),
      axis.text.x = element_text(size = 9),
      legend.position = "bottom",
      legend.title = element_text(size = 10, face = "bold"),
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank()
    )
}

# Tester
p3 <- viz_3_bar_comparison(demo_comparison, top_n = 10)
print(p3)

################################################################################
# TEMPLATE 4: HEATMAP (objets × périodes)
################################################################################

viz_4_heatmap <- function(data = demo_heatmap) {
  
  ggplot(data, aes(x = semaine, y = object_name, fill = score)) +
    geom_tile(color = "white", linewidth = 1) +
    geom_text(
      aes(label = format_number(round(score))),
      color = "white",
      size = 3.5,
      fontface = "bold"
    ) +
    scale_fill_gradient(
      low = "#3498db",
      high = "#e74c3c",
      labels = label_number(scale = 1, big.mark = " "),
      name = "Score"
    ) +
    labs(
      title = "Heatmap de Saillance",
      subtitle = "Score par objet et par semaine • Janvier 2026",
      x = "Semaine",
      y = NULL,
      caption = "Source: RADAR+ • vitrine.clessn.ca"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50", hjust = 1),
      axis.title = element_text(size = 11, face = "bold"),
      axis.text.y = element_text(size = 10, face = "bold"),
      axis.text.x = element_text(size = 10, face = "bold"),
      legend.position = "right",
      legend.title = element_text(size = 10, face = "bold"),
      panel.grid = element_blank()
    )
}

# Tester
p4 <- viz_4_heatmap(demo_heatmap)
print(p4)

################################################################################
# TEMPLATE 5: LOLLIPOP CHART (alternative au bar chart)
################################################################################

viz_5_lollipop <- function(data = demo_top10, top_n = 10, edition = "QC") {
  
  # Préparer les données
  plot_data <- data |>
    slice(1:top_n) |>
    arrange(score_total) |>
    mutate(
      object_name = factor(object_name, levels = object_name),
      score_fmt = format_number(score_total)
    )
  
  # Graphique
  ggplot(plot_data, aes(x = score_total, y = object_name)) +
    geom_segment(
      aes(x = 0, xend = score_total, y = object_name, yend = object_name),
      color = "gray60",
      linewidth = 1
    ) +
    geom_point(
      color = COLORS$EDITIONS[edition],
      size = 6,
      alpha = 0.85
    ) +
    geom_text(
      aes(label = score_fmt),
      hjust = -0.3,
      size = 3.5,
      color = "gray20",
      fontface = "bold"
    ) +
    scale_x_continuous(
      labels = label_number(scale = 1, big.mark = " "),
      expand = expansion(mult = c(0, 0.15))
    ) +
    labs(
      title = sprintf("Top %d Objets Médiatiques", top_n),
      subtitle = sprintf("Édition %s • Janvier 2026", edition),
      x = "Score de Saillance",
      y = NULL,
      caption = "Source: RADAR+ • vitrine.clessn.ca"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50", hjust = 1),
      axis.title.x = element_text(size = 11, face = "bold", margin = margin(t = 10)),
      axis.text.y = element_text(size = 10, face = "bold"),
      axis.text.x = element_text(size = 9),
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank()
    )
}

# Tester
p5 <- viz_5_lollipop(demo_top10, top_n = 10, edition = "QC")
print(p5)

################################################################################
# TEMPLATE 6: SCATTER PLOT (score vs persistence)
################################################################################

viz_6_scatter_persistence <- function(data = demo_top10) {
  
  ggplot(data, aes(x = persistence_pct, y = score_total)) +
    geom_point(
      size = 4,
      alpha = 0.7,
      color = COLORS$GRAPHS[1]
    ) +
    geom_text(
      aes(label = object_name),
      vjust = -0.8,
      size = 3,
      color = "gray20",
      fontface = "bold"
    ) +
    geom_vline(
      xintercept = 50,
      linetype = "dashed",
      color = "gray50",
      alpha = 0.6
    ) +
    annotate(
      "text",
      x = 50, y = max(data$score_total) * 0.95,
      label = "50% persistence",
      color = "gray50",
      size = 3,
      angle = 90,
      vjust = -0.5
    ) +
    scale_x_continuous(
      labels = label_percent(scale = 1),
      limits = c(0, 100)
    ) +
    scale_y_continuous(
      labels = label_number(scale = 1, big.mark = " ")
    ) +
    labs(
      title = "Score vs Persistence",
      subtitle = "Relation entre saillance totale et présence temporelle • Janvier 2026",
      x = "Persistence (%)",
      y = "Score Total",
      caption = "Source: RADAR+ • vitrine.clessn.ca"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50", hjust = 1),
      axis.title = element_text(size = 11, face = "bold"),
      axis.text = element_text(size = 9),
      panel.grid.minor = element_blank()
    )
}

# Tester
p6 <- viz_6_scatter_persistence(demo_top10)
print(p6)

################################################################################
# TEMPLATE 7: AREA CHART (évolution cumulée)
################################################################################

viz_7_area_stacked <- function(data = demo_evolution, objects = NULL) {
  
  # Filtrer objets si spécifié
  if (!is.null(objects)) {
    data <- data |> filter(object_name %in% objects)
  }
  
  # Nombre d'objets
  n_objects <- n_distinct(data$object_name)
  colors_to_use <- COLORS$GRAPHS[1:n_objects]
  
  # Graphique
  ggplot(data, aes(x = date, y = score_jour, fill = object_name)) +
    geom_area(alpha = 0.7, position = "stack") +
    scale_fill_manual(
      values = colors_to_use,
      name = "Objet"
    ) +
    scale_x_date(
      date_breaks = "5 days",
      date_labels = "%d %b",
      expand = expansion(mult = c(0.01, 0.01))
    ) +
    scale_y_continuous(
      labels = label_number(scale = 1, big.mark = " ")
    ) +
    labs(
      title = "Évolution Cumulée de la Saillance",
      subtitle = "Score quotidien empilé • Janvier 2026",
      x = "Date",
      y = "Score Cumulé",
      caption = "Source: RADAR+ • vitrine.clessn.ca"
    ) +
    theme_minimal() +
    theme(
      plot.title = element_text(size = 16, face = "bold", hjust = 0),
      plot.subtitle = element_text(size = 11, color = "gray40", hjust = 0),
      plot.caption = element_text(size = 8, color = "gray50", hjust = 1),
      axis.title = element_text(size = 11, face = "bold"),
      axis.text = element_text(size = 9),
      legend.position = "bottom",
      legend.title = element_text(size = 10, face = "bold"),
      legend.text = element_text(size = 9),
      panel.grid.minor = element_blank()
    ) +
    guides(fill = guide_legend(nrow = 2))
}

# Tester
p7 <- viz_7_area_stacked(demo_evolution, objects = demo_top10$object_name[1:5])
print(p7)

################################################################################
# RÉSUMÉ DES TEMPLATES DISPONIBLES
################################################################################

cat("\n")
cat("================================================================\n")
cat("  TEMPLATES DE VISUALISATIONS RADAR+ - RÉSUMÉ\n")
cat("================================================================\n\n")

cat("7 templates disponibles:\n\n")

cat("1. viz_1_bar_horizontal()     → Bar chart horizontal (top N)\n")
cat("2. viz_2_line_evolution()     → Line chart évolution temporelle\n")
cat("3. viz_3_bar_comparison()     → Bar chart comparatif (2 éditions)\n")
cat("4. viz_4_heatmap()            → Heatmap (objets × périodes)\n")
cat("5. viz_5_lollipop()           → Lollipop chart (alternative bar)\n")
cat("6. viz_6_scatter_persistence()→ Scatter plot (score vs persistence)\n")
cat("7. viz_7_area_stacked()       → Area chart empilé (évolution cumulée)\n\n")

cat("Usage:\n")
cat("  # Charger ce fichier\n")
cat("  source('templates/04_visualizations_gallery.R')\n\n")
cat("  # Utiliser un template\n")
cat("  p <- viz_1_bar_horizontal(mes_donnees, top_n = 10, edition = 'QC')\n")
cat("  print(p)\n\n")
cat("  # Sauvegarder\n")
cat("  ggsave('mon_graphique.png', plot = p, width = 10, height = 6, dpi = 300)\n\n")

cat("Styles cohérents:\n")
cat("  ✓ Couleurs: COLORS$EDITIONS, COLORS$GRAPHS (config.R)\n")
cat("  ✓ Thème: theme_minimal() personnalisé\n")
cat("  ✓ Titres: Bold, subtitle gris, caption source\n")
cat("  ✓ Axes: Formatage nombres avec espaces\n\n")

cat("================================================================\n")
