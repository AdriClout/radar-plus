################################################################################
# Constellation des Objets — Génération des données
#
# Produit deux fichiers JSON :
#   graph.json       — GRAPH_DAYS derniers jours, nœuds + articles + liens
#                      → Mode Constellation
#   timeseries.json  — HISTORY_DAYS derniers jours, nœuds + articles, sans liens
#                      → Mode Évolution
#
# Usage :
#   source("constellation/build_data.R")
#
# Adrien Cloutier
################################################################################

# ─── Paramètres ────────────────────────────────────────────────────────────────

GRAPH_DAYS       <- 14   # Fenêtre graph.json (constellation)
HISTORY_DAYS     <- 130  # Fenêtre timeseries.json (évolution) — couvre tout 2026 depuis le 1er janvier
TOP_N_OBJECTS    <- 30   # Nœuds max par période × pays
MIN_COOCCURRENCE <- 1    # Seuil minimum d'URLs partagées pour un lien

ALERT_LOOKBACK_PERIODS <- 180  # 30 jours glissants de périodes 4h (z-score robuste)
ALERT_MIN_HISTORY      <- 18   # Historique minimal avant score robuste
ALERT_MIN_MENTIONS     <- 2    # Plancher de mentions pour qu'un bloc compte
ALERT_MIN_ABS_SCORE    <- 1.0  # Plancher absolu de saillance — sous ce seuil, rien
ALERT_SCALE_FLOOR      <- 0.08 # Évite les explosions z sur séries quasi constantes
ALERT_Z_THRESHOLD      <- 1.8  # Bloc anormal dès que z >= 1.8

# ─── Taxonomie 6 tiers (échelle d'alarme + grille magnitude) ─────────────────
# Voir methodologie.html §10 pour les définitions complètes et la littérature.
#
# Top (cas exceptionnels, grille magnitude × durée) :
#   🌊 TSUNAMI       — extrême + court (≤3j) + agenda saturé
#   🌑 ÉCLIPSE       — extrême + long (≥4j) + agenda obscurci
#   ⛈ TEMPÊTE        — très haut + long (≥5j, Boydstun)
#
# Échelle standard (alertes quotidiennes/hebdomadaires) :
#   ⚡ ALERTE FORTE  — très haut + court + anomalie z (streak ≥ 4)
#   📍 ALERTE        — haut + anomalie z confirmée (streak ≥ 4)
#   ◦ ÉMERGENCE     — modéré + anomalie z (sous le radar normal)
#
# Note v3 : le tier "Veille" (haut + streak 2-3) a été retiré car
# conceptuellement un cul-de-sac (signaux qui n'ont jamais confirmé).
# Tout sujet qui dépasse streak ≥ 4 devient Alerte ou plus.
#
# Références canoniques :
#   Giasson 2008          → tsunami (dominance totale aiguë)
#   Atkinson 2014 + Zhu 1992 → éclipse (agenda displacement)
#   Boydstun et al. 2014  → tempête (media storm ≥ 5j)
#   Bennett 2003 + Boydstun 2013 → alerte forte (alarm mode)
#   Boydstun & Russell 2016 → alerte (alarm-to-patrol confirmed)
#   Vasterman 2005 + Kepplinger 1995 → émergence (signal précurseur)

# Durées (granularité jour) — pivot entre court et long
ALERT_DAYS_SHORT_MAX     <- 3L   # ≤ 3 j : court (tsunami / alerte forte)
ALERT_DAYS_LONG_MIN_ECL  <- 4L   # ≥ 4 j : éclipse
ALERT_DAYS_LONG_MIN_TMP  <- 5L   # ≥ 5 j : tempête (Boydstun 2014)

# Structure d'événement — "plusieurs ondes" pour tsunami / éclipse
ALERT_TSUNAMI_MIN_VHI_BLOCS <- 2L  # ≥ 2 blocs 4h à very_high dans l'épisode
ALERT_ECLIPSE_MIN_VHI_DAYS  <- 2L  # ≥ 2 jours à very_high dans l'épisode

# Streak (z-score anormal pour soi)
ALERT_STREAK_ALERTE_FORTE <- 4L  # ≥ 4 blocs 4h anormaux ≈ 1 j
ALERT_STREAK_ALERTE       <- 4L  # ≥ 4 blocs 4h ≈ 1 j (anomalie confirmée)
ALERT_STREAK_EMERGENCE    <- 4L

# Top_share au pic (dominance locale)
ALERT_TS_TSUNAMI_PEAK      <- 0.95   # quasi seul en tête
ALERT_TS_ALERTE_FORTE_PEAK <- 0.70
ALERT_TS_ALERTE_PEAK       <- 0.50
ALERT_TS_EMERGENCE_PEAK    <- 0.50
ALERT_TS_ECLIPSE_MEAN      <- 0.80   # top_share MOYEN sur l'épisode (soutenu)

# Clustering historique 130j : 2 épisodes du même pays sont considérés comme
# faisant partie du MÊME événement si leur intervalle temporel se chevauche
# ≥ N% de la durée du plus court. Permet de regrouper Iran+Israel (même date,
# même pays) ou les multiples objets d'une élection (Liberal Party +
# circonscriptions le même jour).
ALERT_CLUSTER_OVERLAP_FRAC <- 0.5

# Convergence d'agenda (1 − entropie normalisée Shannon sur Top 30).
# Seuils calibrés EMPIRIQUEMENT par pays — percentiles ajustés à chaque run.
# Voir methodologie.html §10.4.
ALERT_CONV_PCTL_TSUNAMI <- 0.95  # convergence au pic ≥ p95 pays
ALERT_CONV_PCTL_ECLIPSE <- 0.85  # convergence moyenne sur épisode ≥ p85 pays

# Anti-halo : si 2 alertes hors cluster partagent ≥ X% d'articles,
# downgrade celle au z-score le plus bas d'un cran.
ALERT_HALO_THRESHOLD  <- 0.80

# Objets génériques exclus par pays (même logique que radar-hot-20)
EXCLUSION_BY_COUNTRY <- list(
  QC  = c("quebec", "montreal", "canada"),
  USA = c("usa", "united states", "fox news", "cnn", "washington dc"),
  CAN = c("canada", "ottawa")
)

OUT_DIR <- tryCatch({
  dirname(rstudioapi::getSourceEditorContext()$path)
}, error = function(e) {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("--file=", args, value = TRUE)
  if (length(file_arg) > 0) {
    dirname(normalizePath(sub("--file=", "", file_arg[1])))
  } else {
    "/Users/adrien/repo_github/radar-plus/pipeline"
  }
})

SITE_DIR <- file.path(dirname(OUT_DIR), "site")

GRAPH_FILE <- file.path(SITE_DIR, "graph.json")
TS_FILE    <- file.path(SITE_DIR, "timeseries.json")
ARTICLES_FILE <- file.path(SITE_DIR, "articles.json")
MONITOR_INPUT_FILE <- file.path(SITE_DIR, "monitor_input.json")

# ─── Fonctions utilitaires (définies avant usage) ─────────────────────────────

