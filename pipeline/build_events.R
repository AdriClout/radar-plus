################################################################################
# Événements saillants — sorties v2 découpées (chantier 2, #49 ; chantier 7, #59)
#
# Lit pipeline/headline_events.csv (table Athena headline_events_4h : top 3
# événements par région et par bloc de 4 h, régime LLM depuis 2026-07-23) et
# écrit, dans pipeline/out_r2/v2/events/ (publié dans R2 par publish_r2.py) :
#   index.json                       métadonnées, seuils, bandes, périodes, dernière période
#   latest.json                      par région : événements du dernier bloc + cumul 24 h courant
#   {region}/{AAAA-MM-JJ}.json       événements du jour, par bloc (avec manchettes)
#   storylines/{region}/{AAAA}.json  fiches storylines : série par bloc, cumul 24 h, bande
#
# Régions : QC (panel québécois) et CAN (= ROC de la table : panel canadien
# anglophone, country_id CAN). Même indice que la Vitrine : la colonne publiée
# salience_index_qc / salience_index_roc (spec v1, complète depuis le rejeu du
# 23 oct. 2026) — plus de recomposition. Seuils et cumul 24 h : conventions du
# frontend Vitrine (lib/data/salienceCutover.ts, vitrine#566) ; à resynchroniser
# à chaque recalibration. Règle de bande : valeur ≥ seuil.
#
# Repris de la PR #47 (août 2026), allégé : voir docs dans pipeline/README.md.
################################################################################

suppressPackageStartupMessages({
  library(dplyr)
  library(jsonlite)
})

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

CSV_FILE <- file.path(OUT_DIR, "headline_events.csv")
V2_DIR   <- file.path(OUT_DIR, "out_r2", "v2", "events")
dir.create(V2_DIR, recursive = TRUE, showWarnings = FALSE)

write_v2 <- function(x, ...) {
  path <- file.path(V2_DIR, ...)
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  jsonlite::write_json(x, path, auto_unbox = TRUE, pretty = FALSE, null = "null", na = "null")
}

REGIME_FROM    <- "2026-07-23"
REGION_OF      <- c(QC = "QC", ROC = "CAN")   # clé de la table → clé du site
TOP_PER_BLOCK  <- 3L
EV_MAX_ARTICLES <- 12L
PAGES_PERMANENTES <- c(
  "https://www.foxnews.com/video/5614615980001",
  "https://www.foxbusiness.com/video/5640669329001"
)

## --- Bandes et seuils du frontend Vitrine ------------------------------------
# Libellés en escapes Unicode (locale non-UTF-8 possible en CI).
BANDES <- data.frame(
  id = c("faible", "moderee", "elevee", "tres_elevee", "extreme"),
  fr = c("Faible", "Modérée", "Élevée", "Très élevée", "Extrême"),
  en = c("Low", "Moderate", "High", "Very high", "Extreme"),
  stringsAsFactors = FALSE
)
HALF_LIFE_H   <- 10
BLOCK_H       <- 4
WINDOW_BLOCKS <- 6L
RWT <- sum(2^(-(0:5) * BLOCK_H / HALF_LIFE_H))   # RECENCY_WEIGHT_TOTAL ≈ 3,347
TH_BLOCK <- list(QC  = c(12.1, 17.4, 21.5, 41.9, 63.6),
                 CAN = c(11.3, 15.9, 20.0, 37.2, 59.6))
TH_SUM   <- list(QC  = c(33.8, 41.8, 59.2, 96.5, 157.1) / RWT,
                 CAN = c(20.0, 30.4, 45.4, 85.0, 150.6) / RWT)
for (r in names(TH_BLOCK)) { names(TH_BLOCK[[r]]) <- BANDES$id; names(TH_SUM[[r]]) <- BANDES$id }

band_of <- function(v, th) {
  if (is.na(v)) return("aucune")
  hit <- which(v >= th)
  if (!length(hit)) "aucune" else BANDES$id[max(hit)]
}

