################################################################################
# Constellation des Objets — Génération des données
#
# Ce script génère le fichier JSON utilisé par index.html pour visualiser
# le réseau de co-occurrences des objets saillants en 3D.
#
# Pour chaque bloc 4h × pays, on calcule :
#   - Nœuds   : top N objets par indice de saillance
#   - Liens   : paires d'objets qui partagent au moins une URL commune
#               (= ils ont co-apparu dans un même headline)
#
# Source unique : vitrine_datamart-salient_index
#   (contient urls = JSON array des URLs où chaque objet apparaît)
#
# Usage :
#   source("tools/constellation/build_data.R")
#   → génère tools/constellation/constellation.json
#
# Adrien Cloutier
################################################################################

library(tidyverse)
library(jsonlite)
library(tube)

# ─── Paramètres ────────────────────────────────────────────────────────────────

DAYS_BACK        <- 7    # Nombre de jours dans le passé à inclure
TOP_N_OBJECTS    <- 30   # Nœuds max par période × pays
MIN_COOCCURRENCE <- 1    # Seuil minimum d'URLs partagées pour afficher un lien
SOURCE_ENV       <- "DEV"

OUTPUT_FILE <- tryCatch({
  file.path(dirname(rstudioapi::getSourceEditorContext()$path), "constellation.json")
}, error = function(e) {
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("--file=", args, value = TRUE)
  if (length(file_arg) > 0) {
    file.path(dirname(normalizePath(sub("--file=", "", file_arg[1]))), "constellation.json")
  } else {
    "/Users/adrien/repo_github/aws-refiners/tools/constellation/constellation.json"
  }
})

# ─── Connexion ─────────────────────────────────────────────────────────────────

cat("Connexion à", SOURCE_ENV, "...\n")
condm <- tube::ellipse_connect(SOURCE_ENV, "datamarts")

# ─── Lecture de salient_index ──────────────────────────────────────────────────

start_date <- format(Sys.Date() - DAYS_BACK, "%Y-%m-%d")
cat("Lecture de salient_index depuis", start_date, "...\n")

df_index <- tube::ellipse_query(condm, "vitrine_datamart-salient_index") |>
  dplyr::filter(dbplyr::sql(sprintf("date_utc >= DATE '%s'", start_date))) |>
  dplyr::select(country_id, date_utc, time_interval_utc,
                extracted_objects, absolute_normalized_index, n, urls, titles) |>
  dplyr::collect()

tube::ellipse_disconnect(condm)
cat("  →", nrow(df_index), "lignes chargées\n")

# ─── Lecture de salient_headlines_objects pour médias ─────────────────────────

cat("Lecture de salient_headlines_objects (médias) depuis", start_date, "...\n")

condm <- tube::ellipse_connect(SOURCE_ENV, "datamarts")
df_objects <- tube::ellipse_query(condm, "vitrine_datamart-salient_headlines_objects") |>
  dplyr::filter(dbplyr::sql(sprintf("substr(headline_stop_utc, 1, 10) >= '%s'", start_date))) |>
  dplyr::select(country_id, time_interval_utc,
                media_id, url, headline_stop_utc, extracted_objects) |>
  dplyr::collect() |>
  dplyr::mutate(
    date_utc = as.Date(substr(as.character(headline_stop_utc), 1, 10))
  ) |>
  dplyr::select(-headline_stop_utc)

tube::ellipse_disconnect(condm)
cat("  →", nrow(df_objects), "lignes médias chargées\n")

# ─── Nœuds : top N par période × pays ─────────────────────────────────────────

df_nodes <- df_index |>
  dplyr::group_by(country_id, date_utc, time_interval_utc) |>
  dplyr::slice_max(absolute_normalized_index, n = TOP_N_OBJECTS, with_ties = FALSE) |>
  dplyr::ungroup()

# Objets × médias par période
df_obj_media <- df_objects |>
  tidyr::separate_rows(extracted_objects, sep = ",") |>
  dplyr::mutate(
    extracted_objects = tolower(trimws(extracted_objects)),
    extracted_objects = stringr::str_remove_all(extracted_objects, "[[:punct:]]")
  ) |>
  dplyr::filter(!is.na(extracted_objects) & extracted_objects != "") |>
  dplyr::group_by(country_id, date_utc, time_interval_utc, extracted_objects) |>
  dplyr::summarise(
    media_ids = list(sort(unique(as.character(media_id)))),
    .groups = "drop"
  )

# ─── Liens : co-occurrence via URLs partagées ───────────────────────────────────
#
# Pour chaque objet dans le top N, on parse son tableau d'URLs, puis on
# fait une self-join sur URL pour trouver les paires d'objets co-occurrents.

cat("Calcul des co-occurrences via URLs partagées...\n")

df_obj_urls <- df_nodes |>
  dplyr::mutate(
    url_list = purrr::map(urls, function(u) {
      tryCatch(jsonlite::fromJSON(u), error = function(e) character(0))
    })
  ) |>
  dplyr::select(country_id, date_utc, time_interval_utc, extracted_objects, url_list) |>
  tidyr::unnest(url_list) |>
  dplyr::rename(url = url_list) |>
  dplyr::filter(!is.na(url) & url != "")

# Self-join : deux objets liés si même URL dans la même période
df_edges <- df_obj_urls |>
  dplyr::inner_join(
    df_obj_urls |> dplyr::rename(extracted_objects_b = extracted_objects),
    by           = c("country_id", "date_utc", "time_interval_utc", "url"),
    relationship = "many-to-many"
  ) |>
  dplyr::filter(extracted_objects < extracted_objects_b) |>
  dplyr::group_by(country_id, date_utc, time_interval_utc,
                  source = extracted_objects, target = extracted_objects_b) |>
  dplyr::summarise(value = dplyr::n(), .groups = "drop") |>
  dplyr::filter(value >= MIN_COOCCURRENCE)

