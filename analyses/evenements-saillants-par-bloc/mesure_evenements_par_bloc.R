#!/usr/bin/env Rscript
# Combien d'événements VRAIMENT saillants par bloc de 4 h ? Québec vs Canada.
#
# Question d'Adrien (2026-08-23) : dans une tranche de 4 h, l'actualité
# québécoise est-elle si convergente qu'il y a rarement plus de 3 événements
# saillants (souvent 1, 2 ou 3) ? Le Canada anglais diffère-t-il ? → sert à
# décider si radarplus.com montre 1, 2, 3, 5 ou 10 événements en page d'accueil.
#
# SOURCE : rejeu local d'un an du raffineur radar-event-salience (régime de
# regroupement LLM), vitrine/_chantiers-vitrine/banc-235/out/year_llm.rds,
# 2025-05-17 → 2026-08-07, 2 683 blocs. Aucun appel AWS.
#
# ⚠️ CENSURE PAR CONSTRUCTION. Le raffineur ne publie que le TOP 3 par région
# par bloc (runtime.R l. 1253, TARGET_MIN_EVENTS = 3) ; le rejeu roule le même
# runtime, donc max(event_rank_in_region) = 3 partout. Tout comptage « n
# événements au-dessus d'un seuil » est donc plafonné à 3. Ce qui reste
# mesurable SANS biais : (a) la fréquence à laquelle le 3e événement du bloc
# dépasse encore le seuil — c'est une BORNE SUPÉRIEURE de « ≥ 4 au-dessus » ;
# (b) la concentration (rang 2 et 3 en % du rang 1) ; (c) le cumul 24 h par
# storyline, aux conventions exactes du frontend (qui lit la même table
# tronquée). Le script le dit explicitement dans ses sorties.
#
# INDICE : spec v1 RECOMPOSÉE depuis le JSON `articles`, exactement comme
# grilles_annee_specv1.R / cutover_grilles_specv1.R (banc-235) — jamais la
# colonne publiée, qui mélange ancienne et nouvelle formule depuis le 08-08.
# Les constantes et fonctions ci-dessous sont COPIÉES de ces scripts.
#
# SEUILS : constantes du frontend Vitrine (lib/data/salienceCutover.ts) —
# NEW_BLOCK_{QC,ROC}_THRESHOLDS (par bloc) et SUM_{QC,ROC}_CUMUL_MESURE ÷
# RECENCY_WEIGHT_TOTAL (cumul 24 h en points sur 100, vitrine#566). Règle de
# bande : valeur ≥ seuil (headlineEvents.ts l. 988).
#
# Usage : Rscript mesure_evenements_par_bloc.R > sortie_mesure.md
suppressPackageStartupMessages({ library(dplyr); library(jsonlite) })
B <- "/Users/adrien/repo_github/vitrine/_chantiers-vitrine/banc-235"
df <- readRDS(file.path(B, "out/year_llm.rds"))
if (!"title" %in% names(df) || all(is.na(df$title) | df$title == "")) df$title <- df$event_title_raw

ids <- function(s) { if (is.na(s) || s == "" || s == "[]") return(character(0))
  unique(trimws(strsplit(gsub("\\[|\\]|\"", "", s), ",")[[1]])) }

## --- Constantes AU TAG spec-v1 (copiées de grilles_annee_specv1.R) -----------
EV_K_INTENSITE <- 2
EV_K_DUREE     <- 2
EV_EPS         <- 0.05
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
compte_plafonne <- function(m) { if (!length(m)) return(0L)
  sum(pmin(EV_CAP_ARTICLES_MEDIA, table(m))) }
minutes_ponderees <- function(m, mins) { if (!length(m)) return(0)
  mt <- EV_MEDIA_MEAN_TIME[m]; mt[is.na(mt)] <- mean(EV_MEDIA_MEAN_TIME)
  sum(mins / mt, na.rm = TRUE) }
