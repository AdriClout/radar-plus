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

ALERT_MIN_ABS_SCORE    <- 1.0  # Plancher absolu de saillance — sous ce seuil, rien

# ─── Taxonomie 3 niveaux (dérivés du pic de saillance) ───────────────────────
# Voir methodologie.html §10 pour la définition complète.
#
# Une alerte = un objet dont le pic de saillance dépasse le seuil "élevé"
# (p80 du pays). Trois niveaux selon le pic atteint dans l'épisode :
#   🟡 ÉLEVÉ       — pic ∈ [p80, p95[
#   🟠 TRÈS ÉLEVÉ  — pic ∈ [p95, p99[
#   🔴 EXTRÊME     — pic ≥ p99
#
# Pas de durée minimum (1 bloc 4h suffit). Pas de critère de streak/top_share
# /convergence dans la classification — uniquement le pic vs seuils calibrés.

# Clustering historique 130j : 2 épisodes du même pays sont considérés comme
# faisant partie du MÊME événement si leur intervalle temporel se chevauche
# ≥ N% de la durée du plus court. Permet de regrouper Iran+Israel (même date,
# même pays) ou les multiples objets d'une élection (Liberal Party +
# circonscriptions le même jour).
ALERT_CLUSTER_OVERLAP_FRAC <- 0.5

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

cat("Préparation des données d'alerte (3 niveaux dérivés du pic)...\n")

df_index <- df_index |>
  dplyr::arrange(country_id, extracted_objects, date_utc, time_interval_utc)

# ─── Paliers de saillance absolue par pays ───────────────────────────────────
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

# ─── Helper d'accès aux paliers par pays ─────────────────────────────────────
get_tier <- function(country, tier_name) {
  s <- salience_tiers[[country]]
  if (is.null(s) || is.null(s[[tier_name]])) return(NA_real_)
  s[[tier_name]]
}

# ─── Étape 3 : épisodes par (pays, objet) ────────────────────────────────────
# Un épisode = run de JOURS consécutifs où le pic quotidien >= palier_high (p80).
# Granularité jour pour le clustering, mais 1 bloc 4h suffit (pas de durée min).

cat("Détection des épisodes par (pays, objet) au seuil 'élevé' (p80)...\n")

# Agrégation jour-niveau
df_daily <- df_index |>
  dplyr::group_by(country_id, extracted_objects, date_utc) |>
  dplyr::summarise(
    day_peak = max(absolute_normalized_index, na.rm = TRUE),
    .groups  = "drop"
  )

# Runs de jours consécutifs où peak >= palier_high (p80 du pays).
df_daily <- df_daily |>
  dplyr::group_by(country_id, extracted_objects) |>
  dplyr::arrange(date_utc) |>
  dplyr::mutate(
    .tier_high    = vapply(country_id, function(c) get_tier(c, "high"), numeric(1)),
    .in_event_day = !is.na(.tier_high) & day_peak >= .tier_high,
    .day_diff     = as.integer(date_utc - dplyr::lag(date_utc)),
    .prev_in      = dplyr::lag(.in_event_day, default = FALSE),
    .new_episode  = .in_event_day & (is.na(.day_diff) | .day_diff != 1L | !.prev_in),
    .episode_idx  = cumsum(.new_episode & .in_event_day) * as.integer(.in_event_day)
  ) |>
  dplyr::ungroup() |>
  dplyr::select(-.day_diff, -.prev_in, -.new_episode, -.tier_high)

# Agrégats par épisode (granularité jour)
df_episodes <- df_daily |>
  dplyr::filter(.in_event_day, .episode_idx > 0) |>
  dplyr::group_by(country_id, extracted_objects, .episode_idx) |>
  dplyr::summarise(
    ep_first_day = min(date_utc),
    ep_last_day  = max(date_utc),
    ep_n_days    = dplyr::n(),
    ep_peak      = max(day_peak, na.rm = TRUE),
    .groups      = "drop"
  )

