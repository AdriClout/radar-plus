# Contribution à RADAR+

Merci de contribuer.

## Principes du projet

- Projet open source, transparent et scientifique.
- Respect des sources médias et de leurs droits.
- Le code est ouvert; l'accès aux données est encadré.

## Workflow obligatoire

> ⚠️ **`main` = PRODUCTION.** Tout merge sur `main` auto-déploie sur **radarplus.org en ~2 min** (`deploy-github-pages.yml`). Il n'y a pas d'environnement de dev intermédiaire : ce qui entre dans `main` est public immédiatement.

1. **Preview local d'abord** : `cd site && python3 -m http.server 8000` → http://localhost:8000/site/. Itérer ici.
2. **Brancher depuis `main`** : `git checkout main && git pull && git checkout -b feat/mon-sujet`. Jamais de commit direct sur `main` (protégé par ruleset).
3. **Faire les changements.** ⚠️ **Ne jamais éditer à la main les données machine-owned** : `site/timeseries.json`, `site/graph.json`, `site/ticker.json`, `site/articles.json`. Elles sont rafraîchies automatiquement par les workflows (`refresh-constellation`, `refresh-ticker`) ; toute édition manuelle sera écrasée.
4. **Push + ouvrir une PR vers `main`** → déclenche le gate `quality-gate` (JSON valide, liens internes, blocage données brutes/secrets, actionlint). Si le gate échoue, corriger avant le merge.
5. **Revue.** Le ruleset actuel n'exige **pas** d'approbation (projet à mainteneur unique). Quand un collaborateur rejoint, on passera à 1 approbation requise. En attendant : relire sa propre PR avec soin.
6. **Merge → en ligne sur radarplus.org en ~2 min.**

## Règles de base

- Pas de push direct sur `main` (sauf mainteneur autorisé / bot de données).
- Une PR doit être claire, testée et documentée.
- Ajouter des captures pour les changements UI.

## Politique données

- Ne pas versionner de données brutes de médias.
- Ne pas ajouter de dumps ou exports non autorisés.
- Toujours privilégier des références vers les sources originales.

Formats explicitement interdits dans le git history: `csv`, `tsv`, `parquet`, `feather`, `arrow`, `rds`, `sqlite`, `db`, `xls`, `xlsx`.

Le workflow CI `quality-gate` bloque automatiquement:

- les fichiers de données brutes/exports,
- les fichiers locaux d'environnement et secrets (`.env*`, `.Renviron`, `*.pem`, `*.key`, `*.p12`),
- tout fichier ajouté sous `data/` sauf `data/.gitkeep` et `data/README.md`.

Le contrôle se fait sur toute la plage de commits de la PR (pas seulement l'état final des fichiers).

## Message de commit recommandé

Format simple:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `chore: ...`

## Questions

Ouvrir une issue ou contacter le mainteneur principal: `@AdriClout`.

## Sécurité

- Ne pas publier de faille sécurité en issue publique.
- Utiliser le canal de signalement privé (GitHub vulnerability reporting) ou contacter `@AdriClout`.
- Voir aussi `SECURITY.md` pour le processus complet.

---

# Contributing to RADAR+

Thank you for contributing.

## Project principles

- Open, transparent, scientific project.
- Respect media sources and their rights.
- Code is open; data access is controlled.

## Required workflow

> ⚠️ **`main` = PRODUCTION.** Every merge to `main` auto-deploys to **radarplus.org within ~2 min** (`deploy-github-pages.yml`). There is no intermediate dev environment: whatever lands on `main` is immediately public.

1. **Preview locally first**: `cd site && python3 -m http.server 8000` → http://localhost:8000/site/. Iterate here.
2. **Branch off `main`**: `git checkout main && git pull && git checkout -b feat/my-thing`. Never commit straight to `main` (protected by a ruleset).
3. **Make changes.** ⚠️ **Never hand-edit the machine-owned data**: `site/timeseries.json`, `site/graph.json`, `site/ticker.json`, `site/articles.json`. They are refreshed automatically by workflows (`refresh-constellation`, `refresh-ticker`); manual edits get overwritten.
4. **Push + open a PR to `main`** → triggers the `quality-gate` (valid JSON, internal links, raw-data/secret block, actionlint). If the gate fails, fix before merging.
5. **Review.** The current ruleset does **not** require an approval (single-maintainer project). When a collaborator joins, we'll switch to 1 required approval. Until then: review your own PR carefully.
6. **Merge → live on radarplus.org in ~2 min.**

## Ground rules

- No direct push to `main` (except authorized maintainer / data bot).
- A PR must be clear, tested, and documented.
- Add screenshots for UI changes.

## Data policy

- Do not version raw media data.
- Do not add unauthorized dumps or exports.
- Prefer references to original sources.

Explicitly blocked formats in git history: `csv`, `tsv`, `parquet`, `feather`, `arrow`, `rds`, `sqlite`, `db`, `xls`, `xlsx`.

The `quality-gate` CI workflow automatically blocks:

- raw data/export files,
- local environment and secret files (`.env*`, `.Renviron`, `*.pem`, `*.key`, `*.p12`),
- any file under `data/` except `data/.gitkeep` and `data/README.md`.

The gate scans the full commit range of the PR (not only the final file tree state).

## Recommended commit message prefixes

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `chore: ...`

## Questions

Open an issue or contact the main maintainer: `@AdriClout`.

## Security

- Do not publish security vulnerabilities in public issues.
- Use private reporting (GitHub vulnerability reporting) or contact `@AdriClout`.
- See `SECURITY.md` for the full process.