## --- Helpers ----------------------------------------------------------------------
ids_of <- function(s) {
  if (is.na(s) || s == "" || s == "[]") return(character(0))
  unique(trimws(strsplit(gsub("\\[|\\]|\"", "", s), ",")[[1]]))
}

# Les vraies manchettes de l'événement, restreintes au panel de la région.
# On ne retient que titre / URL / média / minutes en Une : `body_preview` est un
# extrait de texte intégral et n'a rien à faire dans un fichier public.
articles_of <- function(articles_json, region_ids) {
  arts <- tryCatch(jsonlite::fromJSON(articles_json, simplifyDataFrame = TRUE),
                   error = function(e) NULL)
  if (is.null(arts) || !is.data.frame(arts) || nrow(arts) == 0) return(list())
  if (!all(c("title", "url", "media_id") %in% names(arts))) return(list())
  arts <- arts[!(arts$url %in% PAGES_PERMANENTES), , drop = FALSE]
  arts <- arts[as.character(arts$media_id) %in% region_ids, , drop = FALSE]
  arts <- arts[!is.na(arts$url) & nzchar(as.character(arts$url)), , drop = FALSE]
  if (nrow(arts) == 0) return(list())
  arts <- arts[!duplicated(as.character(arts$url)), , drop = FALSE]
  arts <- arts[!duplicated(paste0(as.character(arts$media_id), "", as.character(arts$title))), , drop = FALSE]
  if ("headline_minutes" %in% names(arts)) {
    mins <- suppressWarnings(as.numeric(arts$headline_minutes)); mins[is.na(mins)] <- 0
    arts <- arts[order(-mins), , drop = FALSE]
  }
  arts <- utils::head(arts, EV_MAX_ARTICLES)
  lapply(seq_len(nrow(arts)), function(i) {
    m <- if ("headline_minutes" %in% names(arts)) suppressWarnings(as.numeric(arts$headline_minutes[i])) else NA
    list(
      title    = as.character(arts$title[i]),
      url      = as.character(arts$url[i]),
      media_id = as.character(arts$media_id[i]),
      minutes  = if (length(m) && !is.na(m)) round(m) else NULL
    )
  })
}

period_label <- function(key) {
  date_p <- substr(key, 1, 10)
  h1 <- as.integer(sub("-.*$", "", substr(key, 12, nchar(key))))
  ts <- as.POSIXct(paste0(date_p, " ", sprintf("%02d", h1), ":00:00"), tz = "UTC")
  loc <- format(ts, tz = "America/Montreal", format = "%b %d")
  hloc <- as.integer(format(ts, tz = "America/Montreal", format = "%H"))
  tzab <- format(ts, tz = "America/Montreal", format = "%Z")
  sprintf("%s · %d-%d %s", loc, hloc, (hloc + BLOCK_H) %% 24, tzab)
}

## --- Lecture -------------------------------------------------------------------
cat("Lecture headline_events.csv...\n")
df <- readr::read_csv(CSV_FILE, show_col_types = FALSE,
                      col_types = readr::cols(.default = readr::col_character()))
cat("  ->", nrow(df), "lignes\n")

num <- function(x) suppressWarnings(as.numeric(x))
df <- df |>
  mutate(
    date_utc    = substr(date_utc, 1, 10),
    start_h     = suppressWarnings(as.integer(sub("-.*$", "", time_interval_utc))),
    block_ts    = as.POSIXct(paste0(date_utc, " ", sprintf("%02d", start_h), ":00:00"), tz = "UTC"),
    period_key  = paste0(date_utc, "_", time_interval_utc),
    titre       = coalesce(na_if(trimws(title), ""), na_if(trimws(event_title_raw), "")),
    sid         = coalesce(na_if(storyline_id, ""), na_if(event_label, ""), event_id),
    idx_qc      = num(salience_index_qc)  * 100,
    idx_roc     = num(salience_index_roc) * 100,
    convergence = num(interval_convergence_score),
    rank_source = suppressWarnings(as.integer(event_rank_in_region))
  ) |>
  filter(!is.na(titre), !is.na(block_ts), !is.na(sid))