# Conserve l'index avec l'attribut épisode (utilisé Étape 5)
df_index_with_ep <- df_index |>
  dplyr::left_join(
    df_daily |> dplyr::select(country_id, extracted_objects, date_utc, .in_event_day, .episode_idx),
    by = c("country_id", "extracted_objects", "date_utc")
  )

# ─── Étape 4 : classification 3 niveaux (dérivés du pic) ─────────────────────
# eleve       : ep_peak ∈ [p80, p95[
# tres_eleve  : ep_peak ∈ [p95, p99[
# extreme     : ep_peak >= p99
classify_episode <- function(country, ep_peak) {
  tier_high <- get_tier(country, "high")
  tier_vhi  <- get_tier(country, "very_high")
  tier_ext  <- get_tier(country, "extreme")
  if (is.na(ep_peak) || is.na(tier_high) || ep_peak < tier_high) return("none")
  if (!is.na(tier_ext) && ep_peak >= tier_ext) return("extreme")
  if (!is.na(tier_vhi) && ep_peak >= tier_vhi) return("tres_eleve")
  "eleve"
}

df_episodes <- df_episodes |>
  dplyr::mutate(
    ep_tier = purrr::pmap_chr(list(country_id, ep_peak), classify_episode)
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
  TIER_RANK_R <- c(extreme=1L, tres_eleve=2L, eleve=3L, none=99L)
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
    alert_active            = alert_level %in% c("extreme", "tres_eleve", "eleve"),
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
cat("  → Distribution par niveau (blocs):\n")
tier_counts <- table(df_index$alert_level[df_index$alert_level != "none"])
for (lvl in c("extreme", "tres_eleve", "eleve")) {
  if (!is.null(tier_counts[lvl]) && !is.na(tier_counts[lvl])) {
    cat("     ", sprintf("%-12s", lvl), tier_counts[[lvl]], "\n")
  }
}
cat("  → Épisodes distincts par niveau:\n")
ep_tier_counts <- table(df_episodes$ep_tier[df_episodes$ep_tier != "none"])
for (lvl in c("extreme", "tres_eleve", "eleve")) {
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
  # extracted_objects, urls, alert_active, alert_level, n,
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
        alert_active = isTRUE(nodes_i$alert_active[p])
      ),
      members = purrr::map(seq_along(members), function(k) {
        m <- members[k]
        list(
          id           = nodes_i$extracted_objects[m],
          alert_level  = nodes_i$alert_level[m],
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

    period_events <- build_alert_events(nodes_i)

    list(
      nodes = purrr::map(seq_len(nrow(nodes_i)), function(j) list(
        id        = nodes_i$extracted_objects[j],
        size      = round(nodes_i$absolute_normalized_index[j], 3),
        n         = nodes_i$n[j],
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
      events = period_events
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
      # Taxonomie 3 niveaux : pic vs paliers de saillance par pays.
      # extreme    : pic >= p99
      # tres_eleve : pic ∈ [p95, p99[
      # eleve      : pic ∈ [p80, p95[
      cluster_overlap_frac = ALERT_CLUSTER_OVERLAP_FRAC,
      block_hours          = 4,
      event_containment    = ALERT_EVENT_CONTAINMENT
    ),
    # Paliers de saillance absolue par pays (percentiles de la distribution
    # empirique sur la fenêtre HISTORY_DAYS). Frontend dérive le niveau
    # d'alerte (extreme/tres_eleve/eleve) à partir du pic vs ces seuils.
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

    period_nodes <- list()
    period_articles <- list()
    if (nrow(nodes_i) > 0) {
      for (j in seq_len(nrow(nodes_i))) {
        nid <- nodes_i$extracted_objects[j]
        period_nodes[[length(period_nodes) + 1]] <- list(
          id             = nid,
          size           = round(nodes_i$absolute_normalized_index[j], 3),
          n              = nodes_i$n[j],
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
      links = list()
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
      cluster_overlap_frac = ALERT_CLUSTER_OVERLAP_FRAC,
      block_hours          = 4
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
