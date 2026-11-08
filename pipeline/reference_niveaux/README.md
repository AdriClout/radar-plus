# Référence fixe des niveaux de saillance (copie)

Copie **identique** de `docs/reference-niveaux/ref-A1.json` du dépôt `ellipse-science/aws-refiners` (source de vérité, PR #636 ; décision d'Adrien du 8 nov. 2026, aws-refiners#207). Ne pas modifier ici : une nouvelle référence s'ajoute (ref-2025 après le grand recompute), l'ancienne reste.

- `ref-A1` : année de l'article 2, 16 oct. 2025 → 15 oct. 2026, série recalculée (code aws-refiners `pilote/these-2026-11-heure` @ 58a5d6c), grille de Montréal.
- Lue par `pipeline/build_data.R` (paliers des objets par pays : `objets.{QC,CAN,USA}`) et `pipeline/build_events.R` (bandes des événements : `evenements.{QC,ROC}.par_edition_x100` et `cumul24h_points`).
- Entre en production **avec** le nouveau code des événements (aws-refiners#635), jamais avant.
- sha256 : `e5c92d76a7ee2e0ec1c19a61b0e7a1bd1d438eb9e827945f35afa4f8742b05a2`
