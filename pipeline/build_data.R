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

ALERT_LOOKBACK_PERIODS <- 180  # 30 jours glissants de périodes 4h
ALERT_MIN_HISTORY      <- 18   # Historique minimal avant score robuste
ALERT_MIN_MENTIONS_WATCH  <- 2 # Évite les signaux trop faibles
ALERT_MIN_MENTIONS_ALERT  <- 3
ALERT_MIN_MENTIONS_STRONG <- 4
# Plancher absolu de saillance courante. Relevé de 0.08 à 1.0 pour
# éliminer les alertes sur des objets qui pèsent à peine sur le radar
# (un objet à 0.3 absolu reste invisible par rapport à un Top à ~10).
ALERT_MIN_ABS_SCORE    <- 1.0
ALERT_SCALE_FLOOR      <- 0.08 # Évite les explosions sur séries quasi constantes
ALERT_THRESHOLD_WATCH  <- 1.8
ALERT_THRESHOLD_ALERT  <- 2.6
ALERT_THRESHOLD_STRONG <- 3.8
ALERT_PEAK_RATIO_WATCH  <- 0.15
ALERT_PEAK_RATIO_ALERT  <- 0.30
ALERT_PEAK_RATIO_STRONG <- 0.55
# Part minimum du Top de la période — filtre cross-object pour s'assurer
# qu'une alerte signale un objet réellement visible AUJOURD'HUI, pas
# seulement inhabituel pour son propre historique. La part = saillance
# courante / saillance du Top 1 du pays·période.
ALERT_TOP_SHARE_WATCH  <- 0.10
ALERT_TOP_SHARE_ALERT  <- 0.20
ALERT_TOP_SHARE_STRONG <- 0.35

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
  alert_level <- rep("none", n_scores)
  alert_active <- rep(FALSE, n_scores)

  if (n_scores == 0) {
    return(list(
      alert_score = alert_score,
      alert_delta = alert_delta,
      alert_baseline = alert_baseline,
      alert_peak_ratio = alert_peak_ratio,
      alert_year_peak = alert_year_peak,
      alert_level = alert_level,
      alert_active = alert_active
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
      next
    }

    history_values <- log_scores[history_start:history_end]
    history_values <- history_values[is.finite(history_values)]
    if (length(history_values) < ALERT_MIN_HISTORY) {
      if (current_mentions >= ALERT_MIN_MENTIONS_WATCH && current_score >= ALERT_MIN_ABS_SCORE) {
        alert_level[i] <- "emerging"
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

    if (current_mentions < ALERT_MIN_MENTIONS_WATCH || current_score < ALERT_MIN_ABS_SCORE || !is.finite(score)) {
      next
    }

    if (
      score >= ALERT_THRESHOLD_STRONG &&
      current_mentions >= ALERT_MIN_MENTIONS_STRONG &&
      is.finite(peak_ratio) &&
      peak_ratio >= ALERT_PEAK_RATIO_STRONG
    ) {
      alert_level[i] <- "strong"
      alert_active[i] <- TRUE
    } else if (
      score >= ALERT_THRESHOLD_ALERT &&
      current_mentions >= ALERT_MIN_MENTIONS_ALERT &&
      is.finite(peak_ratio) &&
      peak_ratio >= ALERT_PEAK_RATIO_ALERT
    ) {
      alert_level[i] <- "alert"
      alert_active[i] <- TRUE
    } else if (
      score >= ALERT_THRESHOLD_WATCH &&
      current_mentions >= ALERT_MIN_MENTIONS_WATCH &&
      (is.na(peak_ratio) || peak_ratio >= ALERT_PEAK_RATIO_WATCH)
    ) {
      alert_level[i] <- "watch"
      alert_active[i] <- TRUE
    }
  }

  list(
    alert_score = alert_score,
    alert_delta = alert_delta,
    alert_baseline = alert_baseline,
    alert_peak_ratio = alert_peak_ratio,
    alert_year_peak = alert_year_peak,
    alert_level = alert_level,
    alert_active = alert_active
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
df_index <- df_index |>
  dplyr::arrange(country_id, extracted_objects, date_utc, time_interval_utc) |>
  dplyr::group_by(country_id, extracted_objects) |>
  dplyr::group_modify(function(.x, .y) {
    metrics <- compute_alert_metrics(.x$absolute_normalized_index, .x$n, .x$date_utc)
    dplyr::mutate(
      .x,
      alert_score = metrics$alert_score,
      alert_delta = metrics$alert_delta,
      alert_baseline = metrics$alert_baseline,
      alert_peak_ratio = metrics$alert_peak_ratio,
      alert_year_peak = metrics$alert_year_peak,
      alert_level = metrics$alert_level,
      alert_active = metrics$alert_active
    )
  }) |>
  dplyr::ungroup()

# Filtre cross-object: une alerte ne tient que si l'objet pèse réellement
# sur le radar de la période. On compare sa saillance courante à celle du
# Top 1 du pays·période. Si la part est insuffisante, le niveau est
# rétrogradé d'un cran (strong → alert → watch → none).
downgrade_by_top_share <- function(level, top_share) {
  if (is.na(level) || is.na(top_share)) return(level)
  if (level == "strong" && top_share < ALERT_TOP_SHARE_STRONG) level <- "alert"
  if (level == "alert"  && top_share < ALERT_TOP_SHARE_ALERT)  level <- "watch"
  if (level == "watch"  && top_share < ALERT_TOP_SHARE_WATCH)  level <- "none"
  level
}

df_index <- df_index |>
  dplyr::group_by(country_id, date_utc, time_interval_utc) |>
  dplyr::mutate(
    alert_top_share = dplyr::if_else(
      max(absolute_normalized_index, na.rm = TRUE) > 0,
      absolute_normalized_index / max(absolute_normalized_index, na.rm = TRUE),
      NA_real_
    )
  ) |>
  dplyr::ungroup() |>
  dplyr::mutate(
    alert_level = purrr::map2_chr(alert_level, alert_top_share, downgrade_by_top_share),
    alert_active = alert_level %in% c("strong", "alert", "watch")
  )

cat("  →", sum(df_index$alert_active, na.rm = TRUE), "points d'alerte actifs sur", nrow(df_index), "lignes\n")

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
        alert_level = nodes_i$alert_level[j],
        alert_active = isTRUE(nodes_i$alert_active[j]),
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
      ))
    )
  }) |> setNames(periods_graph$key)
}) |> setNames(countries)