compute_alert_metrics <- function(scores, mentions, dates_utc = NULL) {
  n_scores <- length(scores)
  alert_score <- rep(NA_real_, n_scores)
  alert_delta <- rep(NA_real_, n_scores)
  alert_baseline <- rep(NA_real_, n_scores)
  alert_peak_ratio <- rep(NA_real_, n_scores)
  alert_year_peak <- rep(NA_real_, n_scores)
  alert_anomalous <- rep(FALSE, n_scores)  # bloc anormal (z >= seuil)
  alert_streak <- rep(0L, n_scores)        # nb de blocs anormaux consécutifs jusqu'à i
  alert_emerging <- rep(FALSE, n_scores)   # historique trop court mais signal réel
  alert_level <- rep("none", n_scores)     # tier final assigné en post (ici juste emerging)
  alert_active <- rep(FALSE, n_scores)

  if (n_scores == 0) {
    return(list(
      alert_score = alert_score, alert_delta = alert_delta,
      alert_baseline = alert_baseline, alert_peak_ratio = alert_peak_ratio,
      alert_year_peak = alert_year_peak, alert_anomalous = alert_anomalous,
      alert_streak = alert_streak, alert_emerging = alert_emerging,
      alert_level = alert_level, alert_active = alert_active
    ))
  }

  safe_scores <- pmax(as.numeric(scores), 0)
  safe_mentions <- pmax(as.integer(mentions), 0L)
  safe_dates <- tryCatch(as.Date(dates_utc), error = function(e) rep(as.Date(NA), n_scores))
  if (length(safe_dates) != n_scores) {
    safe_dates <- rep(as.Date(NA), n_scores)
  }
  log_scores <- log1p(safe_scores)

  for (i in seq_len(n_scores)) {
    current_score <- safe_scores[i]
    current_mentions <- safe_mentions[i]
    current_date <- safe_dates[i]

    if (is.na(current_date)) {
      year_slice <- safe_scores[seq_len(i)]
    } else {
      same_year_idx <- which(
        !is.na(safe_dates) &
          format(safe_dates, "%Y") == format(current_date, "%Y") &
          seq_len(n_scores) <= i
      )
      if (!length(same_year_idx)) {
        year_slice <- safe_scores[seq_len(i)]
      } else {
        year_slice <- safe_scores[same_year_idx]
      }
    }

    year_peak <- suppressWarnings(max(year_slice, na.rm = TRUE))
    if (!is.finite(year_peak) || year_peak <= 0) {
      year_peak <- current_score
    }
    peak_ratio <- if (is.finite(year_peak) && year_peak > 0) current_score / year_peak else NA_real_

    alert_year_peak[i] <- year_peak
    alert_peak_ratio[i] <- peak_ratio

    history_start <- max(1L, i - ALERT_LOOKBACK_PERIODS)
    history_end <- i - 1L
    if (history_end < history_start) {
      # premier bloc, pas d'historique du tout
      if (current_mentions >= ALERT_MIN_MENTIONS && current_score >= ALERT_MIN_ABS_SCORE) {
        alert_emerging[i] <- TRUE
      }
      next
    }

    history_values <- log_scores[history_start:history_end]
    history_values <- history_values[is.finite(history_values)]
    if (length(history_values) < ALERT_MIN_HISTORY) {
      if (current_mentions >= ALERT_MIN_MENTIONS && current_score >= ALERT_MIN_ABS_SCORE) {
        alert_emerging[i] <- TRUE
      }
      next
    }

    baseline <- stats::median(history_values)
    scale <- stats::mad(history_values, center = baseline, constant = 1.4826)
    if (!is.finite(scale) || scale < ALERT_SCALE_FLOOR) {
      scale <- stats::sd(history_values)
    }
    scale <- max(scale, ALERT_SCALE_FLOOR, na.rm = TRUE)

    delta <- log_scores[i] - baseline
    score <- delta / scale

    alert_score[i] <- score
    alert_delta[i] <- expm1(delta)
    alert_baseline[i] <- expm1(baseline)

    # Détecter si ce bloc est ANORMAL (au-dessus du seuil z, mentions
    # suffisantes, saillance absolue minimale). Le NIVEAU final (tier)
    # sera assigné après en fonction de la PERSISTANCE et du TOP_SHARE.
    if (
      is.finite(score) && score >= ALERT_Z_THRESHOLD &&
      current_mentions >= ALERT_MIN_MENTIONS &&
      current_score >= ALERT_MIN_ABS_SCORE
    ) {
      alert_anomalous[i] <- TRUE
      alert_streak[i] <- if (i > 1L && alert_streak[i - 1L] > 0L) {
        alert_streak[i - 1L] + 1L
      } else {
        1L
      }
    } else {
      alert_streak[i] <- 0L
    }
  }

  list(
    alert_score = alert_score,
    alert_delta = alert_delta,
    alert_baseline = alert_baseline,
    alert_peak_ratio = alert_peak_ratio,
    alert_year_peak = alert_year_peak,
    alert_anomalous = alert_anomalous,
    alert_streak = alert_streak,
    alert_emerging = alert_emerging,
    alert_level = alert_level,    # placeholder, mis à jour en post
    alert_active = alert_active   # idem
  )
}

# ─── Lecture des CSV produits par fetch_data.py ────────────────────────────────

history_start <- format(Sys.Date() - HISTORY_DAYS, "%Y-%m-%d")
graph_start   <- as.Date(Sys.Date() - GRAPH_DAYS)

cat("Lecture de salient_index...\n")
df_index <- readr::read_csv(file.path(OUT_DIR, "salient_index.csv"),
                            show_col_types = FALSE) |>
  dplyr::mutate(
    date_utc                  = as.Date(date_utc),
    n                         = as.integer(n),
    absolute_normalized_index = as.numeric(absolute_normalized_index)
  ) |>
  dplyr::filter(date_utc >= as.Date(history_start))
cat("  →", nrow(df_index), "lignes chargées\n")

cat("Lecture de salient_headlines_objects (médias)...\n")
df_objects <- readr::read_csv(file.path(OUT_DIR, "salient_objects.csv"),
                              show_col_types = FALSE) |>
  dplyr::mutate(date_utc = as.Date(substr(as.character(headline_stop_utc), 1, 10))) |>
  dplyr::filter(date_utc >= as.Date(history_start))
cat("  →", nrow(df_objects), "lignes médias chargées\n")

cat("Calcul des scores d'alerte de saillance...\n")

# Étape 1 : métriques par objet (z-score, baseline, streak de blocs anormaux,
# emerging si peu d'historique). Le NIVEAU n'est pas encore assigné car il
# dépend du top_share qui se calcule cross-object par période.
df_index <- df_index |>
  dplyr::arrange(country_id, extracted_objects, date_utc, time_interval_utc) |>
  dplyr::group_by(country_id, extracted_objects) |>
  dplyr::group_modify(function(.x, .y) {
    metrics <- compute_alert_metrics(.x$absolute_normalized_index, .x$n, .x$date_utc)
    dplyr::mutate(
      .x,
      alert_score      = metrics$alert_score,
      alert_delta      = metrics$alert_delta,
      alert_baseline   = metrics$alert_baseline,
      alert_peak_ratio = metrics$alert_peak_ratio,
      alert_year_peak  = metrics$alert_year_peak,
      alert_anomalous  = metrics$alert_anomalous,
      alert_streak     = metrics$alert_streak,
      alert_emerging   = metrics$alert_emerging
    )
  }) |>
  dplyr::ungroup()

# Étape 2 : top_share cross-object (saillance / Top 1 du pays·période).
df_index <- df_index |>
  dplyr::group_by(country_id, date_utc, time_interval_utc) |>
  dplyr::mutate(
    alert_top_share = {
      m <- max(absolute_normalized_index, na.rm = TRUE)
      if (!is.finite(m) || m <= 0) NA_real_ else absolute_normalized_index / m
    }
  ) |>
  dplyr::ungroup()

# Étape 3a : convergence d'agenda par (pays, période). Mesure à quel
# point la couverture est concentrée sur peu de sujets.
#   1 - entropie(p) / log(n)  où p = saillances normalisées du Top
# Plage [0, 1] : 0 = parfaitement distribué, 1 = un seul sujet domine.
# Calculé sur les saillances ≥ ALERT_MIN_ABS_SCORE pour cohérence avec
# les paliers de saillance (mêmes saillances "qui comptent").
compute_convergence <- function(sizes) {
  s <- sizes[is.finite(sizes) & sizes > 0]
  n <- length(s)
  if (n < 2) return(NA_real_)
  total <- sum(s)
  if (total <= 0) return(NA_real_)
  p <- s / total
  H <- -sum(p * log(p))
  Hmax <- log(n)
  if (Hmax <= 0) return(NA_real_)
  1 - H / Hmax
}

df_convergence <- df_index |>
  dplyr::filter(absolute_normalized_index > 0) |>
  dplyr::group_by(country_id, date_utc, time_interval_utc) |>
  # Limiter au Top N pour mesurer la convergence de l'AGENDA EFFECTIF
  # (pas la dispersion sur tous les sujets isolés à saillance < 1).
  # Sinon entropie diluée par 100+ objets-bruit, convergence sous-estimée.
  dplyr::slice_max(absolute_normalized_index, n = TOP_N_OBJECTS, with_ties = FALSE) |>
  dplyr::summarise(
    convergence = compute_convergence(absolute_normalized_index),
    .groups = "drop"
  )

# Calibration empirique des seuils convergence par pays — percentiles
# auto-adaptables à chaque run. p85 pour éclipse, p95 pour tsunami.
convergence_thresholds_df <- df_convergence |>
  dplyr::filter(is.finite(convergence)) |>
  dplyr::group_by(country_id) |>
  dplyr::summarise(
    eclipse_min = stats::quantile(convergence, ALERT_CONV_PCTL_ECLIPSE, na.rm = TRUE),
    tsunami_min = stats::quantile(convergence, ALERT_CONV_PCTL_TSUNAMI, na.rm = TRUE),
    .groups     = "drop"
  )
convergence_thresholds <- list()
cat("Calibration des seuils convergence par pays (p85 éclipse / p95 tsunami)...\n")
for (i in seq_len(nrow(convergence_thresholds_df))) {
  c <- as.character(convergence_thresholds_df$country_id[i])
  convergence_thresholds[[c]] <- list(
    eclipse = round(unname(convergence_thresholds_df$eclipse_min[i]), 3),
    tsunami = round(unname(convergence_thresholds_df$tsunami_min[i]), 3)
  )
  cat(sprintf("  %s : éclipse>=%.3f, tsunami>=%.3f\n", c,
              convergence_thresholds[[c]]$eclipse,
              convergence_thresholds[[c]]$tsunami))
}

df_index <- df_index |>
  dplyr::left_join(df_convergence, by = c("country_id", "date_utc", "time_interval_utc"))

# ─── Paliers de saillance absolue par pays (DÉPLACÉ EN AMONT) ─────────────────
# Calibrés sur les PICS par bloc 4h (max(saillance) par country×date×bloc).
# Voir methodologie.html §11 pour la justification de la calibration sur pics.
#   moderate  = p50 · high = p80 · very_high = p95 · extreme = p99
cat("Calcul des paliers de saillance par pays (pics par bloc 4h, saillance >= ", ALERT_MIN_ABS_SCORE, ")...\n", sep = "")
salience_tiers_df <- df_index |>
  dplyr::filter(absolute_normalized_index >= ALERT_MIN_ABS_SCORE) |>
  dplyr::group_by(country_id, date_utc, time_interval_utc) |>
  dplyr::summarise(peak = max(absolute_normalized_index, na.rm = TRUE), .groups = "drop") |>
  dplyr::group_by(country_id) |>
  dplyr::summarise(
    moderate  = stats::quantile(peak, 0.50, na.rm = TRUE),
    high      = stats::quantile(peak, 0.80, na.rm = TRUE),
    very_high = stats::quantile(peak, 0.95, na.rm = TRUE),
    extreme   = stats::quantile(peak, 0.99, na.rm = TRUE),
    .groups   = "drop"
  )
