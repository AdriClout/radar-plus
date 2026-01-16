################################################################################
# Helpers - RADAR+ Analytics
#
# Fonctions utilitaires générales pour les analyses RADAR+
################################################################################

#' Créer les dossiers de sortie s'ils n'existent pas
#'
#' @param dirs Vecteur de chemins de dossiers à créer
#' @return NULL (side effect: création des dossiers)
ensure_dirs <- function(dirs) {
  for (d in dirs) {
    if (!dir.exists(d)) {
      dir.create(d, recursive = TRUE)
      cat(sprintf("📁 Dossier créé: %s\n", d))
    }
  }
  invisible(NULL)
}

#' Logger un message avec timestamp
#'
#' @param msg Message à logger
#' @param level Niveau: "info", "warning", "error"
log_msg <- function(msg, level = "info") {
  timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
  icon <- switch(level,
    info = "ℹ️",
    warning = "⚠️",
    error = "❌",
    "•"
  )
  cat(sprintf("[%s] %s %s\n", timestamp, icon, msg))
}

#' Timer simple pour mesurer la durée d'exécution
#'
#' @return Fonction de callback pour arrêter le timer
start_timer <- function() {
  start_time <- Sys.time()
  
  function() {
    end_time <- Sys.time()
    duration <- as.numeric(difftime(end_time, start_time, units = "secs"))
    return(duration)
  }
}

#' Formater un nombre avec séparateurs de milliers
#'
#' @param x Nombre à formater
#' @param decimals Nombre de décimales
#' @return String formatée
format_number <- function(x, decimals = 0) {
  format(round(x, decimals), big.mark = " ", scientific = FALSE)
}

#' Formater un pourcentage
#'
#' @param x Nombre entre 0 et 1 (ou >1 si already_percent = TRUE)
#' @param decimals Nombre de décimales
#' @param already_percent Si TRUE, x est déjà en %
#' @return String formatée avec %
format_percent <- function(x, decimals = 1, already_percent = FALSE) {
  if (!already_percent) x <- x * 100
  sprintf(paste0("%.", decimals, "f%%"), x)
}

#' Convertir une date string en POSIXct avec timezone
#'
#' @param date_str String de date
#' @param tz Timezone (défaut: America/Montreal)
#' @return POSIXct
parse_date <- function(date_str, tz = "America/Montreal") {
  lubridate::ymd_hms(date_str, tz = tz, quiet = TRUE)
}

#' Obtenir les bornes d'une période (année, mois, semaine)
#'
#' @param year Année
#' @param period "year", "month", "week"
#' @param month Mois (si period = "month")
#' @param week Numéro de semaine (si period = "week")
#' @return List avec date_min et date_max
get_period_bounds <- function(year, period = "year", month = NULL, week = NULL) {
  tz <- "America/Montreal"
  
  if (period == "year") {
    date_min <- lubridate::ymd_hms(sprintf("%d-01-01 00:00:00", year), tz = tz)
    date_max <- lubridate::ymd_hms(sprintf("%d-12-31 23:59:59", year), tz = tz)
  } else if (period == "month") {
    if (is.null(month)) stop("month requis pour period='month'")
    date_min <- lubridate::ymd_hms(sprintf("%d-%02d-01 00:00:00", year, month), tz = tz)
    date_max <- lubridate::ceiling_date(date_min, "month") - lubridate::seconds(1)
  } else if (period == "week") {
    if (is.null(week)) stop("week requis pour period='week'")
    # Début de l'année
    year_start <- lubridate::ymd(sprintf("%d-01-01", year))
    # Trouver le premier lundi
    first_monday <- year_start + lubridate::days((8 - lubridate::wday(year_start)) %% 7)
    # Calculer début de la semaine spécifiée
    date_min <- first_monday + lubridate::weeks(week - 1)
    date_max <- date_min + lubridate::days(7) - lubridate::seconds(1)
  } else {
    stop("period doit être 'year', 'month' ou 'week'")
  }
  
  list(date_min = date_min, date_max = date_max)
}