reg_idx_v1 <- function(n_plaf, n_out, pond, panel) {
  if (n_out <= 0 || panel <= 0) return(0)
  vis <- min(1, max(n_out - 1L, 0L) / max(panel - 1L, 1L))
  int <- 1 - exp(-(n_plaf / max(n_out, 1)) / EV_K_INTENSITE)
  dur <- 1 - exp(-pond / EV_K_DUREE)
  exp((log(max(int, EV_EPS)) + log(max(vis, EV_EPS)) + log(max(dur, EV_EPS))) / 3)
}

## --- Recomposition spec v1, SANS dédup inter-régions ------------------------
# (grilles_annee dédoublonne event_id en préférant QC parce qu'il reproduit
# l'affichage ; ici on mesure CHAQUE région sur SES lignes top-3.)
res <- vector("list", nrow(df)); n_perm <- 0L
for (i in seq_len(nrow(df))) {
  r <- df[i, ]
  qc_ids <- ids(r$media_ids_qc); roc_ids <- ids(r$media_ids_roc)
  arts <- tryCatch(jsonlite::fromJSON(r$articles, simplifyDataFrame = TRUE),
                   error = function(e) NULL)
  if (is.null(arts) || !is.data.frame(arts) || nrow(arts) == 0) next
  perm <- arts$url %in% PAGES_PERMANENTES
  n_perm <- n_perm + sum(perm)
  arts <- arts[!perm, , drop = FALSE]
  if (nrow(arts) == 0) next
  m <- as.character(arts$media_id)
  mins <- suppressWarnings(as.numeric(arts$headline_minutes)); mins[is.na(mins)] <- 0
  in_qc <- m %in% qc_ids; in_roc <- m %in% roc_ids
  res[[i]] <- data.frame(i = i,
    o_qc = length(qc_ids), o_roc = length(roc_ids),
    plaf_qc = compte_plafonne(m[in_qc]),   pond_qc = minutes_ponderees(m[in_qc],  mins[in_qc]),
    plaf_roc = compte_plafonne(m[in_roc]), pond_roc = minutes_ponderees(m[in_roc], mins[in_roc]))
}
inp <- bind_rows(res)
df <- bind_cols(df[inp$i, ], inp[, -1])
panel_qc <- ifelse(as.Date(df$date_utc) < as.Date("2026-07-19"), 5L, 6L)
df$idx_qc  <- mapply(reg_idx_v1, df$plaf_qc,  df$o_qc,  df$pond_qc,  panel_qc)
df$idx_roc <- mapply(reg_idx_v1, df$plaf_roc, df$o_roc, df$pond_roc, 7L)
df$story <- coalesce(ifelse(df$storyline_id == "", NA, df$storyline_id),
                     ifelse(df$event_label == "", NA, df$event_label), df$event_id)
df$block <- paste0(df$date_utc, "T",
                   sprintf("%02d", suppressWarnings(as.integer(
                     sub("-.*$", "", ifelse(is.na(df$time_interval_utc), "", df$time_interval_utc))))))

## --- Seuils du frontend ------------------------------------------------------
BANDES <- c("Faible", "Modérée", "Élevée", "Très élevée", "Extrême")
TH_BLOCK <- list(QC  = c(12.1, 17.4, 21.5, 41.9, 63.6),
                 ROC = c(11.3, 15.9, 20.0, 37.2, 59.6))
HALF_LIFE_H <- 10; BLOCK_H <- 4
RWT <- sum(2^(-(0:5) * BLOCK_H / HALF_LIFE_H))           # 3,347
TH_SUM <- list(QC  = c(33.8, 41.8, 59.2, 96.5, 157.1) / RWT,
               ROC = c(20.0, 30.4, 45.4, 85.0, 150.6) / RWT)
names(TH_BLOCK$QC) <- names(TH_BLOCK$ROC) <- names(TH_SUM$QC) <- names(TH_SUM$ROC) <- BANDES

## --- Helpers de sortie (markdown) -------------------------------------------
md_row <- function(...) cat("| ", paste(c(...), collapse = " | "), " |\n", sep = "")
md_hdr <- function(...) { md_row(...); cat("|", paste(rep("---", length(c(...))), collapse = "|"), "|\n") }
pct <- function(x) sprintf("%.1f %%", 100 * x)
q <- function(x, p) as.numeric(quantile(x, p, names = FALSE))
distrib_row <- function(nom, x) md_row(nom, sprintf("%.2f", mean(x)), q(x, .5), q(x, .8), q(x, .95), max(x))
parts_row <- function(nom, x, cap) {
  cells <- vapply(0:cap, function(k) pct(mean(x == k)), character(1))
  md_row(nom, cells, pct(mean(x >= cap)))
}