salience_tiers <- list()
for (i in seq_len(nrow(salience_tiers_df))) {
  c <- as.character(salience_tiers_df$country_id[i])
  salience_tiers[[c]] <- list(
    moderate  = round(unname(salience_tiers_df$moderate[i]),  3),
    high      = round(unname(salience_tiers_df$high[i]),      3),
    very_high = round(unname(salience_tiers_df$very_high[i]), 3),
    extreme   = round(unname(salience_tiers_df$extreme[i]),   3)
  )
  cat(sprintf("  %s : modéré=%.2f · élevé=%.2f · très élevé=%.2f · extrême=%.2f\n",
              c, salience_tiers[[c]]$moderate, salience_tiers[[c]]$high,
              salience_tiers[[c]]$very_high, salience_tiers[[c]]$extreme))
}

# ─── Helpers d'accès aux paliers et seuils convergence par pays ──────────────
get_tier <- function(country, tier_name) {
  s <- salience_tiers[[country]]
  if (is.null(s) || is.null(s[[tier_name]])) return(NA_real_)
  s[[tier_name]]
}
get_conv <- function(country, kind) {
  v <- convergence_thresholds[[country]][[kind]]
  if (is.null(v) || !is.finite(v)) NA_real_ else v
}

# ─── Étape 3 : épisodes par (pays, objet) ────────────────────────────────────
# Un épisode = run de JOURS consécutifs où le pic quotidien >= palier_high.
# C'est l'unité d'analyse pour la classification (vs bloc 4h isolé).

cat("Détection des épisodes par (pays, objet) et classification 5 tiers...\n")

# Agrégation jour-niveau
df_daily <- df_index |>
  dplyr::group_by(country_id, extracted_objects, date_utc) |>
  dplyr::summarise(
    day_peak          = max(absolute_normalized_index, na.rm = TRUE),
    day_max_top_share = suppressWarnings(max(alert_top_share, na.rm = TRUE)),
    day_max_conv      = suppressWarnings(max(convergence,     na.rm = TRUE)),
    day_max_streak    = suppressWarnings(max(alert_streak,    na.rm = TRUE)),
    .groups           = "drop"
  ) |>
  dplyr::mutate(
    day_max_top_share = ifelse(is.finite(day_max_top_share), day_max_top_share, NA_real_),
    day_max_conv      = ifelse(is.finite(day_max_conv),      day_max_conv,      NA_real_),
    day_max_streak    = ifelse(is.finite(day_max_streak),    day_max_streak,    0L)
  )

# Identification des runs de jours consécutifs où peak >= palier_modéré.
# Seuil abaissé à modéré pour permettre la classification des tiers Émergence
# (modéré + anomalie) et Veille (haut + anomalie naissante). Les épisodes
# qui ne passent aucun critère de tier resteront classés "none" et seront
# filtrés à l'export.
df_daily <- df_daily |>
  dplyr::group_by(country_id, extracted_objects) |>
  dplyr::arrange(date_utc) |>
  dplyr::mutate(
    .tier_mod     = vapply(country_id, function(c) get_tier(c, "moderate"), numeric(1)),
    .in_event_day = !is.na(.tier_mod) & day_peak >= .tier_mod,
    .day_diff     = as.integer(date_utc - dplyr::lag(date_utc)),
    .prev_in      = dplyr::lag(.in_event_day, default = FALSE),
    .new_episode  = .in_event_day & (is.na(.day_diff) | .day_diff != 1L | !.prev_in),
    .episode_idx  = cumsum(.new_episode & .in_event_day) * as.integer(.in_event_day)
  ) |>
  dplyr::ungroup() |>
  dplyr::select(-.day_diff, -.prev_in, -.new_episode, -.tier_mod)

# Agrégats par épisode (granularité jour)
df_episodes_daily <- df_daily |>
  dplyr::filter(.in_event_day, .episode_idx > 0) |>
  dplyr::group_by(country_id, extracted_objects, .episode_idx) |>
  dplyr::summarise(
    ep_first_day      = min(date_utc),
    ep_last_day       = max(date_utc),
    ep_n_days         = dplyr::n(),
    ep_peak           = max(day_peak, na.rm = TRUE),
    ep_mean_top_share = mean(day_max_top_share, na.rm = TRUE),
    ep_mean_conv      = mean(day_max_conv, na.rm = TRUE),
    ep_max_streak_day = max(day_max_streak, na.rm = TRUE),
    .groups           = "drop"
  ) |>
  dplyr::mutate(
    ep_n_vhi_days = vapply(seq_along(country_id), function(i) {
      tv <- get_tier(country_id[i], "very_high")
      if (is.na(tv)) return(NA_integer_)
      sub <- df_daily[df_daily$country_id == country_id[i] &
                        df_daily$extracted_objects == extracted_objects[i] &
                        df_daily$.episode_idx == .episode_idx[i], ]
      as.integer(sum(sub$day_peak >= tv, na.rm = TRUE))
    }, integer(1))
  )

# Agrégats 4h-niveau par épisode (n_vhi_blocs + top_share/conv au pic)
df_index_with_ep <- df_index |>
  dplyr::left_join(
    df_daily |> dplyr::select(country_id, extracted_objects, date_utc, .in_event_day, .episode_idx),
    by = c("country_id", "extracted_objects", "date_utc")
  )

df_episodes_blocs <- df_index_with_ep |>
  dplyr::filter(!is.na(.episode_idx) & .episode_idx > 0) |>
  dplyr::mutate(
    .tier_vhi_b = vapply(country_id, function(c) get_tier(c, "very_high"), numeric(1))
  ) |>
  dplyr::group_by(country_id, extracted_objects, .episode_idx) |>
  dplyr::summarise(
    ep_n_blocs        = dplyr::n(),
    ep_n_vhi_blocs    = sum(!is.na(.tier_vhi_b) & absolute_normalized_index >= .tier_vhi_b, na.rm = TRUE),
    ep_peak_top_share = {
      idx <- which.max(absolute_normalized_index)
      if (length(idx) == 0) NA_real_ else alert_top_share[idx]
    },
    ep_peak_conv = {
      idx <- which.max(absolute_normalized_index)
      if (length(idx) == 0) NA_real_ else convergence[idx]
    },
    .groups = "drop"
  )

df_episodes <- df_episodes_daily |>
  dplyr::left_join(df_episodes_blocs,
                   by = c("country_id", "extracted_objects", ".episode_idx"))

# ─── Étape 4 : classification du tier par épisode (taxonomie 7 tiers) ────────
classify_episode <- function(country, ep_peak, ep_n_days,
                              ep_n_vhi_blocs, ep_n_vhi_days,
                              ep_peak_top_share, ep_peak_conv,
                              ep_mean_top_share, ep_mean_conv,
                              ep_max_streak_day) {
  tier_mod  <- get_tier(country, "moderate")
  tier_high <- get_tier(country, "high")
  tier_vhi  <- get_tier(country, "very_high")
  tier_ext  <- get_tier(country, "extreme")
  conv_p95  <- get_conv(country, "tsunami")
  conv_p85  <- get_conv(country, "eclipse")

  if (is.na(ep_peak) || is.na(tier_mod) || ep_peak < tier_mod) return("none")

  # 🌊 Tsunami : extrême + court + ondes multiples + dominance écrasante + agenda saturé
  if (!is.na(tier_ext) && ep_peak >= tier_ext &&
      ep_n_days <= ALERT_DAYS_SHORT_MAX &&
      !is.na(ep_n_vhi_blocs) && ep_n_vhi_blocs >= ALERT_TSUNAMI_MIN_VHI_BLOCS &&
      !is.na(ep_peak_top_share) && ep_peak_top_share >= ALERT_TS_TSUNAMI_PEAK &&
      !is.na(ep_peak_conv) && !is.na(conv_p95) && ep_peak_conv >= conv_p95) {
    return("tsunami")
  }
  # 🌑 Éclipse : extrême + long + structure + dominance soutenue + agenda obscurci
  if (!is.na(tier_ext) && ep_peak >= tier_ext &&
      ep_n_days >= ALERT_DAYS_LONG_MIN_ECL &&
      !is.na(ep_n_vhi_days) && ep_n_vhi_days >= ALERT_ECLIPSE_MIN_VHI_DAYS &&
      !is.na(ep_mean_top_share) && ep_mean_top_share >= ALERT_TS_ECLIPSE_MEAN &&
      !is.na(ep_mean_conv) && !is.na(conv_p85) && ep_mean_conv >= conv_p85) {
    return("eclipse")
  }
  # ⛈ Tempête : très-haut + long (≥ 5 j), hors-tsunami/éclipse
  if (!is.na(tier_vhi) && ep_peak >= tier_vhi &&
      (is.na(tier_ext) || ep_peak < tier_ext) &&
      ep_n_days >= ALERT_DAYS_LONG_MIN_TMP) {
    return("tempete")
  }
  # ⚡ Alerte forte : très-haut + court + anomalie pour soi + dominance
  if (!is.na(tier_vhi) && ep_peak >= tier_vhi &&
      (is.na(tier_ext) || ep_peak < tier_ext) &&
      ep_n_days <= ALERT_DAYS_SHORT_MAX &&
      !is.na(ep_max_streak_day) && ep_max_streak_day >= ALERT_STREAK_ALERTE_FORTE &&
      !is.na(ep_peak_top_share) && ep_peak_top_share >= ALERT_TS_ALERTE_FORTE_PEAK) {
    return("forte")
  }
  # 📍 Alerte : haut + anomalie z confirmée (streak ≥ 4)
  if (!is.na(tier_high) && ep_peak >= tier_high &&
      (is.na(tier_vhi) || ep_peak < tier_vhi) &&
      !is.na(ep_max_streak_day) && ep_max_streak_day >= ALERT_STREAK_ALERTE &&
      !is.na(ep_peak_top_share) && ep_peak_top_share >= ALERT_TS_ALERTE_PEAK) {
    return("alerte")
  }
  # ◦ Émergence : modéré (sans atteindre haut) + anomalie + dominance min
  if (ep_peak >= tier_mod &&
      (is.na(tier_high) || ep_peak < tier_high) &&
      !is.na(ep_max_streak_day) && ep_max_streak_day >= ALERT_STREAK_EMERGENCE &&
      !is.na(ep_peak_top_share) && ep_peak_top_share >= ALERT_TS_EMERGENCE_PEAK) {
    return("emergence")
  }
  "none"
}

