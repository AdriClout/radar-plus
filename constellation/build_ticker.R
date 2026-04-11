################################################################################
# Constellation des Objets — Génération ticker.json (news crawl)
################################################################################

OUT_DIR <- tryCatch({
  dirname(rstudioapi::getSourceEditorContext()$path)
}, error = function(e) {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("--file=", args, value = TRUE)
  if (length(file_arg) > 0) {
    dirname(normalizePath(sub("--file=", "", file_arg[1])))
  } else {
    "/Users/adrien/repo_github/radar-plus/constellation"
  }
})

TICKER_FILE <- file.path(OUT_DIR, "ticker.json")
LOOKBACK_HOURS <- 12
MAX_ITEMS <- 120

parse_json_chr <- function(x) {
  if (is.na(x) || !nzchar(x)) return(character(0))
  tryCatch(as.character(jsonlite::fromJSON(x)), error = function(e) character(0))
}

safe_title_from_url <- function(u) {
  if (is.na(u) || !nzchar(u)) return("Article")
  gsub("^www\\.", "", sub("/.*$", "", sub("^https?://", "", u)))
}

cat("Lecture ticker_index.csv...\n")
index_file <- file.path(OUT_DIR, "ticker_index.csv")
df_index <- if (file.exists(index_file)) {
  readr::read_csv(index_file, show_col_types = FALSE)
} else {
  dplyr::tibble(date_utc = character(), time_interval_utc = character(), urls = character(), titles = character())
}
cat("  ->", nrow(df_index), "lignes\n")

cat("Lecture ticker_objects.csv...\n")
df_objects <- readr::read_csv(file.path(OUT_DIR, "ticker_objects.csv"), show_col_types = FALSE)
cat("  ->", nrow(df_objects), "lignes\n")

url_title <- list()

for (i in seq_len(nrow(df_index))) {
  urls <- parse_json_chr(df_index$urls[i])
  titles <- parse_json_chr(df_index$titles[i])
  if (!length(urls)) next

  if (!length(titles)) {
    titles <- rep("", length(urls))
  } else if (length(titles) < length(urls)) {
    titles <- c(titles, rep("", length(urls) - length(titles)))
  }

  for (j in seq_along(urls)) {
    u <- urls[j]
    if (is.na(u) || !nzchar(u)) next
    title_j <- trimws(titles[j])
    if (!nzchar(title_j)) next
    if (is.null(url_title[[u]]) || nchar(url_title[[u]]) < nchar(title_j)) {
      url_title[[u]] <- title_j
    }
  }
}

lookup_title <- function(u) {
  val <- url_title[[u]]
  if (is.null(val) || is.na(val) || !nzchar(val)) return(NA_character_)
  val
}

parse_ts_utc <- function(x) {
  x_chr <- as.character(x)
  out <- suppressWarnings(as.POSIXct(x_chr, tz = "UTC"))
  na_idx <- is.na(out)
  if (any(na_idx)) {
    out[na_idx] <- suppressWarnings(as.POSIXct(sub("\\..*$", "", x_chr[na_idx]), format = "%Y-%m-%d %H:%M:%S", tz = "UTC"))
  }
  out
}

items_df <- df_objects |>
  dplyr::mutate(
    headline_stop_ts = parse_ts_utc(headline_stop_utc),
    media_id = toupper(trimws(as.character(media_id))),
    url = as.character(url),
    country_id = as.character(country_id)
  ) |>
  dplyr::filter(!is.na(headline_stop_ts), !is.na(url), nzchar(url), !is.na(media_id), nzchar(media_id)) |>
  dplyr::arrange(dplyr::desc(headline_stop_ts))

# We always keep the latest scraped headline per media.
items_df <- items_df |>
  dplyr::distinct(url, .keep_all = TRUE) |>
  dplyr::group_by(media_id) |>
  dplyr::slice_max(headline_stop_ts, n = 1, with_ties = FALSE) |>
  dplyr::ungroup()

items_df <- items_df |>
  dplyr::mutate(
    direct_title = if ("title" %in% names(items_df)) as.character(title) else NA_character_,
    title = vapply(url, lookup_title, FUN.VALUE = character(1)),
    fallback_title = vapply(url, safe_title_from_url, FUN.VALUE = character(1)),
    title = dplyr::if_else(!is.na(direct_title) & nzchar(direct_title), direct_title, title),
    title = dplyr::if_else(is.na(title) | !nzchar(title), fallback_title, title),
    ts_utc = format(headline_stop_ts, "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  ) |>
  dplyr::select(-fallback_title, -direct_title) |>
  dplyr::arrange(dplyr::desc(headline_stop_ts)) |>
  dplyr::slice_head(n = MAX_ITEMS)

result <- list(
  meta = list(
    generated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    lookback_hours = LOOKBACK_HOURS,
    max_items = MAX_ITEMS
  ),
  items = purrr::map(seq_len(nrow(items_df)), function(i) list(
    ts_utc = items_df$ts_utc[i],
    media_id = items_df$media_id[i],
    country_id = items_df$country_id[i],
    title = items_df$title[i],
    url = items_df$url[i]
  ))
)

jsonlite::write_json(result, TICKER_FILE, auto_unbox = TRUE, pretty = FALSE)
cat("✓ ticker.json :", round(file.size(TICKER_FILE) / 1024, 1), "Ko —", nrow(items_df), "items\n")