## --- 1. PAR BLOC ---------------------------------------------------------------
cat("# Mesure — événements saillants par bloc de 4 h, Québec vs Canada\n\n")
cat(sprintf("Source : `banc-235/out/year_llm.rds` (rejeu local, régime LLM), %s → %s, %d blocs, %d lignes (%d après parsing des articles ; %d captures de pages permanentes retirées).\n\n",
            min(as.character(df$date_utc)), max(as.character(df$date_utc)),
            length(unique(df$block)), nrow(readRDS(file.path(B, "out/year_llm.rds"))), nrow(df), n_perm))
cat("Indice : spec v1 recomposée depuis `articles` (mêmes constantes que `grilles_annee_specv1.R`), affichée ×100. Bande = valeur ≥ seuil.\n\n")

REG <- list(QC  = list(filtre = quote(target_region == "QC" & (is.na(country_id) | country_id != "USA")),
                       idx = "idx_qc", o = "o_qc", nom = "Québec (target_region = QC)"),
            ROC = list(filtre = quote(target_region == "ROC" & country_id == "CAN"),
                       idx = "idx_roc", o = "o_roc", nom = "Canada (target_region = ROC, country_id = CAN)"))

per_block_all <- list(); per_window_all <- list()
for (rk in names(REG)) {
  R <- REG[[rk]]; th <- TH_BLOCK[[rk]]
  d <- df[eval(R$filtre, df), ]
  d$v <- d[[R$idx]] * 100; d$o <- d[[R$o]]
  pb <- d %>% group_by(block) %>% arrange(desc(v), .by_group = TRUE) %>%
    summarise(n_rows = n(), n_pos = sum(v > 0),
              n_b1 = sum(v >= th[1]), n_b2 = sum(v >= th[2]), n_b3 = sum(v >= th[3]),
              n_b4 = sum(v >= th[4]), n_b5 = sum(v >= th[5]),
              n_cov2 = sum(o >= 2), n_cov3 = sum(o >= 3), n_cov4 = sum(o >= 4),
              v1 = v[1], v2 = ifelse(n() >= 2, v[2], 0), v3 = ifelse(n() >= 3, v[3], 0),
              .groups = "drop")
  per_block_all[[rk]] <- pb
  cat(sprintf("## %s — PAR BLOC\n\n", R$nom))
  cat(sprintf("%d blocs ; lignes par bloc dans la table : %s (plafond 3 = censure du raffineur). Grille par bloc : %s.\n\n",
              nrow(pb), paste(names(table(pb$n_rows)), table(pb$n_rows), sep = "×", collapse = ", "),
              paste(sprintf("%s ≥ %.1f", BANDES, th), collapse = " · ")))
  cat(sprintf("Percentiles (p5/p20/p50/p80/p95) des valeurs > 0 sur l'année, pour mémoire : %s (le frontend utilise la grille calibrée sur Athena ≥ 23-07, ci-dessus).\n\n",
              paste(sprintf("%.1f", q(d$v[d$v > 0], c(.05, .2, .5, .8, .95))), collapse = " / ")))

  cat("### Nombre d'événements au-dessus de chaque seuil, par bloc (plafonné à 3)\n\n")
  md_hdr("Compte par bloc", "moyenne", "p50", "p80", "p95", "max")
  distrib_row("indice > 0", pb$n_pos)
  for (k in 1:5) distrib_row(sprintf("≥ %s (%.1f)", BANDES[k], th[k]), pb[[paste0("n_b", k)]])
  distrib_row("couvert par ≥ 2 médias de la région", pb$n_cov2)
  distrib_row("couvert par ≥ 3 médias", pb$n_cov3)
  distrib_row("couvert par ≥ 4 médias", pb$n_cov4)
  cat("\n### Part des blocs selon le nombre d'événements au-dessus du seuil\n\n")
  cat("« 3 » est le plafond observable : sa part est une **borne supérieure** de la part réelle des blocs à ≥ 4 événements au-dessus du seuil (et aussi la part exacte des blocs où le 3e du top 3 dépasse encore le seuil).\n\n")
  md_hdr("Seuil", "0", "1", "2", "3 (= plafond)", "≥ 3 (borne sup. de ≥ 4)")
  parts_row("≥ Modérée", pb$n_b2, 3)
  parts_row("≥ Élevée", pb$n_b3, 3)
  parts_row("≥ Très élevée", pb$n_b4, 3)
  parts_row("≥ 2 médias", pb$n_cov2, 3)
  parts_row("≥ 3 médias", pb$n_cov3, 3)
  cat("\n### Concentration : rang 2 et rang 3 en % du rang 1 (indice recomposé)\n\n")
  ok <- pb$v1 > 0
  md_hdr("Ratio", "p20", "p50", "p80")
  md_row("rang 2 / rang 1", sprintf("%.0f %%", 100 * q(pb$v2[ok] / pb$v1[ok], c(.2, .5, .8))))
  md_row("rang 3 / rang 1", sprintf("%.0f %%", 100 * q(pb$v3[ok] / pb$v1[ok], c(.2, .5, .8))))
  cat(sprintf("\nBlocs dont le 1er est ≥ Élevée : %s ; dont le 1er est ≥ Élevée ET le 2e < Modérée (« une seule histoire domine ») : %s ; blocs sans aucun événement ≥ Modérée : %s.\n\n",
              pct(mean(pb$v1 >= th[3])), pct(mean(pb$v1 >= th[3] & pb$v2 < th[2])), pct(mean(pb$n_b2 == 0))))

  cat("### Stabilité dans le temps (part des blocs, par mois)\n\n")
  pb$mois <- substr(pb$block, 1, 7)
  md_hdr("Mois", "blocs", "≥ 2 ev. Modérée+", "3 ev. Modérée+ (plafond)", "≥ 2 ev. Élevée+", "3 ev. Élevée+ (plafond)", "0 ev. Modérée+")
  for (mo in sort(unique(pb$mois))) { x <- pb[pb$mois == mo, ]
    md_row(mo, nrow(x), pct(mean(x$n_b2 >= 2)), pct(mean(x$n_b2 == 3)), pct(mean(x$n_b3 >= 2)), pct(mean(x$n_b3 == 3)), pct(mean(x$n_b2 == 0))) }
  cat("\n")
}