df_episodes <- df_episodes |>
  dplyr::mutate(
    ep_tier = purrr::pmap_chr(
      list(country_id, ep_peak, ep_n_days, ep_n_vhi_blocs, ep_n_vhi_days,
           ep_peak_top_share, ep_peak_conv, ep_mean_top_share, ep_mean_conv,
           ep_max_streak_day),
      classify_episode
    )
  )

# Statut active/ended (active = épisode atteint le dernier jour observé du pays)
latest_day_by_country <- df_index |>
  dplyr::group_by(country_id) |>
  dplyr::summarise(.latest_day = max(date_utc), .groups = "drop")

df_episodes <- df_episodes |>
  dplyr::left_join(latest_day_by_country, by = "country_id") |>
  dplyr::mutate(
    ep_status     = ifelse(ep_last_day == .latest_day, "active", "ended"),
    ep_episode_id = paste0(country_id, "-", extracted_objects, "-", .episode_idx)
  ) |>
  dplyr::select(-.latest_day)

# ─── Étape 4b : Clustering historique 130j (regroupe les épisodes du même
#                pays qui se chevauchent temporellement) ────────────────────
# Objectif : éviter qu'Iran+Israel le 28 fév CAN soient 2 événements distincts
# sur la chronique. Ou que 12 circonscriptions le jour d'élection soient 12
# alertes au lieu d'1 événement. Heuristique : chevauchement temporel ≥ N%
# de la durée du plus court épisode + même pays.
cat("Clustering historique des épisodes par chevauchement temporel...\n")

# On ne clusterise que les épisodes "actifs" (tier ≠ none)
active_eps <- df_episodes |> dplyr::filter(ep_tier != "none") |>
  dplyr::arrange(country_id, ep_first_day)

if (nrow(active_eps) > 0) {
  active_eps$cluster_id <- NA_character_
  active_eps$cluster_pivot <- FALSE
  cluster_counter <- 0L

  for (c_name in unique(active_eps$country_id)) {
    rows_idx <- which(active_eps$country_id == c_name)
    if (length(rows_idx) < 2) {
      # Un seul épisode → cluster solo
      cluster_counter <- cluster_counter + 1L
      cid <- sprintf("%s-cl-%03d", c_name, cluster_counter)
      active_eps$cluster_id[rows_idx]    <- cid
      active_eps$cluster_pivot[rows_idx] <- TRUE
      next
    }

    # Pour chaque épisode, soit le rattacher à un cluster existant (overlap suffisant)
    # soit créer un nouveau cluster
    for (i in seq_along(rows_idx)) {
      ri <- rows_idx[i]
      ei_start <- as.Date(active_eps$ep_first_day[ri])
      ei_end   <- as.Date(active_eps$ep_last_day[ri])
      ei_dur   <- as.integer(ei_end - ei_start) + 1L

      best_cid <- NA_character_
      best_overlap_frac <- 0

      for (j in seq_len(i - 1L)) {
        rj <- rows_idx[j]
        if (is.na(active_eps$cluster_id[rj])) next
        ej_start <- as.Date(active_eps$ep_first_day[rj])
        ej_end   <- as.Date(active_eps$ep_last_day[rj])
        ej_dur   <- as.integer(ej_end - ej_start) + 1L

        # Chevauchement temporel
        ov_start <- max(ei_start, ej_start)
        ov_end   <- min(ei_end, ej_end)
        if (ov_end < ov_start) next  # pas de chevauchement
        ov_dur <- as.integer(ov_end - ov_start) + 1L
        frac <- ov_dur / min(ei_dur, ej_dur)
        if (frac >= ALERT_CLUSTER_OVERLAP_FRAC && frac > best_overlap_frac) {
          best_overlap_frac <- frac
          best_cid <- active_eps$cluster_id[rj]
        }
      }

      if (!is.na(best_cid)) {
        active_eps$cluster_id[ri] <- best_cid
      } else {
        cluster_counter <- cluster_counter + 1L
        cid <- sprintf("%s-cl-%03d", c_name, cluster_counter)
        active_eps$cluster_id[ri] <- cid
        active_eps$cluster_pivot[ri] <- TRUE  # initialement pivot — peut être ajusté plus bas
      }
    }
  }

  # Pour chaque cluster, élire le "pivot" : le tier le plus élevé (rang le plus
  # bas dans la priorité), à égalité le pic le plus haut.
  TIER_RANK_R <- c(tsunami=1L, eclipse=2L, tempete=3L, forte=4L, alerte=5L, emergence=6L, none=99L)
  active_eps <- active_eps |>
    dplyr::mutate(.tier_rank = vapply(ep_tier, function(t) {
      v <- TIER_RANK_R[t]; if (is.na(v)) 99L else v
    }, integer(1))) |>
    dplyr::group_by(cluster_id) |>
    dplyr::mutate(
      .min_rank = min(.tier_rank, na.rm = TRUE),
      .max_peak_in_min_rank = max(ifelse(.tier_rank == .min_rank, ep_peak, -Inf), na.rm = TRUE),
      cluster_pivot = (.tier_rank == .min_rank) & (ep_peak == .max_peak_in_min_rank),
      cluster_size  = dplyr::n()
    ) |>
    # En cas d'égalité parfaite (deux objets pic identique), on garde le
    # premier (déterministe par ordre row_number()).
    dplyr::mutate(
      cluster_pivot = cluster_pivot & (dplyr::row_number(dplyr::if_else(cluster_pivot, 1L, 0L)) == 1L)
    ) |>
    dplyr::ungroup() |>
    dplyr::select(-.tier_rank, -.min_rank, -.max_peak_in_min_rank)

  # Joindre cluster_id, cluster_pivot, cluster_size sur df_episodes
  df_episodes <- df_episodes |>
    dplyr::left_join(
      active_eps |> dplyr::select(country_id, extracted_objects, .episode_idx,
                                  cluster_id, cluster_pivot, cluster_size),
      by = c("country_id", "extracted_objects", ".episode_idx")
    )

  n_clusters <- length(unique(active_eps$cluster_id))
  n_eps <- nrow(active_eps)
  cat("  →", n_eps, "épisodes regroupés en", n_clusters, "événements distincts (compression",
      sprintf("%.1f", n_eps / n_clusters), "x)\n")
} else {
  df_episodes$cluster_id    <- NA_character_
  df_episodes$cluster_pivot <- NA
  df_episodes$cluster_size  <- NA_integer_
}

# ─── Étape 5 : propagation tier + métadonnées épisode vers chaque bloc ───────
df_index <- df_index_with_ep |>
  dplyr::left_join(
    df_episodes |> dplyr::select(country_id, extracted_objects, .episode_idx,
                                 ep_tier, ep_episode_id, ep_first_day, ep_last_day,
                                 ep_n_days, ep_peak, ep_status,
                                 cluster_id, cluster_pivot, cluster_size),
    by = c("country_id", "extracted_objects", ".episode_idx")
  ) |>
  dplyr::mutate(
    alert_level             = ifelse(is.na(ep_tier), "none", ep_tier),
    alert_active            = alert_level %in% c("tsunami", "eclipse", "tempete", "forte", "alerte", "emergence"),
    alert_episode_id        = ep_episode_id,
    alert_episode_first_day = ep_first_day,
    alert_episode_last_day  = ep_last_day,
    alert_episode_n_days    = ep_n_days,
    alert_episode_peak      = ep_peak,
    alert_episode_status    = ep_status,
    alert_cluster_id        = cluster_id,
    alert_cluster_pivot     = ifelse(is.na(cluster_pivot), FALSE, cluster_pivot),
    alert_cluster_size      = cluster_size
  ) |>
  dplyr::select(-ep_tier, -ep_episode_id, -ep_first_day, -ep_last_day,
                -ep_n_days, -ep_peak, -ep_status,
                -cluster_id, -cluster_pivot, -cluster_size,
                -.in_event_day, -.episode_idx)

