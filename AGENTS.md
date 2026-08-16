# AGENTS.md — RADAR+ (`radar-plus`)

Règles universelles, indépendantes de l'outil, pour tout agent ou contributeur qui touche ce dépôt. La guidance spécifique à Claude et l'index chargé au besoin vivent dans [`CLAUDE.md`](./CLAUDE.md).

## Ce que c'est

**RADAR+** ([radarplus.org](https://radarplus.org/)) — site web **public** de suivi de la **saillance médiatique** au Québec et au Canada. Projet **personnel d'Adrien** (GitHub `AdriClout`), open source. Frontend statique (HTML/CSS/JS) hydraté au déploiement à partir de **JSON committés dans `site/`**, produits par un pipeline ETL depuis le **datamart AWS Athena de la CLESSN** (tables de saillance). Hébergé sur **GitHub Pages**. Aucune infra AWS dans ce dépôt — l'accès AWS y est en **lecture seule** (extraction de données).

Pages : Accueil, Évolution, Constellation, Sonar, Unes, Accès aux données.

## Stack

- **Frontend** : HTML / CSS / JavaScript statiques, sans framework. JSON publics dans `site/`.
- **Pipeline ETL** (`pipeline/`) : `fetch_data.py` / `fetch_ticker_data.py` (Python — Athena → CSV) → `build_data.R` / `build_ticker.R` (R — CSV → JSON dans `site/`). Détail et vision cible : [`pipeline/README.md`](./pipeline/README.md).
- **Automatisation** : GitHub Actions (refresh + deploy). **Hébergement** : GitHub Pages (`radarplus.org`).

## Commandes

```bash
python3 -m http.server 8000   # puis http://localhost:8000/site/
```

Rafraîchir les données : voir [`pipeline/README.md`](./pipeline/README.md) — nécessite des identifiants AWS **lecture seule** ; normalement déclenché par les workflows, pas à la main.

## Branches, PR, déploiement

- **`main` protégée** : toute contribution passe par une **Pull Request** ; le check **`quality-gate` est obligatoire** (`pr-quality-gate.yml`).
- `deploy-github-pages.yml` publie `site/` sur GitHub Pages au merge.
- Refresh automatiques (**cron en heure de Montréal**, EDT/EST) : `refresh-constellation.yml` (6×/jour), `refresh-ticker.yml` (~10 min).
- Signalements utilisateur → issues via `report-issue.yml`.

## Hard rules (non négociables)

1. **Ne jamais éditer à la main les JSON *générés* sous `site/`.** Ce sont exactement `graph.json`, `timeseries.json`, `articles.json`, `monitor_input.json` (écrits par `refresh-constellation.yml`) et `ticker.json` (écrit par `refresh-ticker.yml`) : une édition manuelle est écrasée au refresh suivant. Pour changer ces données, modifier `pipeline/` (voir [`pipeline/README.md`](./pipeline/README.md)).
   **Exception — `site/qualite.json` s'édite à la main, et seulement à la main.** Aucun workflow ni script du pipeline ne l'écrit : il porte des **verdicts d'audit** (campagne `aws-refiners#207`), c'est-à-dire des jugements humains traçables à une preuve chiffrée, pas une sortie de calcul. La règle qui s'y applique n'est donc pas « ne pas éditer » mais la règle 4 : chaque `resume` décrit ce qui **EST** vrai à la date du `genere_le`, jamais une correction encore en revue ou en attente de déploiement.
2. **Horaires en heure de Montréal (EDT/EST), pas UTC** — partout où un cron apparaît.
3. **Jamais de credentials ni de données brutes/export dans le dépôt.** Le `quality-gate` les bloque (politique d'accès contrôlé aux données brutes, cf. `site/acces-donnees.html`). Les identifiants AWS servent à l'**extraction en lecture seule** uniquement (workflows), jamais au déploiement.
4. **FAIT vs VISION — jamais d'intention au présent de l'indicatif.** Toute doc qui décrit le système distingue ce qui **EST implémenté** (vérifié dans le code, avec date) de ce qui est **PLANIFIÉ** (marqueur VISION / EN COURS / LIVRÉ). Exemple déjà en place : `pipeline/README.md` marque les scripts ETL comme **temporaires** (état actuel) et les raffineurs CLESSN comme **cible** (vision).

## Place dans l'écosystème de la saillance

RADAR+ consomme l'**algorithme de saillance** via le datamart CLESSN : tables `vitrine_datamart-salient_index` et `vitrine_datamart-salient_headlines_objects`. Le **même** algorithme alimente un autre frontend, **La Vitrine démocratique** — les deux sites reflètent donc les mêmes scores en amont.

- **Vision** ([`pipeline/README.md`](./pipeline/README.md)) : remplacer les scripts ETL de `pipeline/` par des **raffineurs CLESSN**, pour que `site/` charge directement des tables propres.
- **Conséquence pratique** : un changement de l'algorithme de saillance en amont se répercute ici (Constellation, Sonar, Unes) autant que sur la Vitrine — vérifier l'impact à chaque évolution de l'algo.

## Structure du dépôt

- `site/` — pages web de production + JSON publiés (déployé sur Pages)
- `pipeline/` — scripts ETL (temporaires ; CSV intermédiaires gitignorés)
- `radarplus_textes/` — textes éditoriaux du site
- `docs/` — documentation
- `_archives/` — versions archivées
- `.github/workflows/` — CI (`quality-gate`), refresh, deploy, report-issue