# Liens × médias par période, à partir des headlines bruts
df_obj_urls_media <- df_objects |>
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
    df_obj_urls_media |>
      dplyr::rename(extracted_objects_b = extracted_objects),
    by = c("country_id", "date_utc", "time_interval_utc", "url"),
    relationship = "many-to-many"
  ) |>
  dplyr::mutate(media_id = dplyr::coalesce(media_id.x, media_id.y)) |>
  dplyr::filter(extracted_objects < extracted_objects_b) |>
  dplyr::group_by(
    country_id, date_utc, time_interval_utc,
    source = extracted_objects, target = extracted_objects_b
  ) |>
  dplyr::summarise(
    media_ids = list(sort(unique(as.character(media_id)))),
    .groups = "drop"
  )

cat("  →", nrow(df_edges), "liens calculés\n")

# ─── Assemblage JSON ───────────────────────────────────────────────────────────

cat("Assemblage du JSON...\n")

periods <- df_nodes |>
  dplyr::distinct(date_utc, time_interval_utc) |>
  dplyr::arrange(date_utc, time_interval_utc) |>
  dplyr::mutate(
    key   = paste0(date_utc, "_", time_interval_utc),
    label = paste0(format(as.Date(date_utc), "%b %d"), " · ", time_interval_utc, " UTC")
  )

countries <- c("CAN", "QC", "USA")

parse_json_chr <- function(x) {
  if (is.na(x) || !nzchar(x)) return(character(0))
  tryCatch(as.character(jsonlite::fromJSON(x)), error = function(e) character(0))
}

# Lookup url → media_id (un seul média par URL, le premier rencontré)
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
  if (length(titles) < length(urls)) {
    titles <- c(titles, rep("", length(urls) - length(titles)))
  }

  seen <- character(0)
  out <- list()
  for (i in seq_along(urls)) {
    u <- urls[i]
    if (is.na(u) || !nzchar(u) || u %in% seen) next
    seen <- c(seen, u)
    title_i <- trimws(titles[i])
    media_i <- url_to_media[u]
    item <- list(
      title    = if (nzchar(title_i)) title_i else u,
      url      = u,
      media_id = if (!is.na(media_i)) unname(media_i) else NULL
    )
    out[[length(out) + 1]] <- item
    if (length(out) >= max_articles) break
  }
  out
}

graphs <- purrr::map(countries, function(country) {
  purrr::map(seq_len(nrow(periods)), function(i) {
    d  <- periods$date_utc[i]
    ti <- periods$time_interval_utc[i]

    nodes_i <- df_nodes |>
      dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti) |>
      dplyr::arrange(dplyr::desc(absolute_normalized_index))

    node_media_i <- df_obj_media |>
      dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti)

    links_i <- df_edges |>
      dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti)

    link_media_i <- df_edges_media |>
      dplyr::filter(country_id == country, date_utc == d, time_interval_utc == ti)

    list(
      nodes = purrr::map(seq_len(nrow(nodes_i)), function(j) list(
        id   = nodes_i$extracted_objects[j],
        size = round(nodes_i$absolute_normalized_index[j], 3),
        n    = nodes_i$n[j],
        articles = build_articles(nodes_i$urls[j], nodes_i$titles[j]),
        media_ids = {
          mm <- node_media_i |>
            dplyr::filter(extracted_objects == nodes_i$extracted_objects[j])
          if (nrow(mm) == 0) character(0) else mm$media_ids[[1]]
        }
      )),
      links = purrr::map(seq_len(nrow(links_i)), function(j) list(
        source = links_i$source[j],
        target = links_i$target[j],
        value  = links_i$value[j],
        media_ids = {
          lm <- link_media_i |>
            dplyr::filter(source == links_i$source[j], target == links_i$target[j])
          if (nrow(lm) == 0) character(0) else lm$media_ids[[1]]
        }
      ))
    )
  }) |> setNames(periods$key)
}) |> setNames(countries)

all_media_ids <- df_objects |>
  dplyr::filter(!is.na(media_id) & media_id != "") |>
  dplyr::distinct(media_id) |>
  dplyr::arrange(media_id) |>
  dplyr::pull(media_id) |>
  as.character()

result <- list(
  meta = list(
    generated_at     = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    days_back        = DAYS_BACK,
    top_n            = TOP_N_OBJECTS,
    min_cooccurrence = MIN_COOCCURRENCE,
    articles_per_node = 15,
    media_ids = all_media_ids,
    periods = purrr::map(seq_len(nrow(periods)), function(i) list(
      key      = periods$key[i],
      date     = as.character(periods$date_utc[i]),
      interval = periods$time_interval_utc[i],
      label    = periods$label[i]
    )),
    countries = countries
  ),
  graphs = graphs
)

# ─── Export ────────────────────────────────────────────────────────────────────

jsonlite::write_json(result, OUTPUT_FILE, auto_unbox = TRUE, pretty = FALSE)

cat("\n✓ Écrit:", OUTPUT_FILE, "\n")
cat("  Périodes :", nrow(periods), "\n")
cat("  Pays     :", length(countries), "\n")
cat("  Taille   :", round(file.size(OUTPUT_FILE) / 1024 / 1024, 2), "Mo\n")
