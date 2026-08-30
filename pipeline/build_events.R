################################################################################
# Événements saillants — Génération events.json
#
# Lit pipeline/headline_events.csv (table Athena headline_events_4h, top 3 par
# région par bloc, régime LLM depuis 2026-07-23) et produit site/events.json :
# les événements par bloc de 4 h et le cumul 24 h par storyline, aux
# conventions exactes du frontend Vitrine (même indice, mêmes seuils), pour
# les pages Accueil (« À la Une ») et Événements de radarplus.org.
#
# Indice affiché par ligne :
#   - bloc ≥ bascule spec v1 (2026-08-08 15-19 UTC) : colonne publiée
#     salience_index_qc/roc (identique à ce que la Vitrine affiche) ;
#   - avant la bascule (colonne mixte ancienne/nouvelle formule) : indice
#     RECOMPOSÉ depuis le JSON `articles`, constantes du tag spec-v1
#     (copiées de analyses/evenements-saillants-par-bloc/mesure_evenements_par_bloc.R,
#     elles-mêmes copiées de grilles_annee_specv1.R du banc Vitrine).
#
# Seuils : constantes du frontend Vitrine (lib/data/salienceCutover.ts) —
# grille par bloc et grille cumul 24 h (÷ RECENCY_WEIGHT_TOTAL, vitrine#566).
# Règle de bande : valeur ≥ seuil. À resynchroniser à chaque recalibration.
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

SITE_DIR    <- file.path(dirname(OUT_DIR), "site")
EVENTS_FILE <- file.path(SITE_DIR, "events.json")
CSV_FILE    <- file.path(OUT_DIR, "headline_events.csv")

REGIME_FROM       <- "2026-07-23"                # régime LLM du raffineur
SPECV1_CUTOVER_TS <- as.POSIXct("2026-08-08 15:00:00", tz = "UTC")
SPECV1_CUTOVER_KEY <- "2026-08-08_15-19"

## --- Constantes spec v1 (tag spec-v1, copiées du script de mesure) -----------
EV_K_INTENSITE        <- 2
EV_K_DUREE            <- 2
EV_EPS                <- 0.05
EV_CAP_ARTICLES_MEDIA <- 3L
EV_MEDIA_MEAN_TIME <- c(
  RCI = 160.0166, LAP = 120.9031, JDM = 143.0377, LED = 241.8293, MG = 241.3784,
  TVA = 125.0133,
  CBC = 159.4631, CTV = 227.9302, VS = 505.2500, GN = 375.4478, NP = 249.0428,
  GAM = 325.8990, TTS = 221.2727,
  CNN = 296.2315, FXN = 146.0550
)
PAGES_PERMANENTES <- c(
  "https://www.foxnews.com/video/5614615980001",
  "https://www.foxbusiness.com/video/5640669329001"
)
PANEL_QC_BASCULE <- as.Date("2026-07-19")  # panel QC : 5 médias avant, 6 après
PANEL_ROC        <- 7L

## --- Seuils du frontend Vitrine ----------------------------------------------
# Libellés en escapes Unicode : les littéraux accentués d'un source R lu sous
# une locale non-UTF-8 (CI, conteneurs) seraient sérialisés en bytes bruts
# (« Mod<c3><a9>r<c3><a9>e ») par jsonlite.
BANDES <- data.frame(
  id = c("faible", "moderee", "elevee", "tres_elevee", "extreme"),
  fr = c("Faible", "Mod\u00e9r\u00e9e", "\u00c9lev\u00e9e",
         "Tr\u00e8s \u00e9lev\u00e9e", "Extr\u00eame"),
  en = c("Low", "Moderate", "High", "Very high", "Extreme"),
  stringsAsFactors = FALSE
)
HALF_LIFE_H   <- 10
BLOCK_H       <- 4
WINDOW_BLOCKS <- 6L
RWT <- sum(2^(-(0:5) * BLOCK_H / HALF_LIFE_H))   # RECENCY_WEIGHT_TOTAL ≈ 3,347
TH_BLOCK <- list(QC  = c(12.1, 17.4, 21.5, 41.9, 63.6),
                 ROC = c(11.3, 15.9, 20.0, 37.2, 59.6))
TH_SUM   <- list(QC  = c(33.8, 41.8, 59.2, 96.5, 157.1) / RWT,
                 ROC = c(20.0, 30.4, 45.4, 85.0, 150.6) / RWT)
for (r in c("QC", "ROC")) {
  names(TH_BLOCK[[r]]) <- BANDES$id
  names(TH_SUM[[r]])   <- BANDES$id
}

