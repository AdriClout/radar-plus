# Contribution à RADAR+

Merci de contribuer.

## Principes du projet

- Projet open source, transparent et scientifique.
- Respect des sources médias et de leurs droits.
- Le code est ouvert; l'accès aux données est encadré.

## Workflow obligatoire

`develop` = site de dev (https://dev.radarplus.org), `main` = production (https://radarplus.org).

1. Créer une branche depuis `develop`.
2. Faire les changements, vérifier en local (`python3 -m http.server 8000` → `/site/`).
3. Ouvrir une Pull Request vers `develop` ; attendre `quality-gate` vert, fusionner.
4. Regarder le résultat sur dev (déployé automatiquement).
5. Promouvoir : PR `develop → main` avec la case `- [x] Vérifié sur dev le AAAA-MM-JJ : <observé>` (vérifiée par `garde-promotion`). La fusion déploie la production.

## Règles de base

- Pas de push direct sur `develop` ni `main` (sauf mainteneur autorisé, en urgence).
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

`develop` = dev site (https://dev.radarplus.org), `main` = production (https://radarplus.org).

1. Create a branch from `develop`.
2. Make changes, check locally (`python3 -m http.server 8000` → `/site/`).
3. Open a Pull Request to `develop`; wait for a green `quality-gate`, merge.
4. Look at the result on dev (deployed automatically).
5. Promote: PR `develop → main` with the line `- [x] Vérifié sur dev le YYYY-MM-DD : <what you saw>` (checked by `garde-promotion`). Merging deploys production.

## Ground rules

- No direct push to `develop` or `main` (except authorized maintainer, in an emergency).
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
