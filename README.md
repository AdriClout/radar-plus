# RADAR+

RADAR+ is a public media-salience web project for Quebec and Canada.
RADAR+ est un projet web public de suivi de saillance mediatique au Quebec et au Canada.

## Live Site | Site en ligne

- Primary | Principal: https://radarplus.org/
- Backup | Secours: https://adriclout.github.io/radar-plus/

Main pages | Pages principales:
- Home | Accueil: /index.html
- Evolution: /evolution.html
- Constellation: /constellation.html
- Sonar: /sonar.html
- Front pages | Unes: /unes.html
- Data access | Acces aux donnees: /acces-donnees.html

## Scope | Perimetre

- Open source code repository. | Depot de code open source.
- Public website content and visualizations. | Contenu web public et visualisations.
- Controlled access policy for underlying raw data. | Politique d'acces controle aux donnees brutes.

## Tech Stack

- Frontend: static HTML, CSS, JavaScript | Frontend: HTML, CSS, JavaScript statiques
- Data artifacts: JSON files in site/ | Artefacts de donnees: fichiers JSON dans site/
- Automation: GitHub Actions | Automatisation: GitHub Actions
- Backup hosting: GitHub Pages | Hebergement de secours: GitHub Pages

## Quick Start | Demarrage rapide

1. Clone the repository. | Cloner le depot.
2. Open site/index.html directly, or run a local static server. | Ouvrir site/index.html directement, ou lancer un serveur local.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/site/ | Puis ouvrir http://localhost:8000/site/

## Repository Layout | Structure

- site/: production web pages and JSON artifacts | pages web de production et JSON publies
- pipeline/: temporary ETL scripts for data refresh | scripts ETL temporaires de rafraichissement
- analyses/: analysis scripts and study outputs | scripts d'analyse et resultats d'etudes
- .github/workflows/: CI, data refresh, and deployment workflows | workflows CI, refresh et deploiement

## CI/CD and Governance | CI/CD et gouvernance

- main is protected by branch rules. | main est protegee par des regles de branche.
- Pull requests are required for normal contributions. | Les contributions passent par Pull Request.
- Mandatory PR check: quality-gate (JSON validation, internal static links, actionlint).
- GitHub Pages deploy is automated. | Le deploiement GitHub Pages est automatise.

## Contributing | Contribution

See CONTRIBUTING.md. | Voir CONTRIBUTING.md.

## Security | Securite

See SECURITY.md for private vulnerability reporting. | Voir SECURITY.md pour le signalement prive.

## Data Access | Acces aux donnees

Public policy and request path | Politique publique et chemin d'acces:
- site/acces-donnees.html

## Maintainer

- Adrien (GitHub: AdriClout)
