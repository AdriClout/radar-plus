# Mesure — événements saillants par bloc de 4 h, Québec vs Canada

Source : `banc-235/out/year_llm.rds` (rejeu local, régime LLM), 2025-05-17 → 2026-08-07, 2683 blocs, 21910 lignes (21569 après parsing des articles ; 490 captures de pages permanentes retirées).

Indice : spec v1 recomposée depuis `articles` (mêmes constantes que `grilles_annee_specv1.R`), affichée ×100. Bande = valeur ≥ seuil.

## Québec (target_region = QC) — PAR BLOC

2683 blocs ; lignes par bloc dans la table : 1×13, 2×63, 3×2607 (plafond 3 = censure du raffineur). Grille par bloc : Faible ≥ 12.1 · Modérée ≥ 17.4 · Élevée ≥ 21.5 · Très élevée ≥ 41.9 · Extrême ≥ 63.6.

Percentiles (p5/p20/p50/p80/p95) des valeurs > 0 sur l'année, pour mémoire : 13.2 / 18.0 / 21.6 / 43.9 / 64.3 (le frontend utilise la grille calibrée sur Athena ≥ 23-07, ci-dessus).

### Nombre d'événements au-dessus de chaque seuil, par bloc (plafonné à 3)

| Compte par bloc | moyenne | p50 | p80 | p95 | max |
| ---|---|---|---|---|--- |
| indice > 0 | 2.97 | 3 | 3 | 3 | 3 |
| ≥ Faible (12.1) | 2.86 | 3 | 3 | 3 | 3 |
| ≥ Modérée (17.4) | 2.50 | 3 | 3 | 3 | 3 |
| ≥ Élevée (21.5) | 1.55 | 2 | 2 | 3 | 3 |
| ≥ Très élevée (41.9) | 0.65 | 1 | 1 | 2 | 3 |
| ≥ Extrême (63.6) | 0.16 | 0 | 0 | 1 | 2 |
| couvert par ≥ 2 médias de la région | 1.21 | 1 | 2 | 3 | 3 |
| couvert par ≥ 3 médias | 0.58 | 1 | 1 | 2 | 3 |
| couvert par ≥ 4 médias | 0.24 | 0 | 1 | 1 | 2 |

### Part des blocs selon le nombre d'événements au-dessus du seuil

« 3 » est le plafond observable : sa part est une **borne supérieure** de la part réelle des blocs à ≥ 4 événements au-dessus du seuil (et aussi la part exacte des blocs où le 3e du top 3 dépasse encore le seuil).

| Seuil | 0 | 1 | 2 | 3 (= plafond) | ≥ 3 (borne sup. de ≥ 4) |
| ---|---|---|---|---|--- |
| ≥ Modérée | 0.1 % | 8.5 % | 33.0 % | 58.4 % | 58.4 % |
| ≥ Élevée | 6.9 % | 42.5 % | 39.5 % | 11.0 % | 11.0 % |
| ≥ Très élevée | 44.1 % | 47.7 % | 7.8 % | 0.5 % | 0.5 % |
| ≥ 2 médias | 19.1 % | 47.3 % | 27.3 % | 6.3 % | 6.3 % |
| ≥ 3 médias | 49.6 % | 42.8 % | 7.2 % | 0.4 % | 0.4 % |

### Concentration : rang 2 et rang 3 en % du rang 1 (indice recomposé)

| Ratio | p20 | p50 | p80 |
| ---|---|---|--- |
| rang 2 / rang 1 | 37 % | 61 % | 90 % |
| rang 3 / rang 1 | 25 % | 42 % | 70 % |

Blocs dont le 1er est ≥ Élevée : 93.1 % ; dont le 1er est ≥ Élevée ET le 2e < Modérée (« une seule histoire domine ») : 7.6 % ; blocs sans aucun événement ≥ Modérée : 0.1 %.

### Stabilité dans le temps (part des blocs, par mois)