cat("  →", sum(df_index$alert_active, na.rm = TRUE), "blocs d'alerte sur", nrow(df_index), "lignes\n")
cat("  → Distribution par tier (blocs):\n")
tier_counts <- table(df_index$alert_level[df_index$alert_level != "none"])
for (lvl in c("tsunami", "eclipse", "tempete", "forte", "alerte", "emergence")) {
  if (!is.null(tier_counts[lvl]) && !is.na(tier_counts[lvl])) {
    cat("     ", sprintf("%-12s", lvl), tier_counts[[lvl]], "\n")
  }
}
cat("  → Épisodes distincts par tier:\n")
ep_tier_counts <- table(df_episodes$ep_tier[df_episodes$ep_tier != "none"])
for (lvl in c("tsunami", "eclipse", "tempete", "forte", "alerte", "emergence")) {
  if (!is.null(ep_tier_counts[lvl]) && !is.na(ep_tier_counts[lvl])) {
    cat("     ", sprintf("%-12s", lvl), ep_tier_counts[[lvl]], "\n")
  }
}

# ─── Nœuds : top N par période × pays (toute la fenêtre historique) ───────────

df_nodes <- df_index |>
  dplyr::group_by(country_id, date_utc, time_interval_utc) |>
  dplyr::slice_max(absolute_normalized_index, n = TOP_N_OBJECTS, with_ties = FALSE) |>
  dplyr::ungroup()

df_obj_media <- df_objects |>
  tidyr::separate_rows(extracted_objects, sep = ",") |>
  dplyr::mutate(
    extracted_objects = tolower(trimws(extracted_objects)),
    extracted_objects = stringr::str_remove_all(extracted_objects, "[[:punct:]]")
  ) |>
  dplyr::filter(!is.na(extracted_objects) & extracted_objects != "") |>
  dplyr::group_by(country_id, date_utc, time_interval_utc, extracted_objects) |>
  dplyr::summarise(media_ids = list(sort(unique(as.character(media_id)))), .groups = "drop")

# ─── Liens : co-occurrence (fenêtre graph seulement) ──────────────────────────

df_nodes_graph   <- df_nodes   |> dplyr::filter(date_utc >= graph_start)
df_objects_graph <- df_objects |> dplyr::filter(date_utc >= graph_start)

cat("Calcul des co-occurrences (", GRAPH_DAYS, "derniers jours)...\n")

df_obj_urls <- df_nodes_graph |>
  dplyr::mutate(
    url_list = purrr::map(urls, function(u) {
      tryCatch(jsonlite::fromJSON(u), error = function(e) character(0))
    })
  ) |>
  dplyr::select(country_id, date_utc, time_interval_utc, extracted_objects, url_list) |>
  tidyr::unnest(url_list) |>
  dplyr::rename(url = url_list) |>
  dplyr::filter(!is.na(url) & url != "")

df_edges <- df_obj_urls |>
  dplyr::inner_join(
    df_obj_urls |> dplyr::rename(extracted_objects_b = extracted_objects),
    by = c("country_id", "date_utc", "time_interval_utc", "url"),
    relationship = "many-to-many"
  ) |>
  dplyr::filter(extracted_objects < extracted_objects_b) |>
  dplyr::group_by(country_id, date_utc, time_interval_utc,
                  source = extracted_objects, target = extracted_objects_b) |>
  dplyr::summarise(value = dplyr::n(), .groups = "drop") |>
  dplyr::filter(value >= MIN_COOCCURRENCE)

df_obj_urls_media <- df_objects_graph |>
  dplyr::filter(!is.na(url) & url != "") |>
  tidyr::separate_rows(extracted_objects, sep = ",") |>
  dplyr::mutate(
    extracted_objects = tolower(trimws(extracted_objects)),
    extracted_objects = stringr::str_remove_all(extracted_objects, "[[:punct:]]")
  ) |>
  dplyr::filter(!is.na(extracted_objects) & extracted_objects != "") |>
  dplyr::select(country_id, date_utc, time_interval_utc, media_id, url, extracted_objects)

df_edges_media <- df_obj_urls_media |>
  dplyr::inner_join(
    df_obj_urls_media |> dplyr::rename(extracted_objects_b = extracted_objects),
    by = c("country_id", "date_utc", "time_interval_utc", "url"),
    relationship = "many-to-many"
  ) |>
  dplyr::mutate(media_id = dplyr::coalesce(media_id.x, media_id.y)) |>
  dplyr::filter(extracted_objects < extracted_objects_b) |>
  dplyr::group_by(country_id, date_utc, time_interval_utc,
                  source = extracted_objects, target = extracted_objects_b) |>
  dplyr::summarise(media_ids = list(sort(unique(as.character(media_id)))), .groups = "drop")

cat("  →", nrow(df_edges), "liens calculés\n")

# ─── Helpers ───────────────────────────────────────────────────────────────────

countries <- c("CAN", "QC", "USA")

parse_json_chr <- function(x) {
  if (is.na(x) || !nzchar(x)) return(character(0))
  tryCatch(as.character(jsonlite::fromJSON(x)), error = function(e) character(0))
}

rows_to_records <- function(df) {
  if (nrow(df) == 0) return(list())

  df_safe <- df |>
    dplyr::mutate(
      dplyr::across(tidyselect::where(~ inherits(.x, "Date")), as.character),
      dplyr::across(tidyselect::where(~ inherits(.x, "POSIXt")), as.character)
    )

  purrr::transpose(df_safe)
}

url_to_media <- {
  lkp <- df_objects |>
    dplyr::filter(!is.na(url) & url != "") |>
    dplyr::distinct(url, .keep_all = TRUE) |>
    dplyr::select(url, media_id)
  setNames(as.character(lkp$media_id), lkp$url)
}

build_articles <- function(urls_json, titles_json, max_articles = 15) {
  urls <- parse_json_chr(urls_json)
  if (!length(urls)) return(list())
  titles <- parse_json_chr(titles_json)
  if (!length(titles)) titles <- rep("", length(urls))
  if (length(titles) < length(urls)) titles <- c(titles, rep("", length(urls) - length(titles)))
  seen <- character(0)
  out  <- list()
  for (i in seq_along(urls)) {
    u <- urls[i]
    if (is.na(u) || !nzchar(u) || u %in% seen) next
    seen <- c(seen, u)
    title_i <- trimws(titles[i])
    media_i <- url_to_media[u]
    out[[length(out) + 1]] <- list(
      title    = if (nzchar(title_i)) title_i else u,
      url      = u,
      media_id = if (!is.na(media_i)) unname(media_i) else NULL
    )
    if (length(out) >= max_articles) break
  }
  out
}

# ─── Clustering événementiel ─────────────────────────────────────────────────
# Une alerte signale un OBJET. Mais plusieurs objets peuvent monter ensemble
# parce qu'ils couvrent le même événement (ex: WHO + Alberta + hantavirus →
# un seul événement: la situation hantavirus). On regroupe les alertes par
# pivot d'événement = objet (alerte ou non) qui CONTIENT les articles des
# membres du cluster. Métrique: containment(membre → pivot) ≥ seuil.
ALERT_EVENT_CONTAINMENT <- 0.5

parse_urls_set <- function(urls_json) {
  u <- parse_json_chr(urls_json)
  unique(u[!is.na(u) & nzchar(u)])
}