## --- Par région : indice publié, dédoublonnage, top 3 --------------------------
prep_region <- function(rk) {
  d <- if (rk == "QC") {
    df |> filter(target_region == "QC", is.na(country_id) | country_id != "USA")
  } else {
    df |> filter(target_region == "ROC", country_id == "CAN")
  }
  if (nrow(d) == 0) return(d |> mutate(index = numeric(0), outlets = integer(0)))
  region_ids <- lapply(if (rk == "QC") d$media_ids_qc else d$media_ids_roc, ids_of)
  d$index   <- round(if (rk == "QC") d$idx_qc else d$idx_roc, 3)
  d$outlets <- vapply(region_ids, length, integer(1))
  d <- d |> filter(!is.na(index), index > 0)
  # Plusieurs passes d'extraction pour un même bloc sont possibles (vu le
  # 2026-08-27) : garder l'indice le plus fort par (bloc, event_id), puis top 3.
  d |>
    group_by(period_key, event_id) |>
    slice_max(index, n = 1, with_ties = FALSE) |>
    ungroup() |>
    group_by(period_key) |>
    arrange(desc(index), .by_group = TRUE) |>
    slice_head(n = TOP_PER_BLOCK) |>
    ungroup()
}

event_record <- function(x, rk, rank) {
  ids  <- ids_of(if (rk == "QC") x$media_ids_qc else x$media_ids_roc)
  arts <- articles_of(x$articles, ids)
  list(
    id          = x$event_id,
    storyline   = x$sid,
    title       = x$titre,
    text        = if (!is.na(x$text) && nzchar(x$text)) x$text else NULL,
    issue       = if (!is.na(x$main_issue)) x$main_issue else NULL,
    issue_fr    = if (!is.na(x$main_issue_text_fr)) x$main_issue_text_fr else NULL,
    issue_en    = if (!is.na(x$main_issue_text_en)) x$main_issue_text_en else NULL,
    index       = x$index,
    band        = band_of(x$index, TH_BLOCK[[REGION_OF[[rk]]]]),
    rank        = rank,
    rank_source = if (!is.na(x$rank_source)) x$rank_source else NULL,
    outlets     = x$outlets,
    media_ids   = I(ids),
    articles    = arts,
    url         = if (!is.na(x$representative_url)) x$representative_url else NULL,
    media       = if (!is.na(x$representative_media_id)) x$representative_media_id else NULL,
    first_seen  = if (!is.na(x$first_seen_utc)) x$first_seen_utc else NULL,
    convergence = if (!is.na(x$convergence)) round(x$convergence, 3) else NULL
  )
}

all_periods <- character(0)
latest_by_region <- list()
dates_by_region  <- list()