| Mois | blocs | ≥ 2 ev. Modérée+ | 3 ev. Modérée+ (plafond) | ≥ 2 ev. Élevée+ | 3 ev. Élevée+ (plafond) | 0 ev. Modérée+ |
| ---|---|---|---|---|---|--- |
| 2025-05 | 85 | 92.9 % | 56.5 % | 56.5 % | 11.8 % | 0.0 % |
| 2025-06 | 180 | 93.3 % | 56.7 % | 68.3 % | 16.1 % | 0.0 % |
| 2025-07 | 186 | 90.3 % | 58.1 % | 57.0 % | 13.4 % | 0.5 % |
| 2025-08 | 186 | 91.9 % | 60.8 % | 52.2 % | 14.0 % | 0.0 % |
| 2025-09 | 180 | 92.2 % | 67.8 % | 63.9 % | 13.9 % | 0.0 % |
| 2025-10 | 186 | 93.0 % | 63.4 % | 65.1 % | 17.2 % | 0.0 % |
| 2025-11 | 180 | 91.7 % | 61.1 % | 46.1 % | 6.1 % | 0.0 % |
| 2025-12 | 186 | 92.5 % | 56.5 % | 45.2 % | 7.5 % | 0.0 % |
| 2026-01 | 186 | 86.6 % | 41.9 % | 25.8 % | 2.2 % | 0.0 % |
| 2026-02 | 168 | 92.3 % | 57.1 % | 57.1 % | 13.1 % | 0.0 % |
| 2026-03 | 186 | 83.9 % | 48.9 % | 52.2 % | 15.1 % | 0.5 % |
| 2026-04 | 180 | 93.9 % | 58.3 % | 57.8 % | 11.1 % | 0.0 % |
| 2026-05 | 186 | 91.4 % | 58.1 % | 40.3 % | 8.6 % | 0.0 % |
| 2026-06 | 180 | 92.2 % | 64.4 % | 37.2 % | 7.2 % | 0.0 % |
| 2026-07 | 187 | 93.0 % | 64.7 % | 39.0 % | 9.6 % | 0.0 % |
| 2026-08 | 41 | 95.1 % | 61.0 % | 48.8 % | 7.3 % | 0.0 % |

## Canada (target_region = ROC, country_id = CAN) — PAR BLOC

2682 blocs ; lignes par bloc dans la table : 1×9, 2×16, 3×2657 (plafond 3 = censure du raffineur). Grille par bloc : Faible ≥ 11.3 · Modérée ≥ 15.9 · Élevée ≥ 20.0 · Très élevée ≥ 37.2 · Extrême ≥ 59.6.

Percentiles (p5/p20/p50/p80/p95) des valeurs > 0 sur l'année, pour mémoire : 12.3 / 15.9 / 20.0 / 39.3 / 60.4 (le frontend utilise la grille calibrée sur Athena ≥ 23-07, ci-dessus).

### Nombre d'événements au-dessus de chaque seuil, par bloc (plafonné à 3)

| Compte par bloc | moyenne | p50 | p80 | p95 | max |
| ---|---|---|---|---|--- |
| indice > 0 | 2.99 | 3 | 3 | 3 | 3 |
| ≥ Faible (11.3) | 2.87 | 3 | 3 | 3 | 3 |
| ≥ Modérée (15.9) | 2.38 | 2 | 3 | 3 | 3 |
| ≥ Élevée (20.0) | 1.49 | 1 | 2 | 3 | 3 |
| ≥ Très élevée (37.2) | 0.64 | 1 | 1 | 2 | 3 |
| ≥ Extrême (59.6) | 0.16 | 0 | 0 | 1 | 1 |
| couvert par ≥ 2 médias de la région | 1.32 | 1 | 2 | 3 | 3 |
| couvert par ≥ 3 médias | 0.66 | 1 | 1 | 2 | 3 |
| couvert par ≥ 4 médias | 0.36 | 0 | 1 | 1 | 2 |

### Part des blocs selon le nombre d'événements au-dessus du seuil

« 3 » est le plafond observable : sa part est une **borne supérieure** de la part réelle des blocs à ≥ 4 événements au-dessus du seuil (et aussi la part exacte des blocs où le 3e du top 3 dépasse encore le seuil).

