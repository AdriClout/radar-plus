# Contribution à RADAR+

Merci de contribuer.

## Principes du projet

- Projet open source, transparent et scientifique.
- Respect des sources médias et de leurs droits.
- Le code est ouvert; l'accès aux données est encadré.

## Workflow obligatoire

1. Créer une branche depuis `main`.
2. Faire les changements sur cette branche.
3. Ouvrir une Pull Request vers `main`.
4. Attendre l'approbation requise avant merge.

## Règles de base

- Pas de push direct sur `main` (sauf mainteneur autorisé).
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

1. Create a branch from `main`.
2. Make changes on that branch.
3. Open a Pull Request to `main`.
4. Wait for required approval before merge.

## Ground rules

- No direct push to `main` (except authorized maintainer).
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