build_alert_events <- function(nodes_i) {
  # nodes_i: data frame d'une (country, période), Top N filtré, avec colonnes
  # extracted_objects, urls, alert_active, alert_level, alert_score, n,
  # absolute_normalized_index. Doit déjà être ordonné par desc(saillance).
  if (nrow(nodes_i) < 2) return(list())

  alert_idx <- which(isTRUE(nodes_i$alert_active) | nodes_i$alert_active %in% TRUE)
  if (!length(alert_idx)) return(list())

  urls_sets <- lapply(nodes_i$urls, parse_urls_set)

  # Pour chaque candidat-pivot, lister les alertes dont containment ≥ seuil
  candidates <- list()
  for (p in seq_len(nrow(nodes_i))) {
    pivot_urls <- urls_sets[[p]]
    if (length(pivot_urls) < 2) next  # pivot doit avoir au moins 2 articles
    members <- integer(0)
    contains <- numeric(0)
    for (a in alert_idx) {
      if (a == p) next
      member_urls <- urls_sets[[a]]
      if (!length(member_urls)) next
      cc <- length(intersect(member_urls, pivot_urls)) / length(member_urls)
      if (cc >= ALERT_EVENT_CONTAINMENT) {
        members <- c(members, a)
        contains <- c(contains, cc)
      }
    }
    if (length(members) > 0) {
      # Score qualité du pivot = precision × recall.
      #   precision = part des articles DU PIVOT qui appartiennent au cluster
      #               (pénalise un pivot qui couvre trop large)
      #   recall    = avg containment des membres vers le pivot (déjà calculé)
      member_urls_union <- character(0)
      for (mm in members) member_urls_union <- union(member_urls_union, urls_sets[[mm]])
      pivot_precision <- if (length(pivot_urls) > 0) {
        length(intersect(pivot_urls, member_urls_union)) / length(pivot_urls)
      } else 0
      avg_recall <- mean(contains)
      candidates[[length(candidates) + 1]] <- list(
        pivot = p, members = members, contains = contains,
        score = pivot_precision * avg_recall,
        pivot_urls_count = length(pivot_urls)
      )
    }
  }
  if (!length(candidates)) return(list())

  # Tri: score (precision × recall) desc, puis pivot le plus ciblé (urls min)
  # en départage. Favorise hantavirus (3 articles tous sur le sujet, p=1.0)
  # plutôt qu'ontario (4 articles dont 1 hors-cluster, p=0.75) quand les deux
  # couvrent les mêmes membres.
  candidates <- candidates[order(
    -sapply(candidates, function(c) c$score),
     sapply(candidates, function(c) c$pivot_urls_count)
  )]

  used <- integer(0)  # indices déjà consommés (pivot OU membre)
  events <- list()
  for (cl in candidates) {
    if (cl$pivot %in% used) next  # pivot déjà attribué à un autre cluster
    remaining_idx <- which(!cl$members %in% used)
    if (!length(remaining_idx)) next
    members <- cl$members[remaining_idx]
    contains <- cl$contains[remaining_idx]
    used <- c(used, cl$pivot, members)

    p <- cl$pivot
    pivot_id <- nodes_i$extracted_objects[p]
    pivot_urls <- urls_sets[[p]]

    # Articles partagés = intersection union(membres) ∩ pivot
    member_url_union <- character(0)
    for (m in members) member_url_union <- union(member_url_union, urls_sets[[m]])
    shared_urls <- intersect(member_url_union, pivot_urls)

    # Récupérer les objets {title,url,media_id} pour ces shared_urls.
    # Le pivot a ses propres articles déjà parsés; on filtre par URL.
    pivot_arts_full <- build_articles(nodes_i$urls[p], nodes_i$titles[p])
    shared_articles <- Filter(function(a) a$url %in% shared_urls, pivot_arts_full)

    events[[length(events) + 1]] <- list(
      pivot = list(
        id           = pivot_id,
        size         = round(nodes_i$absolute_normalized_index[p], 3),
        n            = nodes_i$n[p],
        alert_level  = nodes_i$alert_level[p],
        alert_active = isTRUE(nodes_i$alert_active[p]),
        alert_score  = if (is.na(nodes_i$alert_score[p])) NULL else round(nodes_i$alert_score[p], 2)
      ),
      members = purrr::map(seq_along(members), function(k) {
        m <- members[k]
        list(
          id           = nodes_i$extracted_objects[m],
          alert_level  = nodes_i$alert_level[m],
          alert_score  = if (is.na(nodes_i$alert_score[m])) NULL else round(nodes_i$alert_score[m], 2),
          n            = nodes_i$n[m],
          containment  = round(contains[k], 3)
        )
      }),
      shared_articles       = shared_articles,
      shared_articles_count = length(shared_urls),
      total_members         = length(members)
    )
  }
  events
}

# Anti-halo direct: filet de sécurité après le clustering. Si deux
# alertes actives partagent ≥ ALERT_HALO_THRESHOLD d'articles MAIS ne
# sont pas regroupées dans un même cluster (ni pivot, ni membre), on
# rétrograde celle au z-score le plus bas d'un cran. Évite les doublons
# redondants quand le clustering n'a pas trouvé de pivot évident.
HALO_DOWNGRADE <- c(
  tsunami   = "eclipse",
  eclipse   = "tempete",
  tempete   = "forte",
  forte     = "alerte",
  alerte    = "emergence",
  emergence = "none"
)

apply_halo_protection <- function(nodes_i, events) {
  if (nrow(nodes_i) < 2) return(nodes_i)

  clustered_ids <- character(0)
  for (e in events) {
    if (!is.null(e$pivot) && !is.null(e$pivot$id)) {
      clustered_ids <- c(clustered_ids, e$pivot$id)
    }
    if (!is.null(e$members) && length(e$members)) {
      clustered_ids <- c(clustered_ids, vapply(e$members, function(m) m$id, character(1)))
    }
  }
  clustered_ids <- unique(clustered_ids)

  active_mask <- isTRUE(nodes_i$alert_active) | nodes_i$alert_active %in% TRUE
  candidates <- which(active_mask & !nodes_i$extracted_objects %in% clustered_ids)
  if (length(candidates) < 2) return(nodes_i)

  urls_sets <- lapply(nodes_i$urls[candidates], parse_urls_set)

  for (i in seq_along(candidates)) {
    for (j in seq_along(candidates)) {
      if (i >= j) next
      a <- candidates[i]; b <- candidates[j]
      ua <- urls_sets[[i]]; ub <- urls_sets[[j]]
      if (!length(ua) || !length(ub)) next
      inter <- length(intersect(ua, ub))
      if (inter == 0) next
      cab <- inter / length(ua)
      cba <- inter / length(ub)
      if (max(cab, cba) >= ALERT_HALO_THRESHOLD) {
        za <- nodes_i$alert_score[a]; zb <- nodes_i$alert_score[b]
        za_v <- if (is.na(za)) -Inf else za
        zb_v <- if (is.na(zb)) -Inf else zb
        loser <- if (za_v <= zb_v) a else b
        old_lvl <- nodes_i$alert_level[loser]
        new_lvl <- HALO_DOWNGRADE[old_lvl]
        if (!is.na(new_lvl) && new_lvl != old_lvl) {
          nodes_i$alert_level[loser] <- unname(new_lvl)
          nodes_i$alert_active[loser] <- new_lvl %in% c("tsunami", "eclipse", "tempete", "forte", "alerte", "emergence")
        }
      }
    }
  }
  nodes_i
}

make_periods_df <- function(df) {
  df |>
    dplyr::distinct(date_utc, time_interval_utc) |>
    dplyr::arrange(date_utc, time_interval_utc) |>
    dplyr::mutate(
      key   = paste0(date_utc, "_", time_interval_utc),
      label = {
        parts <- strsplit(time_interval_utc, "-")
        est_start <- (as.integer(sapply(parts, `[`, 1)) - 4) %% 24
        est_end   <- (as.integer(sapply(parts, `[`, 2)) - 4) %% 24
        est_interval <- paste0(est_start, "-", est_end)
        # Adjust date if interval crosses midnight (UTC 0-3 → EDT prev day 20-23)
        est_date <- ifelse(as.integer(sapply(parts, `[`, 1)) < 4,
                           format(as.Date(date_utc) - 1, "%b %d"),
                           format(as.Date(date_utc), "%b %d"))
        paste0(est_date, " · ", est_interval, " EDT")
      }
    )
}

make_periods_list <- function(df_p) {
  purrr::map(seq_len(nrow(df_p)), function(i) list(
    key      = df_p$key[i],
    date     = as.character(df_p$date_utc[i]),
    interval = df_p$time_interval_utc[i],
    label    = df_p$label[i]
  ))
}

all_media_ids <- df_objects |>
  dplyr::filter(!is.na(media_id) & media_id != "") |>
  dplyr::distinct(media_id) |>
  dplyr::arrange(media_id) |>
  dplyr::pull(media_id) |>
  as.character()

# ─── graph.json ────────────────────────────────────────────────────────────────

cat("\nAssemblage graph.json (", GRAPH_DAYS, "jours)...\n")

periods_graph <- make_periods_df(df_nodes_graph)

