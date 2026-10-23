#!/usr/bin/env Rscript
# Diagnostic (lecture seule) : ancien indice absolute_normalized_index contre
# indice spec v1 salience_index dans vitrine_datamart-salient_index (DEV).
# Imprime couverture par mois, échelles, corrélation et top 15 récents. Refs #48.
suppressPackageStartupMessages({ library(dplyr); library(readr) })
d <- read_csv("pipeline/salient_index.csv", show_col_types = FALSE, guess_max = 200000)
d <- d |> mutate(old = suppressWarnings(as.numeric(absolute_normalized_index)),
                 new = suppressWarnings(as.numeric(salience_index)),
                 jour = as.Date(substr(as.character(date_utc), 1, 10)),
                 mois = substr(as.character(date_utc), 1, 7))
cat("lignes :", nrow(d), " | dates :", as.character(min(d$jour)), "->", as.character(max(d$jour)), "\n")
cat("\n== couverture de salience_index par mois (part non NA) ==\n")
print(as.data.frame(d |> group_by(mois) |> summarise(n = n(), part_non_na = round(mean(!is.na(new)), 3), .groups = "drop")))
q <- c(.5, .8, .9, .95, .99, 1)
cat("\n== quantiles (toutes lignes) ==\n")
print(rbind(ancien = quantile(d$old, q, na.rm = TRUE), spec_v1 = quantile(d$new, q, na.rm = TRUE)))
ok <- !is.na(d$old) & !is.na(d$new)
cat("\n== Spearman ancien/spec v1 sur", sum(ok), "lignes :", round(cor(d$old[ok], d$new[ok], method = "spearman"), 3), "\n")
p <- mean(d$old >= 1, na.rm = TRUE)
cat("== part des lignes au-dessus du plancher actuel (ancien >= 1) :", round(p, 4),
    "| seuil spec v1 au même quantile :", round(quantile(d$new, 1 - p, na.rm = TRUE), 4), "\n")
cat("\n== par pays ==\n")
print(as.data.frame(d |> group_by(country_id) |> summarise(
  n = n(), ancien_p50 = quantile(old, .5, na.rm = TRUE), ancien_p95 = quantile(old, .95, na.rm = TRUE),
  v1_p50 = quantile(new, .5, na.rm = TRUE), v1_p95 = quantile(new, .95, na.rm = TRUE),
  v1_na = round(mean(is.na(new)), 3), .groups = "drop")))
rec <- d |> filter(jour >= max(jour) - 13)
cat("\n== top 15 des 14 derniers jours (somme par objet), par pays ==\n")
for (cc in sort(unique(rec$country_id))) {
  a <- rec |> filter(country_id == cc) |> group_by(extracted_objects) |>
    summarise(ancien = sum(old, na.rm = TRUE), spec_v1 = sum(new, na.rm = TRUE), .groups = "drop")
  cat("\n--", cc, ": ancien --\n"); print(as.data.frame(a |> slice_max(ancien, n = 15) |> select(extracted_objects, ancien)))
  cat("--", cc, ": spec v1 --\n"); print(as.data.frame(a |> slice_max(spec_v1, n = 15) |> select(extracted_objects, spec_v1)))
}
