---
name: deployer-radar-plus
description: >
  Livrer un changement sur radarplus.org en suivant la boucle du dépôt :
  branche depuis develop → vérification en local → PR vers develop → dev
  (dev.radarplus.org) → PR de promotion develop → main avec la case « Vérifié
  sur dev » → prod. Couvre les commandes exactes, ce que Claude peut fusionner
  lui-même, la vérification d'une page migrée contre l'ancienne version, le
  test local sur un dossier de données, et les pièges rencontrés (wrangler qui
  crée un Worker, curl | grep -q sous pipefail, cache des scripts sur Pages,
  onglet caché du navigateur intégré). Utiliser dès qu'on doit « livrer »,
  « déployer », « mettre en prod », « promouvoir », « ouvrir la PR » ou
  « vérifier sur dev » pour Radar+.
---

# Déployer Radar+ (develop → dev → promotion → prod)

Modèle calqué sur la Vitrine (chantier 4, #51, livré le 24 oct. 2026).
Détail des règles : `AGENTS.md` § Branches, `docs/CONTRIBUTING.md`.

| Branche | Site | Déploiement |
|---|---|---|
| `develop` (défaut) | https://dev.radarplus.org (noindex ; alias radar-plus-dev.pages.dev) | `deploy-dev.yml` à chaque push touchant `site/**` |
| `main` | https://radarplus.org (alias radar-plus.pages.dev) | `deploy-prod.yml` à la fusion d'une PR de promotion |

Les données ne passent pas par là : elles sont dans R2 (`data.radarplus.org`),
rafraîchies par `refresh-constellation.yml` / `refresh-ticker.yml` qui tournent
sur la branche **par défaut, donc `develop`** (un changement de pipeline fusionné
dans develop est actif au prochain cron, avant la promotion).

## 1. Branche et vérification locale

```bash
git checkout develop && git pull --ff-only origin develop
git checkout -b feat/<issue>-<sujet>
python3 -m http.server 8000      # puis http://localhost:8000/site/
```

- Commits signés par Adrien seul (`git -c user.name=AdriClout -c user.email=…`),
  jamais de trailer Co-Authored-By ; le pied de page Claude Code va dans la PR.
- Avant de pousser : `actionlint .github/workflows/*.yml` si un workflow a changé ;
  `node --check` sur les scripts inline des pages modifiées.

### Tester le site sur un dossier de données local

`config.js` accepte `?data_base=<url>` (mémorisé dans `localStorage`,
`?data_base=reset` pour revenir à `data.radarplus.org`). Exemple avec l'artefact
`out_r2` d'un run manuel de `refresh-constellation` :

```bash
gh run download <run_id> -n out_r2 -D pipeline/out_r2   # gitignoré
```

puis `http://localhost:8000/site/index.html?data_base=http://localhost:8000/pipeline/out_r2`.
Le ticker et `monitor_input.json` répondent 404 dans ce mode (ils ne sont pas dans
`out_r2`) : normal.

### Comparer une page migrée à l'ancienne version

Copier l'ancienne page sous un autre nom (ignoré par git grâce à la règle `*.html`),
la charger avec les données publiques, et comparer les mêmes réglages :

```bash
git show develop:site/evolution.html > site/evolution_old.html
```

`…/evolution_old.html?country=QC&data_base=reset` contre
`…/evolution.html?country=QC&data_base=http://localhost:8000/pipeline/out_r2`,
même granularité, lire les 8 premiers rangs (valeurs et deltas) : ils doivent
être identiques. Supprimer la copie avant de commettre.

## 2. PR vers develop

```bash
git push -u origin <branche>
gh pr create --base develop --head <branche> --title "…" --body-file <corps.md>
```

Le gabarit (`.github/pull_request_template.md`) demande : Quoi / Vérifié (local,
dev) / Non exécuté / Données et méthodologie. Check requis : `quality-gate`.
Quand il est vert, **Claude peut fusionner** (0 approbation requise) :

```bash
gh pr merge <n> --merge --delete-branch
```

Ne jamais passer `--admin` (le classificateur de l'app le refuse) et ne jamais
supprimer `develop`.

## 3. Vérifier sur dev

Attendre `deploy-dev` (`gh run list --workflow deploy-dev.yml --branch develop`),
puis vérifier la ou les pages touchées sur https://dev.radarplus.org dans le
navigateur intégré : requêtes vers `data.radarplus.org` (préfixe `v2/` seulement
pour une page migrée), zéro erreur console, un geste réel (recherche, clic sur une
cellule, ouverture d'un panneau).

Pièges du navigateur intégré :
- **Onglet caché** = pas d'animation : le bandeau d'alertes n'obtient jamais sa
  classe `.ready` (il attend un `requestAnimationFrame`) et les captures échouent.
  Prendre une capture ou afficher le panneau avant de conclure ; sinon lire avec
  `javascript_tool` seulement.
- **Premier chargement d'un domaine neuf** : 2-3 ressources sortent en
  `ERR_BLOCKED_BY_CLIENT` (approbation de site). Recharger avant de conclure.
- **Cache des scripts** : les `.js/.css` sont servis avec `max-age=14400`. Les
  HTML déployés portent `?v=<sha>` sur chaque script (`preparer-site.sh`), mais
  une page ouverte avant le déploiement garde l'ancien script : recharger avec
  `fetch(url, {cache: 'reload'})` ou un nouveau `?v=`.

## 4. Promotion develop → main

**Règle d'Adrien (24 oct. 2026) : un changement visible n'est promu qu'après
son propre regard sur dev.** Après le déploiement dev, lui donner l'adresse
exacte à regarder (page, onglet, geste) et attendre son GO ; ne pas ouvrir ni
fusionner la promotion avant. Seuls les changements invisibles (pipeline,
workflows, docs, skills) se promeuvent sur vérification technique.

**Une promotion embarque TOUT ce qui attend sur develop**, pas seulement le
changement qu'on veut publier (vécu le 25 oct. 2026 : un correctif de Sonar
aurait emmené 67 commits de pages jamais regardés). Avant de proposer une
promotion, compter l'écart (`git rev-list --count origin/main..origin/develop`)
et lister les pages touchées (`git diff --stat origin/main origin/develop -- site/`)
pour qu'Adrien les regarde toutes sur dev d'un seul coup. Ne pas contourner par
une PR directe vers `main` : le flux reste develop → main.


```bash
gh pr create --base main --head develop --title "promotion : …" --body-file <corps.md>
```

Le corps DOIT contenir, après le gabarit, la ligne vérifiée par `garde-promotion` :

```
- [x] Vérifié sur dev le AAAA-MM-JJ : <ce qui a été observé, 15 caractères ou plus>
```

Checks requis : `quality-gate` + `garde-promotion`. Puis `gh pr merge <n> --merge`
(sans `--delete-branch`). `deploy-prod` se déclenche si `site/**`, le script de
préparation ou le workflow ont changé ; sinon `gh workflow run deploy-prod.yml --ref main`.
Vérifier ensuite https://radarplus.org comme pour dev.

## 5. Pipeline et workflows

- Tester un changement de pipeline avant fusion :
  `gh workflow run refresh-constellation.yml --ref <branche>` (publie dans R2 les
  mêmes données que la prod, et archive `out_r2` en artefact sur lancement manuel).
- Une attente de run : `gh run watch <id> --exit-status --interval 15`.
- `curl … | grep -q` casse sous `set -o pipefail` (grep ferme le tube, curl sort
  en erreur 23) : télécharger dans un fichier puis grep.
- Les paquets R sont mis en cache avec une clé qui porte l'empreinte de l'image
  (`ubuntu-24.04` épinglée) : si un run casse sur `dyn.load` / `libicu`, c'est
  l'image qui a bougé, changer la clé (`r-constellation-vN`).

## 6. Cloudflare (une seule fois, déjà fait)

Projets Pages `radar-plus` et `radar-plus-dev`, bucket R2 `radar-plus-data`,
zone `radarplus.org` (compte `capp`). Si un jour il faut recréer un projet Pages
avec wrangler : `wrangler pages project create <nom> --production-branch <b> --force`
— **sans `--force`, wrangler 4 crée un Worker** (et écrit un `wrangler.jsonc`
parasite à la racine), pas un projet Pages.