graphs_graph <- purrr::map(countries, function(country) {
  purrr::map(seq_len(nrow(periods_graph)), function(i) {
    d  <- periods_graph$date_utc[i]
    ti <- periods_graph$time_interval_utc[i]

    excl <- EXCLUSION_BY_COUNTRY[[country]]  # NULL si pays inconnu → aucune exclusion

    nodes_i    <- df_nodes_graph |> dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti) |> dplyr::filter(!tolower(extracted_objects) %in% excl) |> dplyr::arrange(dplyr::desc(absolute_normalized_index))
    node_med_i <- df_obj_media   |> dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti)
    links_i    <- df_edges       |> dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti) |> dplyr::filter(!tolower(source) %in% excl, !tolower(target) %in% excl)
    link_med_i <- df_edges_media |> dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti) |> dplyr::filter(!tolower(source) %in% excl, !tolower(target) %in% excl)

    # Cluster d'événements et anti-halo: on commence par identifier les
    # clusters, puis on rétrograde les alertes redondantes hors cluster
    # AVANT de produire la structure de nodes finale.
    period_events <- build_alert_events(nodes_i)
    nodes_i <- apply_halo_protection(nodes_i, period_events)

    # Convergence d'agenda pour cette période (lookup dans df_convergence)
    period_convergence <- {
      cv_row <- df_convergence |>
        dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti)
      if (nrow(cv_row) >= 1 && is.finite(cv_row$convergence[1])) round(cv_row$convergence[1], 3) else NULL
    }

    list(
      nodes = purrr::map(seq_len(nrow(nodes_i)), function(j) list(
        id        = nodes_i$extracted_objects[j],
        size      = round(nodes_i$absolute_normalized_index[j], 3),
        n         = nodes_i$n[j],
        alert_score = if (is.na(nodes_i$alert_score[j])) NULL else round(nodes_i$alert_score[j], 2),
        alert_delta = if (is.na(nodes_i$alert_delta[j])) NULL else round(nodes_i$alert_delta[j], 3),
        alert_baseline = if (is.na(nodes_i$alert_baseline[j])) NULL else round(nodes_i$alert_baseline[j], 3),
        alert_peak_ratio = if (is.na(nodes_i$alert_peak_ratio[j])) NULL else round(nodes_i$alert_peak_ratio[j], 3),
        alert_year_peak = if (is.na(nodes_i$alert_year_peak[j])) NULL else round(nodes_i$alert_year_peak[j], 3),
        alert_top_share = if (is.na(nodes_i$alert_top_share[j])) NULL else round(nodes_i$alert_top_share[j], 3),
        alert_streak = if (is.na(nodes_i$alert_streak[j])) NULL else as.integer(nodes_i$alert_streak[j]),
        alert_level = nodes_i$alert_level[j],
        alert_active = isTRUE(nodes_i$alert_active[j]),
        alert_episode_id        = if (is.na(nodes_i$alert_episode_id[j])) NULL else nodes_i$alert_episode_id[j],
        alert_episode_first_day = if (is.na(nodes_i$alert_episode_first_day[j])) NULL else as.character(nodes_i$alert_episode_first_day[j]),
        alert_episode_last_day  = if (is.na(nodes_i$alert_episode_last_day[j]))  NULL else as.character(nodes_i$alert_episode_last_day[j]),
        alert_episode_n_days    = if (is.na(nodes_i$alert_episode_n_days[j]))    NULL else as.integer(nodes_i$alert_episode_n_days[j]),
        alert_episode_peak      = if (is.na(nodes_i$alert_episode_peak[j]))      NULL else round(nodes_i$alert_episode_peak[j], 3),
        alert_episode_status    = if (is.na(nodes_i$alert_episode_status[j]))    NULL else nodes_i$alert_episode_status[j],
        alert_cluster_id        = if (is.na(nodes_i$alert_cluster_id[j]))    NULL else nodes_i$alert_cluster_id[j],
        alert_cluster_pivot     = isTRUE(nodes_i$alert_cluster_pivot[j]),
        alert_cluster_size      = if (is.na(nodes_i$alert_cluster_size[j])) NULL else as.integer(nodes_i$alert_cluster_size[j]),
        articles  = build_articles(nodes_i$urls[j], nodes_i$titles[j]),
        media_ids = {
          mm <- node_med_i |> dplyr::filter(extracted_objects == nodes_i$extracted_objects[j])
          if (nrow(mm) == 0) character(0) else mm$media_ids[[1]]
        }
      )),
      links = purrr::map(seq_len(nrow(links_i)), function(j) list(
        source    = links_i$source[j],
        target    = links_i$target[j],
        value     = links_i$value[j],
        media_ids = {
          lm <- link_med_i |> dplyr::filter(source == links_i$source[j], target == links_i$target[j])
          if (nrow(lm) == 0) character(0) else lm$media_ids[[1]]
        }
      )),
      events = period_events,
      convergence = period_convergence
    )
  }) |> setNames(periods_graph$key)
}) |> setNames(countries)

# Persistance d'événements: lier les events des périodes consécutives
# par chevauchement de membres (Jaccard sur ids ≥ 0.5). Assigne un
# event_id stable à un événement qui persiste sur plusieurs périodes
# 4h. Permet au frontend de reconnaître qu'un cruise ship sur 5
# périodes consécutives = UN événement de 5 périodes, pas 5 events.
ALERT_EVENT_LINK_THRESHOLD <- 0.5

link_events_persistence <- function(graphs_country, periods_keys_ordered, country) {
  prev_events <- list()
  counter <- 0L
  for (pk in periods_keys_ordered) {
    gd <- graphs_country[[pk]]
    if (is.null(gd) || is.null(gd$events) || !length(gd$events)) {
      prev_events <- list()
      next
    }
    new_events <- list()
    for (ev in gd$events) {
      member_ids <- if (length(ev$members)) {
        vapply(ev$members, function(m) m$id, character(1))
      } else character(0)
      ev_signature <- c(ev$pivot$id, member_ids)

      best_pe <- NULL
      best_jaccard <- 0
      for (pe in prev_events) {
        pe_member_ids <- if (length(pe$members)) {
          vapply(pe$members, function(m) m$id, character(1))
        } else character(0)
        pe_signature <- c(pe$pivot$id, pe_member_ids)
        union_size <- length(union(ev_signature, pe_signature))
        if (union_size <= 0) next
        j <- length(intersect(ev_signature, pe_signature)) / union_size
        if (j > best_jaccard) {
          best_jaccard <- j
          best_pe <- pe
        }
      }
      if (best_jaccard >= ALERT_EVENT_LINK_THRESHOLD && !is.null(best_pe)) {
        ev$event_id <- best_pe$event_id
        ev$is_continuation <- TRUE
        ev$continuation_jaccard <- round(best_jaccard, 3)
      } else {
        counter <- counter + 1L
        ev$event_id <- paste0(country, "-ev-", counter, "-", ev$pivot$id)
        ev$is_continuation <- FALSE
        ev$continuation_jaccard <- NULL
      }
      new_events[[length(new_events) + 1]] <- ev
    }
    graphs_country[[pk]]$events <- new_events
    prev_events <- new_events
  }
  graphs_country
}

graphs_graph <- purrr::imap(graphs_graph, function(graphs_country, country) {
  link_events_persistence(graphs_country, periods_graph$key, country)
})

result_graph <- list(
  meta = list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    mode         = "graph",
    graph_days   = GRAPH_DAYS,
    top_n        = TOP_N_OBJECTS,
    alert_thresholds = list(
      # Taxonomie 5 tiers : magnitude (paliers saillance) × temporalité (durée).
      # Voir methodologie.html §10 pour les définitions complètes.
      z_threshold      = ALERT_Z_THRESHOLD,
      min_mentions     = ALERT_MIN_MENTIONS,
      min_abs_score    = ALERT_MIN_ABS_SCORE,
      days_short_max   = ALERT_DAYS_SHORT_MAX,
      days_eclipse_min = ALERT_DAYS_LONG_MIN_ECL,
      days_tempete_min = ALERT_DAYS_LONG_MIN_TMP,
      tsunami = list(
        min_vhi_blocs    = ALERT_TSUNAMI_MIN_VHI_BLOCS,
        top_share_peak   = ALERT_TS_TSUNAMI_PEAK,
        convergence_pctl = ALERT_CONV_PCTL_TSUNAMI
      ),
      eclipse = list(
        min_vhi_days     = ALERT_ECLIPSE_MIN_VHI_DAYS,
        top_share_mean   = ALERT_TS_ECLIPSE_MEAN,
        convergence_pctl = ALERT_CONV_PCTL_ECLIPSE
      ),
      forte = list(
        streak         = ALERT_STREAK_ALERTE_FORTE,
        top_share_peak = ALERT_TS_ALERTE_FORTE_PEAK
      ),
      alerte = list(
        streak         = ALERT_STREAK_ALERTE,
        top_share_peak = ALERT_TS_ALERTE_PEAK
      ),
      emergence = list(
        streak         = ALERT_STREAK_EMERGENCE,
        top_share_peak = ALERT_TS_EMERGENCE_PEAK
      ),
      convergence_thresholds_by_country = convergence_thresholds,
      halo_threshold    = ALERT_HALO_THRESHOLD,
      block_hours       = 4,
      lookback_days     = ALERT_LOOKBACK_PERIODS * 4 / 24,
      event_containment = ALERT_EVENT_CONTAINMENT
    ),
    # Paliers de saillance absolue par pays (percentiles de la distribution
    # empirique sur la fenêtre HISTORY_DAYS). Permettent au frontend de
    # situer un score de saillance sur une échelle moderate/high/very_high/extreme.
    salience_tiers = salience_tiers,
    media_ids    = all_media_ids,
    periods      = make_periods_list(periods_graph),
    countries    = countries
  ),
  graphs = graphs_graph
)

jsonlite::write_json(result_graph, GRAPH_FILE, auto_unbox = TRUE, pretty = FALSE)
cat("✓ graph.json      :", round(file.size(GRAPH_FILE) / 1024 / 1024, 2), "Mo —",
    nrow(periods_graph), "périodes\n")

# ─── timeseries.json ───────────────────────────────────────────────────────────

cat("\nAssemblage timeseries.json (", HISTORY_DAYS, "jours, sans articles)...\n")

periods_ts <- make_periods_df(df_nodes)

# On bâtit en parallèle :
#   - graphs_ts : nœuds (id/size/n) sans articles → fichier léger pour le chart
#   - articles_ts : articles indexés par country / period / node_id → fichier lourd lazy-load
graphs_ts <- list()
articles_ts <- list()