| Seuil | 0 | 1 | 2 | 3 (= plafond) | ≥ 3 (borne sup. de ≥ 4) |
| ---|---|---|---|---|--- |
| ≥ Modérée | 0.2 % | 10.1 % | 41.0 % | 48.7 % | 48.7 % |
| ≥ Élevée | 6.2 % | 46.1 % | 39.7 % | 7.9 % | 7.9 % |
| ≥ Très élevée | 41.7 % | 52.6 % | 5.6 % | 0.1 % | 0.1 % |
| ≥ 2 médias | 11.2 % | 51.4 % | 31.9 % | 5.5 % | 5.5 % |
| ≥ 3 médias | 40.6 % | 52.8 % | 6.3 % | 0.3 % | 0.3 % |

### Concentration : rang 2 et rang 3 en % du rang 1 (indice recomposé)

| Ratio | p20 | p50 | p80 |
| ---|---|---|--- |
| rang 2 / rang 1 | 36 % | 60 % | 87 % |
| rang 3 / rang 1 | 26 % | 40 % | 60 % |

Blocs dont le 1er est ≥ Élevée : 93.8 % ; dont le 1er est ≥ Élevée ET le 2e < Modérée (« une seule histoire domine ») : 9.2 % ; blocs sans aucun événement ≥ Modérée : 0.2 %.

### Stabilité dans le temps (part des blocs, par mois)

| Mois | blocs | ≥ 2 ev. Modérée+ | 3 ev. Modérée+ (plafond) | ≥ 2 ev. Élevée+ | 3 ev. Élevée+ (plafond) | 0 ev. Modérée+ |
| ---|---|---|---|---|---|--- |
| 2025-05 | 85 | 85.9 % | 36.5 % | 51.8 % | 15.3 % | 0.0 % |
| 2025-06 | 180 | 86.7 % | 40.0 % | 50.6 % | 8.3 % | 0.0 % |
| 2025-07 | 186 | 86.6 % | 43.0 % | 45.7 % | 4.8 % | 0.0 % |
| 2025-08 | 186 | 91.9 % | 48.9 % | 43.5 % | 5.9 % | 0.0 % |
| 2025-09 | 180 | 91.1 % | 51.1 % | 39.4 % | 6.1 % | 0.0 % |
| 2025-10 | 186 | 92.5 % | 60.2 % | 51.6 % | 10.8 % | 0.5 % |
| 2025-11 | 180 | 85.6 % | 47.2 % | 42.2 % | 8.3 % | 0.6 % |
| 2025-12 | 186 | 93.5 % | 48.4 % | 47.8 % | 4.8 % | 0.0 % |
| 2026-01 | 186 | 90.9 % | 51.6 % | 57.0 % | 10.2 % | 1.1 % |
| 2026-02 | 168 | 81.0 % | 39.9 % | 47.6 % | 8.3 % | 1.2 % |
| 2026-03 | 185 | 88.1 % | 44.9 % | 51.4 % | 7.6 % | 0.0 % |
| 2026-04 | 180 | 90.6 % | 48.9 % | 50.6 % | 10.6 % | 0.0 % |
| 2026-05 | 186 | 91.9 % | 54.8 % | 40.3 % | 4.8 % | 0.0 % |
| 2026-06 | 180 | 95.0 % | 55.6 % | 47.8 % | 10.0 % | 0.0 % |
| 2026-07 | 187 | 92.5 % | 51.3 % | 52.4 % | 8.0 % | 0.0 % |
| 2026-08 | 41 | 82.9 % | 51.2 % | 36.6 % | 4.9 % | 0.0 % |

## Cumul 24 h par storyline (fenêtre glissante de 6 blocs, demi-vie 10 h, poids normalisés → points sur 100)

Réplique de `storiesFrom24h` / `grille_cumul` : par (bloc, storyline) on somme l'indice des événements de la storyline ; par fenêtre de 6 blocs consécutifs observés, cumul = Σ poids·valeur ÷ 3,347 (un bloc absent compte 0). On compte TOUTES les storylines de la fenêtre (pas seulement les 3 affichées). Comme la table ne contient que le top 3 par bloc, une storyline hors top 3 dans un bloc y compte 0 : le cumul est celui que le site calcule, pas une vérité non censurée.

### Québec (target_region = QC) — CUMUL 24 h

