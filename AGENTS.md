# AGENTS.md — RADAR+ (`radar-plus`)

Règles universelles, indépendantes de l'outil, pour tout agent ou contributeur qui touche ce dépôt. La guidance spécifique à Claude et l'index chargé au besoin vivent dans [`CLAUDE.md`](./CLAUDE.md).

## Ce que c'est

**RADAR+** ([radarplus.org](https://radarplus.org/)) — site web **public** de suivi de la **saillance médiatique** au Québec et au Canada. Projet **personnel d'Adrien** (GitHub `AdriClout`), open source. Frontend statique (HTML/CSS/JS) qui lit au chargement des **JSON publiés dans un bucket Cloudflare R2** (`radar-plus-data`, adresse dans `site/assets/js/config.js`), produits par un pipeline ETL depuis le **datamart AWS Athena de la CLESSN** (tables de saillance). Ces JSON **ne sont pas dans git** (chantier 5, #52, livré le 24 oct. 2026). Hébergé sur **Cloudflare Pages** (DEV `dev.radarplus.org`, PROD `radarplus.org` ; zone DNS sur Cloudflare depuis le 24 oct. 2026, #51). Aucune infra AWS dans ce dépôt — l'accès AWS y est en **lecture seule** (extraction de données).

Pages : Accueil, Évolution, Constellation, Sonar, Unes, Accès aux données.

## Stack

- **Frontend** : HTML / CSS / JavaScript statiques, sans framework. JSON publics dans `site/`.
- **Pipeline ETL** (`pipeline/`) : `fetch_data.py` / `fetch_ticker_data.py` (Python — Athena → CSV) → `build_data.R` / `build_ticker.R` (R — CSV → JSON dans `site/`). Détail et vision cible : [`pipeline/README.md`](./pipeline/README.md).
- **Automatisation** : GitHub Actions (refresh + deploy). **Hébergement** : Cloudflare Pages (`radarplus.org`, `dev.radarplus.org`) ; données dans Cloudflare R2 (`data.radarplus.org`).

## Commandes

```bash
python3 -m http.server 8000   # puis http://localhost:8000/site/
```

Rafraîchir les données : voir [`pipeline/README.md`](./pipeline/README.md) — nécessite des identifiants AWS **lecture seule** ; normalement déclenché par les workflows, pas à la main.

## Branches, PR, déploiement

Modèle DEV/PROD calqué sur la Vitrine (#51, livré le 24 oct. 2026, DNS basculé le même jour).

- **`develop` = DEV** (branche par défaut). Toute fonctionnalité : branche depuis `develop` → PR vers `develop` (check **`quality-gate` obligatoire**, `pr-quality-gate.yml`). À la fusion, `deploy-dev.yml` publie `site/` sur le projet Cloudflare Pages **`radar-plus-dev`** → https://dev.radarplus.org (`noindex` ; alias technique radar-plus-dev.pages.dev).
- **`main` = PROD.** On n'y arrive que par une **PR de promotion `develop → main`** (branche `develop` ou `promotion/AAAA-MM-JJ-sujet`), dont le corps contient `- [x] Vérifié sur dev le AAAA-MM-JJ : <observé>` — vérifié par **`garde-promotion`** (`garde-promotion.yml`), en plus du `quality-gate`. À la fusion, `deploy-prod.yml` publie sur le projet Pages **`radar-plus`** → https://radarplus.org (alias technique radar-plus.pages.dev). Une prod ne s'annule pas (`cancel-in-progress: false`).
- **GitHub Pages est retiré** (24 oct. 2026) : plus de `deploy-github-pages.yml`, `finalize-pages-domain.yml` ni `site/CNAME`. Les données sont servies par `data.radarplus.org` (bucket R2, #52).
- Les deux déploiements passent par `.github/scripts/preparer-site.sh` (exclut les JSON générés et `CNAME`, injecte le jeton public de signalement, `_headers` noindex en dev) puis `wrangler pages deploy` (secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` ; environnements GitHub `development` et `production`, ce dernier réservé à `main`).
- **Permissions** : zéro approbation requise et dérogation admin pour Adrien (seul contributeur). Quand un second contributeur arrive : passer à 1 approbation et retirer la dérogation dans les rulesets, rien d'autre à changer.
- Refresh automatiques (**cron en heure de Montréal**, EDT/EST) : `refresh-constellation.yml` (6×/jour), `refresh-ticker.yml` (~10 min). Ils écrivent les JSON **dans R2** (`wrangler r2 object put`, secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`), jamais dans git : rafraîchir les données ne crée ni commit ni déploiement.
- Signalements utilisateur → issues via `report-issue.yml`.

## Hard rules (non négociables)

1. **Ne jamais éditer à la main, ni commiter, les JSON *générés* du site.** Ce sont exactement `graph.json`, `timeseries.json`, `articles.json`, `monitor_input.json` (écrits par `refresh-constellation.yml`) et `ticker.json` (écrit par `refresh-ticker.yml`). Ils vivent dans le bucket R2 `radar-plus-data` ; un run local du pipeline les écrit dans `site/` où ils sont **gitignorés**. Une édition manuelle est écrasée au refresh suivant. Pour changer ces données, modifier `pipeline/` (voir [`pipeline/README.md`](./pipeline/README.md)).
   **Exception — `site/qualite.json` s'édite à la main, et seulement à la main.** Aucun workflow ni script du pipeline ne l'écrit : il porte des **verdicts d'audit** (campagne `aws-refiners#207`), c'est-à-dire des jugements humains traçables à une preuve chiffrée, pas une sortie de calcul. La règle qui s'y applique n'est donc pas « ne pas éditer » mais la règle 4 : chaque `resume` décrit ce qui **EST** vrai à la date du `genere_le`, jamais une correction encore en revue ou en attente de déploiement.
2. **Horaires en heure de Montréal (EDT/EST), pas UTC** — partout où un cron apparaît.
3. **Jamais de credentials ni de données brutes/export dans le dépôt.** Le `quality-gate` les bloque (politique d'accès contrôlé aux données brutes, cf. `site/acces-donnees.html`). Les identifiants AWS servent à l'**extraction en lecture seule** uniquement (workflows), jamais au déploiement ; le déploiement et la publication des données passent par le jeton Cloudflare (`CLOUDFLARE_API_TOKEN`, scope Pages + R2 sur le compte `capp`). **Aucun secret n'est jamais injecté dans le site** : tout fichier déployé est lisible par n'importe quel visiteur. Un jeton GitHub (`public_repo`) l'a été du 16 mai au 27 oct. 2026 pour le formulaire de signalement ; un service qui a besoin d'un secret passe par un relais côté serveur. `preparer-site.sh` fait échouer le déploiement s'il trouve un jeton GitHub ou une clé AWS dans le site.
4. **FAIT vs VISION — jamais d'intention au présent de l'indicatif.** Toute doc qui décrit le système distingue ce qui **EST implémenté** (vérifié dans le code, avec date) de ce qui est **PLANIFIÉ** (marqueur VISION / EN COURS / LIVRÉ). Exemple déjà en place : `pipeline/README.md` marque les scripts ETL comme **temporaires** (état actuel) et les raffineurs CLESSN comme **cible** (vision).
5. **La méthodologie publique n'est JAMAIS périmée — impact méthodologie obligatoire sur chaque PR.** « Métho » = les textes publics qui décrivent comment les chiffres sont produits : `site/methodologie.html` (le contrat public, FR et EN), `site/radarplus.html` (À propos : collecte, modèles), `site/presentation.html` (chiffres et modèles), l'info-bulle de description de `site/index.html`, et leurs copies `radarplus_textes/*.md`, qui disent la même chose. Toute PR — de ce dépôt **ou** d'`aws-refiners`/`aws-infra` quand elle touche un étage `radar-*` — qui change un calcul, un seuil, un horaire, la collecte, un modèle ou une représentation met ces textes à jour ou déclare explicitement l'absence d'impact : section « Impact méthodologie » du gabarit de PR, vérifiée par le check `garde-metho`. Deux skills encadrent ce travail : [`synchro-methodologie-radar`](./.claude/skills/synchro-methodologie-radar/SKILL.md) (QUOI et QUAND mettre à jour, carte sections ↔ code) et [`redaction-methodologie`](./.claude/skills/redaction-methodologie/SKILL.md) (COMMENT l'écrire : grand public, sans nom interne, chaque chiffre sourcé). Pour un changement d'`aws-refiners`/`aws-infra`, la PR métho se fusionne quand le changement est **déployé** (corollaire de la règle 4). Modèle : la Vitrine (règle 6 de son `AGENTS.md`). Né de l'audit du 26 oct. 2026 : la page affirmait « aucun appel à OpenAI ni à Anthropic » et des mesures de position et de taille qui n'existent pas (corrigé par #112).

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