for (country in countries) {
  excl <- EXCLUSION_BY_COUNTRY[[country]]
  graphs_country <- list()
  articles_country <- list()
  for (i in seq_len(nrow(periods_ts))) {
    d  <- periods_ts$date_utc[i]
    ti <- periods_ts$time_interval_utc[i]
    pk <- periods_ts$key[i]

    nodes_i <- df_nodes |>
      dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti) |>
      dplyr::filter(!tolower(extracted_objects) %in% excl) |>
      dplyr::arrange(dplyr::desc(absolute_normalized_index))

    # Anti-halo aussi pour timeseries (cohérence avec graph.json)
    period_events_ts <- build_alert_events(nodes_i)
    nodes_i <- apply_halo_protection(nodes_i, period_events_ts)

    # Convergence
    period_convergence_ts <- {
      cv_row <- df_convergence |>
        dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti)
      if (nrow(cv_row) >= 1 && is.finite(cv_row$convergence[1])) round(cv_row$convergence[1], 3) else NULL
    }

    period_nodes <- list()
    period_articles <- list()
    if (nrow(nodes_i) > 0) {
      for (j in seq_len(nrow(nodes_i))) {
        nid <- nodes_i$extracted_objects[j]
        period_nodes[[length(period_nodes) + 1]] <- list(
          id             = nid,
          size           = round(nodes_i$absolute_normalized_index[j], 3),
          n              = nodes_i$n[j],
          alert_score    = if (is.na(nodes_i$alert_score[j])) NULL else round(nodes_i$alert_score[j], 2),
          alert_delta    = if (is.na(nodes_i$alert_delta[j])) NULL else round(nodes_i$alert_delta[j], 3),
          alert_baseline = if (is.na(nodes_i$alert_baseline[j])) NULL else round(nodes_i$alert_baseline[j], 3),
          alert_peak_ratio = if (is.na(nodes_i$alert_peak_ratio[j])) NULL else round(nodes_i$alert_peak_ratio[j], 3),
          alert_year_peak = if (is.na(nodes_i$alert_year_peak[j])) NULL else round(nodes_i$alert_year_peak[j], 3),
          alert_top_share = if (is.na(nodes_i$alert_top_share[j])) NULL else round(nodes_i$alert_top_share[j], 3),
          alert_streak   = if (is.na(nodes_i$alert_streak[j])) NULL else as.integer(nodes_i$alert_streak[j]),
          alert_level    = nodes_i$alert_level[j],
          alert_active   = isTRUE(nodes_i$alert_active[j]),
          alert_episode_id        = if (is.na(nodes_i$alert_episode_id[j])) NULL else nodes_i$alert_episode_id[j],
          alert_episode_first_day = if (is.na(nodes_i$alert_episode_first_day[j])) NULL else as.character(nodes_i$alert_episode_first_day[j]),
          alert_episode_last_day  = if (is.na(nodes_i$alert_episode_last_day[j]))  NULL else as.character(nodes_i$alert_episode_last_day[j]),
          alert_episode_n_days    = if (is.na(nodes_i$alert_episode_n_days[j]))    NULL else as.integer(nodes_i$alert_episode_n_days[j]),
          alert_episode_peak      = if (is.na(nodes_i$alert_episode_peak[j]))      NULL else round(nodes_i$alert_episode_peak[j], 3),
          alert_episode_status    = if (is.na(nodes_i$alert_episode_status[j]))    NULL else nodes_i$alert_episode_status[j],
          alert_cluster_id        = if (is.na(nodes_i$alert_cluster_id[j]))    NULL else nodes_i$alert_cluster_id[j],
          alert_cluster_pivot     = isTRUE(nodes_i$alert_cluster_pivot[j]),
          alert_cluster_size      = if (is.na(nodes_i$alert_cluster_size[j])) NULL else as.integer(nodes_i$alert_cluster_size[j])
        )
        arts <- build_articles(nodes_i$urls[j], nodes_i$titles[j])
        if (length(arts) > 0) period_articles[[nid]] <- arts
      }
    }

    graphs_country[[pk]] <- list(
      nodes = period_nodes,
      links = list(),
      convergence = period_convergence_ts
    )
    articles_country[[pk]] <- period_articles
  }
  graphs_ts[[country]] <- graphs_country
  articles_ts[[country]] <- articles_country
}

result_ts <- list(
  meta = list(
    generated_at  = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    mode          = "timeseries",
    history_days  = HISTORY_DAYS,
    top_n         = TOP_N_OBJECTS,
    alert_thresholds = list(
      z_threshold      = ALERT_Z_THRESHOLD,
      min_mentions     = ALERT_MIN_MENTIONS,
      min_abs_score    = ALERT_MIN_ABS_SCORE,
      days_short_max   = ALERT_DAYS_SHORT_MAX,
      days_eclipse_min = ALERT_DAYS_LONG_MIN_ECL,
      days_tempete_min = ALERT_DAYS_LONG_MIN_TMP,
      tsunami = list(
        min_vhi_blocs    = ALERT_TSUNAMI_MIN_VHI_BLOCS,
        top_share_peak   = ALERT_TS_TSUNAMI_PEAK,
        convergence_pctl = ALERT_CONV_PCTL_TSUNAMI
      ),
      eclipse = list(
        min_vhi_days     = ALERT_ECLIPSE_MIN_VHI_DAYS,
        top_share_mean   = ALERT_TS_ECLIPSE_MEAN,
        convergence_pctl = ALERT_CONV_PCTL_ECLIPSE
      ),
      forte = list(
        streak         = ALERT_STREAK_ALERTE_FORTE,
        top_share_peak = ALERT_TS_ALERTE_FORTE_PEAK
      ),
      alerte = list(
        streak         = ALERT_STREAK_ALERTE,
        top_share_peak = ALERT_TS_ALERTE_PEAK
      ),
      emergence = list(
        streak         = ALERT_STREAK_EMERGENCE,
        top_share_peak = ALERT_TS_EMERGENCE_PEAK
      ),
      convergence_thresholds_by_country = convergence_thresholds,
      halo_threshold = ALERT_HALO_THRESHOLD,
      block_hours    = 4,
      lookback_days  = ALERT_LOOKBACK_PERIODS * 4 / 24
    ),
    salience_tiers = salience_tiers,
    periods       = make_periods_list(periods_ts),
    countries     = countries
  ),
  graphs = graphs_ts
)

jsonlite::write_json(result_ts, TS_FILE, auto_unbox = TRUE, pretty = FALSE)
cat("✓ timeseries.json :", round(file.size(TS_FILE) / 1024 / 1024, 2), "Mo —",
    nrow(periods_ts), "périodes\n")

# ─── articles.json (lazy-loadé côté client) ───────────────────────────────────

result_articles <- list(
  meta = list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    history_days = HISTORY_DAYS
  ),
  articles = articles_ts
)
jsonlite::write_json(result_articles, ARTICLES_FILE, auto_unbox = TRUE, pretty = FALSE)
cat("✓ articles.json   :", round(file.size(ARTICLES_FILE) / 1024 / 1024, 2), "Mo —",
    nrow(periods_ts), "périodes\n")

# ─── monitor_input.json (tops entrée complets) ───────────────────────────────

cat("\nAssemblage monitor_input.json (tops entrée)...\n")

required_index_cols <- c(
  "country_id", "date_utc", "time_interval_utc", "extracted_objects",
  "absolute_normalized_index", "n", "urls", "titles"
)
required_objects_cols <- c(
  "country_id", "time_interval_utc", "media_id", "url",
  "headline_stop_utc", "extracted_objects"
)

missing_index_cols <- setdiff(required_index_cols, names(df_index))
missing_objects_cols <- setdiff(required_objects_cols, names(df_objects))

if (length(missing_index_cols) > 0) {
  stop("Colonnes manquantes dans df_index: ", paste(missing_index_cols, collapse = ", "))
}
if (length(missing_objects_cols) > 0) {
  stop("Colonnes manquantes dans df_objects: ", paste(missing_objects_cols, collapse = ", "))
}

latest_periods <- df_index |>
  dplyr::distinct(country_id, date_utc, time_interval_utc) |>
  dplyr::arrange(country_id, dplyr::desc(date_utc), dplyr::desc(time_interval_utc)) |>
  dplyr::group_by(country_id) |>
  dplyr::slice_head(n = 1) |>
  dplyr::ungroup() |>
  dplyr::mutate(period_key = paste0(date_utc, "_", time_interval_utc))

build_top_input_rows <- function(country) {
  p <- latest_periods |>
    dplyr::filter(country_id == country)

  if (nrow(p) == 0) {
    return(list(
      period_key = NULL,
      salient_index_top = list(),
      salient_objects_top = list()
    ))
  }

  d <- p$date_utc[[1]]
  ti <- p$time_interval_utc[[1]]
  pk <- p$period_key[[1]]

  idx_top <- df_index |>
    dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti) |>
    dplyr::arrange(dplyr::desc(absolute_normalized_index), dplyr::desc(n)) |>
    dplyr::slice_head(n = TOP_N_OBJECTS)

  obj_top <- df_objects |>
    dplyr::mutate(period_date = as.Date(substr(as.character(headline_stop_utc), 1, 10))) |>
    dplyr::filter(country_id == country, period_date == d, time_interval_utc == ti) |>
    dplyr::arrange(dplyr::desc(headline_stop_utc)) |>
    dplyr::select(-period_date) |>
    dplyr::slice_head(n = TOP_N_OBJECTS)

  list(
    period_key = pk,
    salient_index_top = rows_to_records(idx_top),
    salient_objects_top = rows_to_records(obj_top)
  )
}

by_country <- purrr::map(countries, build_top_input_rows) |>
  stats::setNames(countries)

monitor_input <- list(
  meta = list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    top_n = TOP_N_OBJECTS,
    countries = countries,
    columns = list(
      salient_index = names(df_index),
      salient_objects = names(df_objects)
    )
  ),
  by_country = by_country
)

jsonlite::write_json(monitor_input, MONITOR_INPUT_FILE, auto_unbox = TRUE, pretty = FALSE)
cat("✓ monitor_input.json:", round(file.size(MONITOR_INPUT_FILE) / 1024, 1), "Ko\n")

cat("\nFini!\n")