## --- 2. CUMUL 24 h PAR STORYLINE (conventions frontend, vitrine#566) ---------
cat("## Cumul 24 h par storyline (fenêtre glissante de 6 blocs, demi-vie 10 h, poids normalisés → points sur 100)\n\n")
cat("Réplique de `storiesFrom24h` / `grille_cumul` : par (bloc, storyline) on somme l'indice des événements de la storyline ; par fenêtre de 6 blocs consécutifs observés, cumul = Σ poids·valeur ÷ 3,347 (un bloc absent compte 0). On compte TOUTES les storylines de la fenêtre (pas seulement les 3 affichées). Comme la table ne contient que le top 3 par bloc, une storyline hors top 3 dans un bloc y compte 0 : le cumul est celui que le site calcule, pas une vérité non censurée.\n\n")
for (rk in names(REG)) {
  R <- REG[[rk]]; th <- TH_SUM[[rk]]
  d <- df[eval(R$filtre, df), ]
  d$v <- d[[R$idx]] * 100; d$o <- d[[R$o]]
  by_bs <- d %>% group_by(block, story) %>% summarise(sumVal = sum(v), nmed = max(o), .groups = "drop") %>% filter(sumVal > 0)
  blocks_desc <- sort(unique(d$block), decreasing = TRUE); n <- length(blocks_desc)
  bms <- vapply(blocks_desc, function(b) as.numeric(as.POSIXct(paste0(b, ":00:00"), format = "%Y-%m-%dT%H:%M:%S", tz = "UTC")), numeric(1))
  rows <- vector("list", n - 5L)
  for (i in seq_len(n - 5L)) {
    win <- blocks_desc[i:(i + 5L)]
    w <- by_bs[by_bs$block %in% win, , drop = FALSE]
    if (nrow(w) == 0) next
    newest <- max(bms[win]); wt <- 2^((bms[w$block] - newest) / 3600 / HALF_LIFE_H)
    sums <- rowsum(w$sumVal * wt, w$story)[, 1] / RWT
    nmed <- tapply(w$nmed, w$story, max)[names(sums)]
    top1 <- sort(sums, decreasing = TRUE)
    rows[[i]] <- data.frame(fenetre = win[1], n_story = length(sums),
      n_b1 = sum(sums >= th[1]), n_b2 = sum(sums >= th[2]), n_b3 = sum(sums >= th[3]), n_b4 = sum(sums >= th[4]), n_b5 = sum(sums >= th[5]),
      n_cov2 = sum(nmed >= 2), n_cov3 = sum(nmed >= 3), n_cov4 = sum(nmed >= 4),
      c1 = top1[1], c2 = ifelse(length(top1) >= 2, top1[2], 0), c3 = ifelse(length(top1) >= 3, top1[3], 0))
  }
  pw <- bind_rows(rows); per_window_all[[rk]] <- pw
  cat(sprintf("### %s — CUMUL 24 h\n\n%d fenêtres ; storylines distinctes par fenêtre : p50 = %d, max = %d. Grille cumul (points) : %s.\n\n",
              R$nom, nrow(pw), as.integer(median(pw$n_story)), max(pw$n_story), paste(sprintf("%s ≥ %.1f", BANDES, th), collapse = " · ")))
  md_hdr("Compte par fenêtre 24 h", "moyenne", "p50", "p80", "p95", "max")
  for (k in 1:5) distrib_row(sprintf("≥ %s (%.1f)", BANDES[k], th[k]), pw[[paste0("n_b", k)]])
  distrib_row("storylines couvertes par ≥ 2 médias", pw$n_cov2)
  distrib_row("≥ 3 médias", pw$n_cov3)
  distrib_row("≥ 4 médias", pw$n_cov4)
  cat("\n")
  md_hdr("Seuil", "0", "1", "2", "3", "4", "5+")
  for (k in 2:4) { x <- pw[[paste0("n_b", k)]]
    md_row(sprintf("≥ %s", BANDES[k]), vapply(0:4, function(j) pct(mean(x == j)), character(1)), pct(mean(x >= 5))) }
  cat("\n")
  md_hdr("Ratio des cumuls", "p20", "p50", "p80")
  ok <- pw$c1 > 0
  md_row("2e storyline / 1re", sprintf("%.0f %%", 100 * q(pw$c2[ok] / pw$c1[ok], c(.2, .5, .8))))
  md_row("3e storyline / 1re", sprintf("%.0f %%", 100 * q(pw$c3[ok] / pw$c1[ok], c(.2, .5, .8))))
  cat("\n")
}


