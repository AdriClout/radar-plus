# RADAR+

RADAR+ est un projet web public de suivi de saillance médiatique au Québec et au Canada.

## Français

### Site en ligne

- Principal: https://radarplus.org/
- Secours: https://adriclout.github.io/radar-plus/

Pages principales:
- Accueil: /index.html
- Evolution: /evolution.html
- Constellation: /constellation.html
- Sonar: /sonar.html
- Unes: /unes.html
- Accès aux données: /acces-donnees.html

### Périmètre

- Dépôt de code open source.
- Contenu web public et visualisations.
- Politique d'accès contrôlé aux données brutes.

### Stack technique

- Frontend: HTML, CSS, JavaScript statiques
- Artefacts de données: JSON publics dans site/
- Automatisation: GitHub Actions
- Hébergement de secours: GitHub Pages

### Démarrage rapide

1. Cloner le dépôt.
2. Ouvrir site/index.html directement, ou lancer un serveur local:

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000/site/

### Structure du dépôt

- site/: pages web de production et JSON publiés
- pipeline/: scripts ETL temporaires de rafraîchissement
- analyses/: scripts d'analyse et résultats d'études
- .github/workflows/: workflows CI, refresh et déploiement

### Gouvernance et protection des données

- La branche main est protégée par des règles de branche.
- Les contributions passent par Pull Request.
- Le check quality-gate est obligatoire sur PR.
- quality-gate bloque les données brutes/export et les fichiers de secret local.
- Le déploiement GitHub Pages est automatisé.

### Documentation

- Contribution: CONTRIBUTING.md
- Sécurité: SECURITY.md
- Politique d'accès: site/acces-donnees.html

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