2678 fenêtres ; storylines distinctes par fenêtre : p50 = 12, max = 18. Grille cumul (points) : Faible ≥ 10.1 · Modérée ≥ 12.5 · Élevée ≥ 17.7 · Très élevée ≥ 28.8 · Extrême ≥ 46.9.

| Compte par fenêtre 24 h | moyenne | p50 | p80 | p95 | max |
| ---|---|---|---|---|--- |
| ≥ Faible (10.1) | 2.57 | 3 | 3 | 4 | 8 |
| ≥ Modérée (12.5) | 1.86 | 2 | 3 | 3 | 6 |
| ≥ Élevée (17.7) | 1.06 | 1 | 2 | 2 | 4 |
| ≥ Très élevée (28.8) | 0.41 | 0 | 1 | 1 | 2 |
| ≥ Extrême (46.9) | 0.09 | 0 | 0 | 1 | 1 |
| storylines couvertes par ≥ 2 médias | 4.70 | 5 | 6 | 8 | 11 |
| ≥ 3 médias | 2.33 | 2 | 3 | 5 | 8 |
| ≥ 4 médias | 1.01 | 1 | 2 | 3 | 5 |

| Seuil | 0 | 1 | 2 | 3 | 4 | 5+ |
| ---|---|---|---|---|---|--- |
| ≥ Modérée | 6.1 % | 31.7 % | 37.5 % | 19.9 % | 4.3 % | 0.4 % |
| ≥ Élevée | 23.9 % | 49.8 % | 23.2 % | 2.8 % | 0.3 % | 0.0 % |
| ≥ Très élevée | 62.0 % | 35.4 % | 2.6 % | 0.0 % | 0.0 % | 0.0 % |

| Ratio des cumuls | p20 | p50 | p80 |
| ---|---|---|--- |
| 2e storyline / 1re | 39 % | 65 % | 87 % |
| 3e storyline / 1re | 25 % | 44 % | 67 % |

### Canada (target_region = ROC, country_id = CAN) — CUMUL 24 h

2677 fenêtres ; storylines distinctes par fenêtre : p50 = 11, max = 17. Grille cumul (points) : Faible ≥ 6.0 · Modérée ≥ 9.1 · Élevée ≥ 13.6 · Très élevée ≥ 25.4 · Extrême ≥ 45.0.

| Compte par fenêtre 24 h | moyenne | p50 | p80 | p95 | max |
| ---|---|---|---|---|--- |
| ≥ Faible (6.0) | 4.03 | 4 | 5 | 6 | 9 |
| ≥ Modérée (9.1) | 2.68 | 3 | 3 | 4 | 7 |
| ≥ Élevée (13.6) | 1.60 | 2 | 2 | 3 | 4 |
| ≥ Très élevée (25.4) | 0.57 | 1 | 1 | 1 | 3 |
| ≥ Extrême (45.0) | 0.13 | 0 | 0 | 1 | 1 |
| storylines couvertes par ≥ 2 médias | 4.36 | 4 | 6 | 7 | 11 |
| ≥ 3 médias | 2.27 | 2 | 3 | 5 | 7 |
| ≥ 4 médias | 1.26 | 1 | 2 | 3 | 7 |

| Seuil | 0 | 1 | 2 | 3 | 4 | 5+ |
| ---|---|---|---|---|---|--- |
| ≥ Modérée | 0.4 % | 11.4 % | 32.3 % | 36.2 % | 15.8 % | 4.0 % |
| ≥ Élevée | 7.7 % | 40.0 % | 38.1 % | 12.7 % | 1.5 % | 0.0 % |
| ≥ Très élevée | 48.0 % | 47.0 % | 4.8 % | 0.1 % | 0.0 % | 0.0 % |

| Ratio des cumuls | p20 | p50 | p80 |
| ---|---|---|--- |
| 2e storyline / 1re | 34 % | 62 % | 85 % |
| 3e storyline / 1re | 22 % | 39 % | 63 % |

## Règles d'affichage candidates : combien d'événements seraient montrés ?

Pour la page d'accueil de radarplus.com. Chaque règle garde toujours au moins le 1er (le « héros ») et au plus 3. « Modérée » et « Élevée » = bandes du frontend ; « ≥ 2 médias » = couvert par au moins 2 médias de la région. Lecture : part des blocs (ou des fenêtres 24 h) où la règle afficherait 1 / 2 / 3 événements.