result_graph <- list(
  meta = list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    mode         = "graph",
    graph_days   = GRAPH_DAYS,
    top_n        = TOP_N_OBJECTS,
    alert_thresholds = list(
      watch = ALERT_THRESHOLD_WATCH,
      alert = ALERT_THRESHOLD_ALERT,
      strong = ALERT_THRESHOLD_STRONG,
      min_mentions = list(
        watch = ALERT_MIN_MENTIONS_WATCH,
        alert = ALERT_MIN_MENTIONS_ALERT,
        strong = ALERT_MIN_MENTIONS_STRONG
      ),
      min_peak_ratio = list(
        watch = ALERT_PEAK_RATIO_WATCH,
        alert = ALERT_PEAK_RATIO_ALERT,
        strong = ALERT_PEAK_RATIO_STRONG
      ),
      min_top_share = list(
        watch = ALERT_TOP_SHARE_WATCH,
        alert = ALERT_TOP_SHARE_ALERT,
        strong = ALERT_TOP_SHARE_STRONG
      ),
      min_abs_score = ALERT_MIN_ABS_SCORE,
      # Fenêtre glissante utilisée pour le calcul du z-score d'alerte
      # (180 périodes × 4h ÷ 24 = 30 jours).
      lookback_days = ALERT_LOOKBACK_PERIODS * 4 / 24
    ),
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
          alert_level    = nodes_i$alert_level[j],
          alert_active   = isTRUE(nodes_i$alert_active[j])
        )
        arts <- build_articles(nodes_i$urls[j], nodes_i$titles[j])
        if (length(arts) > 0) period_articles[[nid]] <- arts
      }
    }

    graphs_country[[pk]] <- list(nodes = period_nodes, links = list())
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
      watch = ALERT_THRESHOLD_WATCH,
      alert = ALERT_THRESHOLD_ALERT,
      strong = ALERT_THRESHOLD_STRONG,
      min_mentions = list(
        watch = ALERT_MIN_MENTIONS_WATCH,
        alert = ALERT_MIN_MENTIONS_ALERT,
        strong = ALERT_MIN_MENTIONS_STRONG
      ),
      min_peak_ratio = list(
        watch = ALERT_PEAK_RATIO_WATCH,
        alert = ALERT_PEAK_RATIO_ALERT,
        strong = ALERT_PEAK_RATIO_STRONG
      ),
      min_top_share = list(
        watch = ALERT_TOP_SHARE_WATCH,
        alert = ALERT_TOP_SHARE_ALERT,
        strong = ALERT_TOP_SHARE_STRONG
      ),
      min_abs_score = ALERT_MIN_ABS_SCORE,
      # Fenêtre glissante utilisée pour le calcul du z-score d'alerte
      # (180 périodes × 4h ÷ 24 = 30 jours).
      lookback_days = ALERT_LOOKBACK_PERIODS * 4 / 24
    ),
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