band_of <- function(v, th) {
  hit <- which(v >= th)
  if (!length(hit)) "aucune" else BANDES$id[max(hit)]
}

## --- Recomposition spec v1 ----------------------------------------------------
ids_of <- function(s) {
  if (is.na(s) || s == "" || s == "[]") return(character(0))
  unique(trimws(strsplit(gsub("\\[|\\]|\"", "", s), ",")[[1]]))
}
compte_plafonne <- function(m) {
  if (!length(m)) return(0L)
  sum(pmin(EV_CAP_ARTICLES_MEDIA, table(m)))
}
minutes_ponderees <- function(m, mins) {
  if (!length(m)) return(0)
  mt <- EV_MEDIA_MEAN_TIME[m]; mt[is.na(mt)] <- mean(EV_MEDIA_MEAN_TIME)
  sum(mins / mt, na.rm = TRUE)
}
reg_idx_v1 <- function(n_plaf, n_out, pond, panel) {
  if (n_out <= 0 || panel <= 0) return(0)
  vis <- min(1, max(n_out - 1L, 0L) / max(panel - 1L, 1L))
  int <- 1 - exp(-(n_plaf / max(n_out, 1)) / EV_K_INTENSITE)
  dur <- 1 - exp(-pond / EV_K_DUREE)
  exp((log(max(int, EV_EPS)) + log(max(vis, EV_EPS)) + log(max(dur, EV_EPS))) / 3)
}

recompose_row <- function(articles_json, region_ids, panel) {
  arts <- tryCatch(jsonlite::fromJSON(articles_json, simplifyDataFrame = TRUE),
                   error = function(e) NULL)
  if (is.null(arts) || !is.data.frame(arts) || nrow(arts) == 0) return(0)
  arts <- arts[!(arts$url %in% PAGES_PERMANENTES), , drop = FALSE]
  if (nrow(arts) == 0) return(0)
  m    <- as.character(arts$media_id)
  mins <- suppressWarnings(as.numeric(arts$headline_minutes)); mins[is.na(mins)] <- 0
  keep <- m %in% region_ids
  reg_idx_v1(compte_plafonne(m[keep]), length(region_ids),
             minutes_ponderees(m[keep], mins[keep]), panel)
}

## --- Lecture ------------------------------------------------------------------
cat("Lecture headline_events.csv...\n")
df <- readr::read_csv(CSV_FILE, show_col_types = FALSE,
                      col_types = readr::cols(.default = readr::col_character()))
cat("  ->", nrow(df), "lignes\n")

num <- function(x) suppressWarnings(as.numeric(x))
df <- df |>
  mutate(
    date_utc          = substr(date_utc, 1, 10),
    start_h           = suppressWarnings(as.integer(sub("-.*$", "", time_interval_utc))),
    block_ts          = as.POSIXct(paste0(date_utc, " ", sprintf("%02d", start_h), ":00:00"), tz = "UTC"),
    period_key        = paste0(date_utc, "_", time_interval_utc),
    titre             = coalesce(na_if(trimws(title), ""), na_if(trimws(event_title_raw), "")),
    sid               = coalesce(na_if(storyline_id, ""), na_if(event_label, ""), event_id),
    idx_pub_qc        = num(salience_index_qc)  * 100,
    idx_pub_roc       = num(salience_index_roc) * 100,
    convergence       = num(interval_convergence_score),
    rank_source       = suppressWarnings(as.integer(event_rank_in_region))
  ) |>
  filter(!is.na(titre), !is.na(block_ts), !is.na(sid))

