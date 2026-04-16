# RADAR+

RADAR+ est un projet web public de suivi de saillance mediatique au Quebec et au Canada.

## Francais

### Site en ligne

- Principal: https://radarplus.org/
- Secours: https://adriclout.github.io/radar-plus/

Pages principales:
- Accueil: /index.html
- Evolution: /evolution.html
- Constellation: /constellation.html
- Sonar: /sonar.html
- Unes: /unes.html
- Acces aux donnees: /acces-donnees.html

### Perimetre

- Depot de code open source.
- Contenu web public et visualisations.
- Politique d'acces controle aux donnees brutes.

### Stack technique

- Frontend: HTML, CSS, JavaScript statiques
- Artefacts de donnees: JSON publics dans site/
- Automatisation: GitHub Actions
- Hebergement de secours: GitHub Pages

### Demarrage rapide

1. Cloner le depot.
2. Ouvrir site/index.html directement, ou lancer un serveur local:

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000/site/

### Structure du depot

- site/: pages web de production et JSON publies
- pipeline/: scripts ETL temporaires de rafraichissement
- analyses/: scripts d'analyse et resultats d'etudes
- .github/workflows/: workflows CI, refresh et deploiement

### Gouvernance et protection des donnees

- La branche main est protegee par des regles de branche.
- Les contributions passent par Pull Request.
- Le check quality-gate est obligatoire sur PR.
- quality-gate bloque les donnees brutes/export et les fichiers de secret local.
- Le deploiement GitHub Pages est automatise.

### Documentation

- Contribution: CONTRIBUTING.md
- Securite: SECURITY.md
- Politique d'acces: site/acces-donnees.html

## English

RADAR+ is a public media-salience web project for Quebec and Canada.

### Live site

- Primary: https://radarplus.org/
- Backup: https://adriclout.github.io/radar-plus/

Main pages:
- Home: /index.html
- Evolution: /evolution.html
- Constellation: /constellation.html
- Sonar: /sonar.html
- Front pages: /unes.html
- Data access: /acces-donnees.html

### Scope

- Open source code repository.
- Public website content and visualizations.
- Controlled access policy for underlying raw data.

### Tech stack

- Frontend: static HTML, CSS, JavaScript
- Data artifacts: public JSON files in site/
- Automation: GitHub Actions
- Backup hosting: GitHub Pages

### Quick start

1. Clone the repository.
2. Open site/index.html directly, or run a local static server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/site/

### Repository layout

- site/: production web pages and published JSON
- pipeline/: temporary ETL refresh scripts
- analyses/: analysis scripts and outputs
- .github/workflows/: CI, refresh, and deploy workflows

### Governance and data protection

- main is protected by branch rules.
- Pull requests are required for normal contributions.
- quality-gate is required on PRs.
- quality-gate blocks raw/export datasets and local secret files.
- GitHub Pages deploy is automated.

### Documentation

- Contribution: CONTRIBUTING.md
- Security: SECURITY.md
- Data access policy: site/acces-donnees.html

## Maintainer

- Adrien (GitHub: AdriClout)