for (rk in c("QC", "ROC")) {
  reg <- REGION_OF[[rk]]
  d <- prep_region(rk)
  cat(sprintf("Région %s (%s) : %d lignes retenues, %d blocs\n", rk, reg, nrow(d), length(unique(d$period_key))))
  if (nrow(d) == 0) next
  all_periods <- union(all_periods, unique(d$period_key))
  dates_by_region[[reg]] <- sort(unique(d$date_utc))

  # -- Cumul 24 h par storyline (6 blocs, demi-vie 10 h, ÷ RWT) --
  by_bs <- d |> group_by(period_key, block_ts, sid) |> summarise(sumVal = sum(index), .groups = "drop")
  blocks_desc <- d |> distinct(period_key, block_ts) |> arrange(desc(block_ts))
  n <- nrow(blocks_desc)
  sum24h <- list()
  if (n >= WINDOW_BLOCKS) {
    for (i in seq_len(n - WINDOW_BLOCKS + 1L)) {
      win <- blocks_desc[i:(i + WINDOW_BLOCKS - 1L), ]
      w <- by_bs |> filter(period_key %in% win$period_key)
      if (nrow(w) == 0) next
      newest <- max(win$block_ts)
      wt <- 2^(as.numeric(difftime(w$block_ts, newest, units = "hours")) / HALF_LIFE_H)
      sums <- rowsum(w$sumVal * wt, w$sid)[, 1] / RWT
      pk <- win$period_key[1]
      for (s in names(sums)) sum24h[[s]][[pk]] <- round(unname(sums[s]), 3)
    }
    sum24h <- lapply(sum24h, function(x) x[order(names(x))])
  }

  # -- Fichiers par jour : événements de chaque bloc --
  for (dte in dates_by_region[[reg]]) {
    blocks <- list()
    for (pk in sort(unique(d$period_key[d$date_utc == dte]))) {
      dd <- d |> filter(period_key == pk) |> arrange(desc(index))
      blocks[[pk]] <- lapply(seq_len(nrow(dd)), function(i) event_record(dd[i, ], rk, i))
    }
    write_v2(list(region = reg, date = dte, periods = blocks), reg, paste0(dte, ".json"))
  }

  # -- Fiches storylines par année (année du premier bloc) --
  meta_story <- d |>
    arrange(desc(block_ts), desc(index)) |>
    group_by(sid) |>
    summarise(
      label      = first(na.omit(c(na_if(event_label, ""), NA_character_))),
      title      = first(titre),
      issue_fr   = first(na.omit(c(main_issue_text_fr, NA_character_))),
      issue_en   = first(na.omit(c(main_issue_text_en, NA_character_))),
      first_key  = min(period_key),
      last_key   = max(period_key),
      peak       = max(index),
      n_blocks   = n_distinct(period_key),
      first_seen = { v <- first_seen_utc[!is.na(first_seen_utc)]; if (length(v)) min(v) else NA_character_ },
      .groups = "drop"
    )
  series_df <- by_bs |> arrange(block_ts)
  # Manchette représentative la plus récente par storyline (pour les lignes cliquables).
  last_rows <- d |> arrange(desc(block_ts), desc(index)) |> group_by(sid) |>
    summarise(url = first(representative_url), media = first(representative_media_id),
              last_event_id = first(event_id), .groups = "drop")
  stories_by_year <- list()
  for (j in seq_len(nrow(meta_story))) {
    s <- meta_story$sid[j]
    lr <- last_rows[last_rows$sid == s, ]
    ser <- series_df |> filter(sid == s)
    cum <- sum24h[[s]]
    last_cum <- if (!is.null(cum) && length(cum)) cum[[length(cum)]] else NULL
    yr <- substr(meta_story$first_key[j], 1, 4)
    stories_by_year[[yr]][[s]] <- list(
      label      = if (!is.na(meta_story$label[j])) meta_story$label[j] else NULL,
      title      = meta_story$title[j],
      issue_fr   = if (!is.na(meta_story$issue_fr[j])) meta_story$issue_fr[j] else NULL,
      issue_en   = if (!is.na(meta_story$issue_en[j])) meta_story$issue_en[j] else NULL,
      first_key  = meta_story$first_key[j],
      last_key   = meta_story$last_key[j],
      peak       = round(meta_story$peak[j], 3),
      n_blocks   = meta_story$n_blocks[j],
      first_seen = if (!is.na(meta_story$first_seen[j])) meta_story$first_seen[j] else NULL,
      url        = if (nrow(lr) && !is.na(lr$url[1])) lr$url[1] else NULL,
      media      = if (nrow(lr) && !is.na(lr$media[1])) lr$media[1] else NULL,
      last_event_id = if (nrow(lr)) lr$last_event_id[1] else NULL,
      series     = as.list(setNames(round(ser$sumVal, 3), ser$period_key)),
      sum24h     = if (!is.null(cum)) cum else setNames(list(), character(0)),
      band24h    = if (!is.null(last_cum)) band_of(last_cum, TH_SUM[[reg]]) else "aucune"
    )
  }
  for (yr in names(stories_by_year)) {
    write_v2(list(region = reg, year = as.integer(yr), storylines = stories_by_year[[yr]]),
             "storylines", reg, paste0(yr, ".json"))
  }

  # -- Dernier bloc + cumul 24 h courant (pour « À la Une ») --
  last_pk <- max(d$period_key)
  dd <- d |> filter(period_key == last_pk) |> arrange(desc(index))
  current <- list()
  for (s in names(sum24h)) {
    cum <- sum24h[[s]]
    if (!length(cum) || names(cum)[length(cum)] != last_pk) next
    st <- meta_story[meta_story$sid == s, ]
    last_row <- d |> filter(sid == s) |> arrange(desc(block_ts), desc(index)) |> slice(1)
    current[[length(current) + 1]] <- list(
      storyline = s,
      title     = st$title[1],
      last_key  = last_row$period_key[1],
      last_event_id = last_row$event_id[1],
      url       = if (!is.na(last_row$representative_url[1])) last_row$representative_url[1] else NULL,
      media     = if (!is.na(last_row$representative_media_id[1])) last_row$representative_media_id[1] else NULL,
      label     = if (!is.na(st$label[1])) st$label[1] else NULL,
      issue_fr  = if (!is.na(st$issue_fr[1])) st$issue_fr[1] else NULL,
      issue_en  = if (!is.na(st$issue_en[1])) st$issue_en[1] else NULL,
      sum24h    = cum[[length(cum)]],
      band24h   = band_of(cum[[length(cum)]], TH_SUM[[reg]]),
      n_blocks  = st$n_blocks[1],
      first_key = st$first_key[1]
    )
  }
  current <- current[order(-vapply(current, function(x) x$sum24h, numeric(1)))]
  latest_by_region[[reg]] <- list(
    period  = list(key = last_pk, date = substr(last_pk, 1, 10), interval = substr(last_pk, 12, nchar(last_pk)), label = period_label(last_pk)),
    events  = lapply(seq_len(nrow(dd)), function(i) event_record(dd[i, ], rk, i)),
    current = current
  )
}