## --- Indice par ligne et par région ------------------------------------------
prep_region <- function(rk) {
  d <- if (rk == "QC") {
    df |> filter(target_region == "QC", is.na(country_id) | country_id != "USA")
  } else {
    df |> filter(target_region == "ROC", country_id == "CAN")
  }
  if (nrow(d) == 0) return(d |> mutate(index = numeric(0), outlets = integer(0)))

  region_ids <- lapply(if (rk == "QC") d$media_ids_qc else d$media_ids_roc, ids_of)
  panel <- if (rk == "QC") ifelse(as.Date(d$date_utc) < PANEL_QC_BASCULE, 5L, 6L)
           else rep(PANEL_ROC, nrow(d))
  pub <- if (rk == "QC") d$idx_pub_qc else d$idx_pub_roc

  need_recompose <- d$block_ts < SPECV1_CUTOVER_TS | is.na(pub)
  idx <- pub
  if (any(need_recompose)) {
    idx[need_recompose] <- vapply(which(need_recompose), function(i) {
      recompose_row(d$articles[i], region_ids[[i]], panel[i]) * 100
    }, numeric(1))
  }

  # Diagnostic de concordance : après la bascule, la recomposition doit
  # retrouver la colonne publiée (même formule). Écart = dérive du port R.
  post <- which(!need_recompose & !is.na(pub) & pub > 0)
  if (length(post) > 0) {
    sample_i <- post[seq(1, length(post), length.out = min(50, length(post)))]
    rec <- vapply(sample_i, function(i) {
      recompose_row(d$articles[i], region_ids[[i]], panel[i]) * 100
    }, numeric(1))
    ecart <- abs(rec - pub[sample_i])
    cat(sprintf("  [%s] concordance recomposé vs publié (n=%d post-bascule) : écart moyen %.3f, max %.3f\n",
                rk, length(sample_i), mean(ecart), max(ecart)))
  }

  d$index   <- round(idx, 3)
  d$outlets <- vapply(region_ids, length, integer(1))
  d <- d |> filter(index > 0)

  # La table peut contenir plusieurs passes d'extraction pour un même bloc
  # (observé le 2026-08-27 : mêmes event_id en double, indices divergents).
  # Dédoublonnage par (bloc, event_id) en gardant l'indice le plus fort, puis
  # retour au contrat de la table : top 3 par région par bloc.
  d |>
    group_by(period_key, event_id) |>
    slice_max(index, n = 1, with_ties = FALSE) |>
    ungroup() |>
    group_by(period_key) |>
    arrange(desc(index), .by_group = TRUE) |>
    slice_head(n = 3) |>
    ungroup()
}

## --- Construction par région --------------------------------------------------
result_blocks <- list(); result_storylines <- list(); all_periods <- character(0)

for (rk in c("QC", "ROC")) {
  d <- prep_region(rk)
  cat(sprintf("Région %s : %d lignes retenues, %d blocs\n",
              rk, nrow(d), length(unique(d$period_key))))
  if (nrow(d) == 0) { result_blocks[[rk]] <- setNames(list(), character(0)); next }

  th_b <- TH_BLOCK[[rk]]; th_s <- TH_SUM[[rk]]
  all_periods <- union(all_periods, unique(d$period_key))

  # -- Événements par bloc (triés par indice décroissant, re-rangés) --
  blocks <- list()
  for (pk in sort(unique(d$period_key))) {
    dd <- d |> filter(period_key == pk) |> arrange(desc(index))
    blocks[[pk]] <- lapply(seq_len(nrow(dd)), function(i) {
      x <- dd[i, ]
      list(
        id          = x$event_id,
        storyline   = x$sid,
        title       = x$titre,
        text        = if (!is.na(x$text) && nzchar(x$text)) x$text else NULL,
        issue       = if (!is.na(x$main_issue)) x$main_issue else NULL,
        issue_fr    = if (!is.na(x$main_issue_text_fr)) x$main_issue_text_fr else NULL,
        issue_en    = if (!is.na(x$main_issue_text_en)) x$main_issue_text_en else NULL,
        index       = x$index,
        band        = band_of(x$index, th_b),
        rank        = i,
        rank_source = if (!is.na(x$rank_source)) x$rank_source else NULL,
        outlets     = x$outlets,
        media_ids   = as.list(ids_of(if (rk == "QC") x$media_ids_qc else x$media_ids_roc)),
        url         = if (!is.na(x$representative_url)) x$representative_url else NULL,
        media       = if (!is.na(x$representative_media_id)) x$representative_media_id else NULL,
        first_seen  = if (!is.na(x$first_seen_utc)) x$first_seen_utc else NULL,
        convergence = if (!is.na(x$convergence)) round(x$convergence, 3) else NULL
      )
    })
  }
  result_blocks[[rk]] <- blocks

  # -- Cumul 24 h par storyline (conventions frontend, vitrine#566) --
  by_bs <- d |>
    group_by(period_key, block_ts, sid) |>
    summarise(sumVal = sum(index), .groups = "drop")

  blocks_desc <- d |> distinct(period_key, block_ts) |> arrange(desc(block_ts))
  n <- nrow(blocks_desc)
  sum24h <- list()   # sum24h[[sid]][[period_key]] = cumul
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
    # Les fenêtres sont construites de la plus récente à la plus ancienne :
    # remettre chaque storyline en ordre chronologique (le tri lexical des
    # clés YYYY-MM-DD_HH-HH est chronologique, les blocs débutant à
    # 03/07/11/15/19/23 h UTC).
    sum24h <- lapply(sum24h, function(x) x[order(names(x))])
  }

  # -- Fiches storylines --
  stories <- list()
  meta_story <- d |>
    arrange(desc(block_ts), desc(index)) |>
    group_by(sid) |>
    summarise(
      label      = first(na.omit(c(na_if(event_label, ""), NA_character_))),
      title      = first(titre),
      issue_fr   = first(na.omit(c(main_issue_text_fr, NA_character_))),
      issue_en   = first(na.omit(c(main_issue_text_en, NA_character_))),
      # min() lexicographique = chronologique sur de l'ISO 8601 ; le cas
      # tout-NA est traité explicitement (min(na.rm) avertirait et rendrait NA).
      first_seen = {
        v <- first_seen_utc[!is.na(first_seen_utc)]
        if (length(v)) min(v) else NA_character_
      },
      .groups = "drop"
    )
  series_df <- by_bs |> arrange(block_ts)
  for (j in seq_len(nrow(meta_story))) {
    s <- meta_story$sid[j]
    ser <- series_df |> filter(sid == s)
    cum <- sum24h[[s]]
    last_cum <- if (!is.null(cum) && length(cum)) cum[[length(cum)]] else NULL
    stories[[s]] <- list(
      label      = if (!is.na(meta_story$label[j])) meta_story$label[j] else NULL,
      title      = meta_story$title[j],
      issue_fr   = if (!is.na(meta_story$issue_fr[j])) meta_story$issue_fr[j] else NULL,
      issue_en   = if (!is.na(meta_story$issue_en[j])) meta_story$issue_en[j] else NULL,
      first_seen = if (!is.na(meta_story$first_seen[j])) meta_story$first_seen[j] else NULL,
      series     = as.list(setNames(round(ser$sumVal, 3), ser$period_key)),
      sum24h     = if (!is.null(cum)) cum else setNames(list(), character(0)),
      band24h    = if (!is.null(last_cum)) band_of(last_cum, th_s) else "aucune"
    )
  }
  result_storylines[[rk]] <- stories
}