## --- 2bis. RÈGLES D'AFFICHAGE CANDIDATES ---------------------------------------
cat("## Règles d'affichage candidates : combien d'événements seraient montrés ?\n\n")
cat("Pour la page d'accueil de radarplus.com. Chaque règle garde toujours au moins le 1er (le « héros ») et au plus 3. « Modérée » et « Élevée » = bandes du frontend ; « ≥ 2 médias » = couvert par au moins 2 médias de la région. Lecture : part des blocs (ou des fenêtres 24 h) où la règle afficherait 1 / 2 / 3 événements.\n\n")
regle <- function(vals, cond, cap = 3L) { n <- sum(cond); max(1L, min(cap, n)) }
md_hdr("Règle", "QC bloc : 1 / 2 / 3", "CAN bloc : 1 / 2 / 3", "QC 24 h : 1 / 2 / 3", "CAN 24 h : 1 / 2 / 3")
fmt3 <- function(x) paste(sprintf("%.0f %%", 100 * c(mean(x == 1), mean(x == 2), mean(x == 3))), collapse = " / ")
cell_bloc <- function(rk, col) fmt3(pmax(1L, pmin(3L, per_block_all[[rk]][[col]])))
cell_win  <- function(rk, col) fmt3(pmax(1L, pmin(3L, per_window_all[[rk]][[col]])))
md_row("Top 3 fixe", cell_bloc("QC", "n_pos"), cell_bloc("ROC", "n_pos"), "3 / — / —  (≥ 3 storylines dans 100 % des fenêtres)", "idem")
md_row("Héros + ceux ≥ Modérée (max 3)", cell_bloc("QC", "n_b2"), cell_bloc("ROC", "n_b2"), cell_win("QC", "n_b2"), cell_win("ROC", "n_b2"))
md_row("Héros + ceux ≥ Élevée (max 3)", cell_bloc("QC", "n_b3"), cell_bloc("ROC", "n_b3"), cell_win("QC", "n_b3"), cell_win("ROC", "n_b3"))
md_row("Héros + ceux ≥ Très élevée (max 3)", cell_bloc("QC", "n_b4"), cell_bloc("ROC", "n_b4"), cell_win("QC", "n_b4"), cell_win("ROC", "n_b4"))
md_row("Héros + ceux couverts par ≥ 2 médias (max 3)", cell_bloc("QC", "n_cov2"), cell_bloc("ROC", "n_cov2"), cell_win("QC", "n_cov2"), cell_win("ROC", "n_cov2"))
md_row("Héros + ceux couverts par ≥ 3 médias (max 3)", cell_bloc("QC", "n_cov3"), cell_bloc("ROC", "n_cov3"), cell_win("QC", "n_cov3"), cell_win("ROC", "n_cov3"))
cat("\nPart des fenêtres 24 h où un top 3 laisserait de côté au moins une storyline ≥ Modérée / ≥ Élevée (seuil où un top 5 se justifierait) : ")
for (rk in c("QC", "ROC")) cat(sprintf("%s : %s / %s ; ", rk, pct(mean(per_window_all[[rk]]$n_b2 >= 4)), pct(mean(per_window_all[[rk]]$n_b3 >= 4))))
cat("\n\n")
## --- 3. COMPLÉMENT NON CENSURÉ : les OBJETS (indice spec v1 objet) -----------
cat("## Complément non censuré : objets saillants par bloc (`objet_year.rds`, indice objet spec v1)\n\n")
cat("Les objets ne sont pas des événements (un événement porte plusieurs objets), mais cette source n'est PAS tronquée. Seuils = percentiles annuels de l'indice objet > 0 (pas de grille frontend pour les objets) : on compte, par bloc, les objets ≥ p80 et ≥ p95 de leur pays, et la part de blocs à 0/1/2/3/4/5+.\n\n")
ob <- readRDS(file.path(B, "out/objet_year.rds"))
for (cc in c("QC", "CAN")) {
  o <- ob[ob$country_id == cc & ob$salience_index > 0, ]
  o$v <- o$salience_index * 100
  p80 <- q(o$v, .8); p95 <- q(o$v, .95); p99 <- q(o$v, .99)
  o$block <- paste0(o$date_utc, "T", sprintf("%02d", as.integer(sub("-.*$", "", o$time_interval_utc))))
  pbo <- o %>% group_by(block) %>% summarise(n80 = sum(v >= p80), n95 = sum(v >= p95), n99 = sum(v >= p99), .groups = "drop")
  cat(sprintf("### %s — objets : %d blocs ; p80 = %.1f, p95 = %.1f, p99 = %.1f (×100)\n\n", cc, nrow(pbo), p80, p95, p99))
  md_hdr("Compte d'objets par bloc", "moyenne", "p50", "p80", "p95", "max")
  distrib_row("≥ p80", pbo$n80); distrib_row("≥ p95", pbo$n95); distrib_row("≥ p99", pbo$n99)
  cat("\n"); md_hdr("Seuil objet", "0", "1", "2", "3", "4", "5+")
  for (nm in c("n95", "n99")) { x <- pbo[[nm]]
    md_row(sprintf("≥ %s", sub("n", "p", nm)), vapply(0:4, function(j) pct(mean(x == j)), character(1)), pct(mean(x >= 5))) }
  cat("\n")
}
cat("FIN\n")