| Règle | QC bloc : 1 / 2 / 3 | CAN bloc : 1 / 2 / 3 | QC 24 h : 1 / 2 / 3 | CAN 24 h : 1 / 2 / 3 |
| ---|---|---|---|--- |
| Top 3 fixe | 0 % / 2 % / 97 % | 0 % / 1 % / 99 % | 3 / — / —  (≥ 3 storylines dans 100 % des fenêtres) | idem |
| Héros + ceux ≥ Modérée (max 3) | 9 % / 33 % / 58 % | 10 % / 41 % / 49 % | 38 % / 38 % / 25 % | 12 % / 32 % / 56 % |
| Héros + ceux ≥ Élevée (max 3) | 49 % / 40 % / 11 % | 52 % / 40 % / 8 % | 74 % / 23 % / 3 % | 48 % / 38 % / 14 % |
| Héros + ceux ≥ Très élevée (max 3) | 92 % / 8 % / 0 % | 94 % / 6 % / 0 % | 97 % / 3 % / 0 % | 95 % / 5 % / 0 % |
| Héros + ceux couverts par ≥ 2 médias (max 3) | 66 % / 27 % / 6 % | 63 % / 32 % / 6 % | 2 % / 7 % / 91 % | 5 % / 9 % / 86 % |
| Héros + ceux couverts par ≥ 3 médias (max 3) | 92 % / 7 % / 0 % | 93 % / 6 % / 0 % | 26 % / 33 % / 41 % | 31 % / 29 % / 40 % |

Part des fenêtres 24 h où un top 3 laisserait de côté au moins une storyline ≥ Modérée / ≥ Élevée (seuil où un top 5 se justifierait) : QC : 4.7 % / 0.3 % ; ROC : 19.7 % / 1.5 % ; 

## Complément non censuré : objets saillants par bloc (`objet_year.rds`, indice objet spec v1)

Les objets ne sont pas des événements (un événement porte plusieurs objets), mais cette source n'est PAS tronquée. Seuils = percentiles annuels de l'indice objet > 0 (pas de grille frontend pour les objets) : on compte, par bloc, les objets ≥ p80 et ≥ p95 de leur pays, et la part de blocs à 0/1/2/3/4/5+.

### QC — objets : 2683 blocs ; p80 = 19.2, p95 = 42.1, p99 = 68.0 (×100)

| Compte d'objets par bloc | moyenne | p50 | p80 | p95 | max |
| ---|---|---|---|---|--- |
| ≥ p80 | 19.89 | 19 | 28 | 41 | 110 |
| ≥ p95 | 4.95 | 4 | 8 | 13 | 31 |
| ≥ p99 | 0.99 | 0 | 2 | 4 | 15 |

| Seuil objet | 0 | 1 | 2 | 3 | 4 | 5+ |
| ---|---|---|---|---|---|--- |
| ≥ p95 | 6.5 % | 15.0 % | 14.6 % | 9.4 % | 9.2 % | 45.2 % |
| ≥ p99 | 55.2 % | 22.3 % | 8.3 % | 5.7 % | 4.2 % | 4.3 % |

### CAN — objets : 2682 blocs ; p80 = 17.7, p95 = 35.6, p99 = 66.0 (×100)

| Compte d'objets par bloc | moyenne | p50 | p80 | p95 | max |
| ---|---|---|---|---|--- |
| ≥ p80 | 27.24 | 26 | 37 | 48 | 82 |
| ≥ p95 | 6.76 | 6 | 10 | 14 | 30 |
| ≥ p99 | 1.35 | 1 | 3 | 5 | 15 |

| Seuil objet | 0 | 1 | 2 | 3 | 4 | 5+ |
| ---|---|---|---|---|---|--- |
| ≥ p95 | 2.2 % | 5.1 % | 8.5 % | 9.2 % | 9.4 % | 65.5 % |
| ≥ p99 | 46.4 % | 22.2 % | 10.1 % | 7.9 % | 5.3 % | 8.1 % |

FIN