## --- Périodes (union, ordre chronologique, libellés Montréal) ----------------
period_label <- function(key) {
  date_p <- substr(key, 1, 10)
  h1 <- as.integer(sub("-.*$", "", substr(key, 12, nchar(key))))
  ts <- as.POSIXct(paste0(date_p, " ", sprintf("%02d", h1), ":00:00"), tz = "UTC")
  loc <- format(ts, tz = "America/Montreal", format = "%b %d")
  hloc <- as.integer(format(ts, tz = "America/Montreal", format = "%H"))
  tzab <- format(ts, tz = "America/Montreal", format = "%Z")
  sprintf("%s \u00b7 %d-%d %s", loc, hloc, (hloc + BLOCK_H) %% 24, tzab)
}
periods_sorted <- sort(all_periods)
periods <- lapply(periods_sorted, function(k) list(
  key = k, date = substr(k, 1, 10), interval = substr(k, 12, nchar(k)),
  label = period_label(k)
))

## --- Écriture -----------------------------------------------------------------
result <- list(
  meta = list(
    generated_at         = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    source_table         = "vitrine_datamart-headline_events_4h",
    regime_from          = REGIME_FROM,
    specv1_cutover       = SPECV1_CUTOVER_KEY,
    top_per_region_block = 3L,
    panel                = list(QC = 6L, ROC = PANEL_ROC),
    half_life_h          = HALF_LIFE_H,
    window_blocks        = WINDOW_BLOCKS,
    recency_weight_total = round(RWT, 4),
    bands                = lapply(seq_len(nrow(BANDES)), function(i) as.list(BANDES[i, ])),
    thresholds           = list(
      QC  = list(block = as.list(round(TH_BLOCK$QC, 3)),  sum24h = as.list(round(TH_SUM$QC, 3))),
      ROC = list(block = as.list(round(TH_BLOCK$ROC, 3)), sum24h = as.list(round(TH_SUM$ROC, 3)))
    ),
    periods = periods
  ),
  blocks     = result_blocks,
  storylines = result_storylines
)

jsonlite::write_json(result, EVENTS_FILE, auto_unbox = TRUE, pretty = FALSE, null = "null")
cat("✓ events.json :", round(file.size(EVENTS_FILE) / 1024, 1), "Ko —",
    length(periods), "périodes,",
    sum(vapply(result_storylines, length, integer(1))), "storylines\n")
