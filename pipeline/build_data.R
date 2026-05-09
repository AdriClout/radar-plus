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
ALERT_MIN_MENTIONS     <- 2    # Plancher de mentions pour qu'un bloc compte
# Plancher absolu de saillance courante. Relevé de 0.08 à 1.0 pour
# éliminer les alertes sur des objets qui pèsent à peine sur le radar
# (un objet à 0.3 absolu reste invisible par rapport à un Top à ~10).
ALERT_MIN_ABS_SCORE    <- 1.0
ALERT_SCALE_FLOOR      <- 0.08 # Évite les explosions sur séries quasi constantes
# Seuils z d'anormalité (entrée dans le système d'alertes)
ALERT_Z_THRESHOLD      <- 1.8  # En dessous: rien
# Taxonomie 6-tiers basée sur la PERSISTANCE TEMPORELLE et la DOMINANCE.
# Inspirée de la littérature en communication politique:
#   - Boydstun et al. 2014 (media storm): montée brusque ET soutenue
#   - Boydstun & Russell 2016 (alarme/patrouille): médias se fixent
#   - Atkinson 2014 / Pinto 2018 (issue displacement): un sujet éclipse
#   - Giasson (tsunami médiatique): dominance totale d'un événement
#
# Tier         | Persistance         | Dominance        | Sémantique
# surveillance | 1 bloc 4h anormal   | -                | Signal isolé
# watch        | 2-3 blocs cons.     | -                | "Le sujet tient"
# alert        | 4-11 blocs (~1 j)   | -                | Montée nette
# strong       | ≥ 12 blocs (≥ 2 j)  | -                | Media storm
# eclipse      | ≥ 12 blocs (≥ 2 j)  | top_share ≥ 50%  | Éclipse: domine
# tsunami      | ≥ 18 blocs (≥ 3 j)  | top_share ≥ 70%  | Agenda rincé
ALERT_STREAK_WATCH    <- 2L
ALERT_STREAK_ALERT    <- 4L
ALERT_STREAK_STRONG   <- 12L
ALERT_STREAK_ECLIPSE  <- 12L
ALERT_STREAK_TSUNAMI  <- 18L
ALERT_TOP_SHARE_ECLIPSE <- 0.50
ALERT_TOP_SHARE_TSUNAMI <- 0.70

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

# Étape 3 : assignation du tier final, taxonomie 6-tiers.
# Décision combine PERSISTANCE (alert_streak) et DOMINANCE (alert_top_share).
#   tsunami : streak ≥ 18 (≥ 3 j) ET top_share ≥ 70%
#   eclipse : streak ≥ 12 (≥ 2 j) ET top_share ≥ 50%
#   strong  : streak ≥ 12 (≥ 2 j)
#   alert   : streak ≥ 4   (~1 j de couverture)
#   watch   : streak ≥ 2   (~8 h)
#   surveillance : 1 bloc anormal isolé
#   emerging : signal réel mais historique trop court pour z-score
#   none : sinon
assign_alert_tier <- function(streak, top_share, anomalous, emerging) {
  if (isTRUE(anomalous)) {
    if (!is.na(top_share) && streak >= ALERT_STREAK_TSUNAMI && top_share >= ALERT_TOP_SHARE_TSUNAMI) return("tsunami")
    if (!is.na(top_share) && streak >= ALERT_STREAK_ECLIPSE && top_share >= ALERT_TOP_SHARE_ECLIPSE) return("eclipse")
    if (streak >= ALERT_STREAK_STRONG) return("strong")
    if (streak >= ALERT_STREAK_ALERT)  return("alert")
    if (streak >= ALERT_STREAK_WATCH)  return("watch")
    return("surveillance")
  }
  if (isTRUE(emerging)) return("emerging")
  "none"
}

df_index <- df_index |>
  dplyr::mutate(
    alert_level = purrr::pmap_chr(
      list(alert_streak, alert_top_share, alert_anomalous, alert_emerging),
      assign_alert_tier
    ),
    # "Active" = signaux qui valent la peine d'être affichés comme alertes
    # (surveillance et emerging restent visibles mais sont des signaux faibles).
    alert_active = alert_level %in% c("tsunami", "eclipse", "strong", "alert", "watch")
  )

cat("  →", sum(df_index$alert_active, na.rm = TRUE), "points d'alerte actifs sur", nrow(df_index), "lignes\n")
cat("  → Distribution par tier:\n")
tier_counts <- table(df_index$alert_level[df_index$alert_level != "none"])
for (lvl in names(tier_counts)) {
  cat("     ", sprintf("%-13s", lvl), tier_counts[[lvl]], "\n")
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
        alert_streak = if (is.na(nodes_i$alert_streak[j])) NULL else as.integer(nodes_i$alert_streak[j]),
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
      )),
      events = build_alert_events(nodes_i)
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
      # Taxonomie 6-tiers basée sur PERSISTANCE (streak de blocs anormaux
      # consécutifs) et DOMINANCE (top_share = saillance / Top 1 du pays).
      z_threshold = ALERT_Z_THRESHOLD,
      min_mentions = ALERT_MIN_MENTIONS,
      min_abs_score = ALERT_MIN_ABS_SCORE,
      streak = list(
        watch    = ALERT_STREAK_WATCH,
        alert    = ALERT_STREAK_ALERT,
        strong   = ALERT_STREAK_STRONG,
        eclipse  = ALERT_STREAK_ECLIPSE,
        tsunami  = ALERT_STREAK_TSUNAMI
      ),
      top_share = list(
        eclipse = ALERT_TOP_SHARE_ECLIPSE,
        tsunami = ALERT_TOP_SHARE_TSUNAMI
      ),
      # Conversion blocs → durée approchée (1 bloc = 4h)
      block_hours = 4,
      # Fenêtre glissante utilisée pour le calcul du z-score d'alerte
      # (180 périodes × 4h ÷ 24 = 30 jours).
      lookback_days = ALERT_LOOKBACK_PERIODS * 4 / 24,
      # Seuil de containment d'articles pour regrouper deux alertes
      # comme membres d'un même événement (cluster autour d'un pivot).
      event_containment = ALERT_EVENT_CONTAINMENT
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
          alert_streak   = if (is.na(nodes_i$alert_streak[j])) NULL else as.integer(nodes_i$alert_streak[j]),
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
      z_threshold = ALERT_Z_THRESHOLD,
      min_mentions = ALERT_MIN_MENTIONS,
      min_abs_score = ALERT_MIN_ABS_SCORE,
      streak = list(
        watch    = ALERT_STREAK_WATCH,
        alert    = ALERT_STREAK_ALERT,
        strong   = ALERT_STREAK_STRONG,
        eclipse  = ALERT_STREAK_ECLIPSE,
        tsunami  = ALERT_STREAK_TSUNAMI
      ),
      top_share = list(
        eclipse = ALERT_TOP_SHARE_ECLIPSE,
        tsunami = ALERT_TOP_SHARE_TSUNAMI
      ),
      block_hours = 4,
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