periods_sorted <- sort(all_periods)
periods <- lapply(periods_sorted, function(k) list(
  key = k, date = substr(k, 1, 10), interval = substr(k, 12, nchar(k)), label = period_label(k)
))
generated_at <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")

write_v2(list(generated_at = generated_at, regions = I(names(latest_by_region)), by_region = latest_by_region),
         "latest.json")
write_v2(list(
  generated_at         = generated_at,
  source_table         = "vitrine_datamart-headline_events_4h",
  regime_from          = REGIME_FROM,
  top_per_region_block = TOP_PER_BLOCK,
  half_life_h          = HALF_LIFE_H,
  window_blocks        = WINDOW_BLOCKS,
  recency_weight_total = round(RWT, 4),
  bands                = lapply(seq_len(nrow(BANDES)), function(i) as.list(BANDES[i, ])),
  thresholds           = lapply(setNames(names(TH_BLOCK), names(TH_BLOCK)), function(r)
                           list(block = as.list(round(TH_BLOCK[[r]], 3)), sum24h = as.list(round(TH_SUM[[r]], 3)))),
  regions              = I(names(latest_by_region)),
  years                = I(sort(unique(substr(periods_sorted, 1, 4)))),
  dates                = lapply(dates_by_region, I),
  latest_period        = lapply(latest_by_region, function(x) x$period$key),
  periods              = periods
), "index.json")

n_files <- length(list.files(V2_DIR, recursive = TRUE))
cat("✓ out_r2/v2/events :", n_files, "fichiers,", length(periods), "périodes —",
    paste(vapply(names(latest_by_region), function(r) sprintf("%s %d événements au dernier bloc", r, length(latest_by_region[[r]]$events)), character(1)), collapse = " ; "), "\n")