#' Sauvegarder un plot ggplot avec paramètres standardisés
#'
#' @param plot Objet ggplot
#' @param filepath Chemin du fichier
#' @param width Largeur en inches
#' @param height Hauteur en inches
#' @param dpi DPI
save_plot <- function(plot, filepath, width = 12, height = 8, dpi = 300) {
  ggplot2::ggsave(
    filename = filepath,
    plot = plot,
    width = width,
    height = height,
    dpi = dpi,
    bg = "white"
  )
  log_msg(sprintf("Visualisation sauvegardée: %s", filepath))
}

#' Nettoyer les noms de colonnes (snake_case)
#'
#' @param df Dataframe
#' @return Dataframe avec colonnes nettoyées
clean_names <- function(df) {
  names(df) <- tolower(names(df))
  names(df) <- gsub("\\s+", "_", names(df))
  names(df) <- gsub("[^a-z0-9_]", "", names(df))
  return(df)
}

#' Calculer l'indice de Jaccard entre deux sets
#'
#' @param set1 Premier vecteur
#' @param set2 Deuxième vecteur
#' @return Indice de Jaccard (0-1)
jaccard_index <- function(set1, set2) {
  intersection <- length(intersect(set1, set2))
  union <- length(union(set1, set2))
  
  if (union == 0) return(0)
  
  return(intersection / union)
}

#' Trouver les objets convergents et divergents entre deux éditions
#'
#' @param df1 Dataframe édition 1 (doit avoir colonne 'object_name')
#' @param df2 Dataframe édition 2 (doit avoir colonne 'object_name')
#' @param top_n Nombre d'objets à considérer
#' @return List avec convergents, divergents_1, divergents_2
find_convergence <- function(df1, df2, top_n = 20) {
  # Top N de chaque édition
  top1 <- head(df1$object_name, top_n)
  top2 <- head(df2$object_name, top_n)
  
  # Convergents (présents dans les 2)
  convergents <- intersect(top1, top2)
  
  # Divergents (présents seulement dans 1)
  divergents_1 <- setdiff(top1, top2)
  divergents_2 <- setdiff(top2, top1)
  
  list(
    convergents = convergents,
    divergents_1 = divergents_1,
    divergents_2 = divergents_2,
    jaccard = jaccard_index(top1, top2)
  )
}

#' Afficher un résumé de dataframe
#'
#' @param df Dataframe
#' @param name Nom du dataframe (pour affichage)
print_df_summary <- function(df, name = "Dataframe") {
  cat(sprintf("\n📊 Résumé: %s\n", name))
  cat(sprintf("   Lignes: %s\n", format_number(nrow(df))))
  cat(sprintf("   Colonnes: %d\n", ncol(df)))
  
  if ("date" %in% names(df)) {
    cat(sprintf("   Date min: %s\n", min(df$date, na.rm = TRUE)))
    cat(sprintf("   Date max: %s\n", max(df$date, na.rm = TRUE)))
  }
  
  cat("\n")
}

#' Vérifier si un cache existe et s'il est récent
#'
#' @param cache_file Chemin du fichier cache
#' @param max_age_hours Age maximum en heures (NULL = pas de limite)
#' @return TRUE si cache existe et est valide
cache_is_valid <- function(cache_file, max_age_hours = NULL) {
  if (!file.exists(cache_file)) return(FALSE)
  
  if (!is.null(max_age_hours)) {
    file_age <- difftime(Sys.time(), file.mtime(cache_file), units = "hours")
    if (file_age > max_age_hours) {
      log_msg(sprintf("Cache expiré (age: %.1fh)", file_age), "warning")
      return(FALSE)
    }
  }
  
  return(TRUE)
}

#' Charger depuis cache ou exécuter une fonction
#'
#' @param cache_file Chemin du fichier cache
#' @param load_fn Fonction à exécuter si pas de cache
#' @param max_age_hours Age maximum du cache (NULL = pas de limite)
#' @return Données chargées
load_with_cache <- function(cache_file, load_fn, max_age_hours = NULL) {
  if (cache_is_valid(cache_file, max_age_hours)) {
    log_msg(sprintf("Cache trouvé: %s", basename(cache_file)))
    return(readRDS(cache_file))
  }
  
  log_msg("Chargement depuis la source...")
  data <- load_fn()
  
  # Créer le dossier si nécessaire
  ensure_dirs(dirname(cache_file))
  
  saveRDS(data, cache_file)
  log_msg(sprintf("Cache sauvegardé: %s", basename(cache_file)))
  
  return(data)
}
