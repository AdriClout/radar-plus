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

**Avant d'ajouter un calcul dans `pipeline/` ou dans une page** (agréger, classer,
cumuler), vérifier qu'aucun raffineur ne le fait ou ne doit le faire : `aws-refiners`,
issues ouvertes (`gh issue list --repo ellipse-science/aws-refiners --search <mot>`).
Les scripts de `pipeline/` sont temporaires (leur README) ; un deuxième calcul finit
par diverger. Vécu le 27 nov. 2026 : des « tops précalculés » proposés dans
`pipeline/` alors que le Hot 20 devait déjà les produire (aws-refiners#422).

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

**Une page qui affiche un classement d'événements** (Évolution, Accueil, Alertes,
Statistiques) : comparer ses rangs et ses points à ceux du Classement pour la même
période (Année, Total, ‹ année précédente). C'est ce contrôle qui a trouvé, le
27 nov. 2026, un « Total » encore limité à 130 jours.

**Poids et équivalence**, pour tout changement de chargement des données :
- relever les fichiers chargés avant et après :
  `performance.getEntriesByType('resource').filter(e => e.name.includes('data.radarplus'))`
  (les tailles inter-domaines y valent 0 : mesurer le poids compressé avec
  `curl -s -o /dev/null -w '%{size_download}' -H 'Accept-Encoding: br, gzip' <url>`) ;
- comparer l'empreinte du texte affiché à l'ancienne version (dev ou prod), vue par vue :
  `crypto.subtle.digest('SHA-256', …)` sur `innerText` du tableau ou de la liste — le
  `localStorage` ne passe pas d'un domaine à l'autre, comparer les empreintes ;
- au-delà de ~300 Ko de données pour une page, le dire avant la promotion
  (Évolution : ~2,2 Mo le 27 nov. 2026 au matin, ~1,05 Mo le soir).

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

**Maquettes : `<meta name="radar-plus-env" content="dev-only" />`.** Une page qui
porte ce marqueur est publiée sur dev et retirée de la prod par `preparer-site.sh`
(#179, 27 nov. 2026) : une promotion peut donc embarquer une maquette sans la
publier. Avant de promouvoir, lire le corps des PR en attente : une PR qui dit « ne
pas promouvoir » sans ce marqueur bloque la promotion.

**Une promotion embarque TOUT ce qui attend sur develop**, pas seulement le
changement qu'on veut publier (vécu le 25 oct. 2026 : un correctif de Sonar
aurait emmené 67 commits de pages jamais regardés). Avant de proposer une
promotion, compter l'écart (`git rev-list --count origin/main..origin/develop`)
et lister les pages touchées (`git diff --stat origin/main origin/develop -- site/`)
pour qu'Adrien les regarde toutes sur dev d'un seul coup. Ne pas contourner par
une PR directe vers `main` : le flux reste develop → main.

**Lui donner un tour de dev, pas une liste de fichiers** (vécu le 29 oct. 2026,
88 commits). Partir des titres des PR fusionnées depuis la dernière promotion
(`git log --merges --format=%s origin/main..origin/develop`) et du `diff --stat`,
et les regrouper par page : pour chacune, l'adresse, ce qui doit s'y voir et
un geste à faire (clic, filtre, panneau). Ajouter une adresse bidon (page 404) si
`site/404.html` ou `_headers` a changé, et un passage sur téléphone si une PR
porte « mobile ». Vérifier d'abord que dev sert bien le dernier commit
(`gh run list --workflow deploy-dev.yml --branch develop --limit 1`).

**Promotion d'un changement invisible** (pipeline, workflow, docs, skills) :
corps court, sans tour de dev. Modèle (PR #79, #120) :

```
## Quoi
Promotion `develop → main` : #NNN (pipeline seulement, aucun fichier de `site/` touché).
## Vérifié
- [x] En CI : run <id> vert, <ce qui a été publié et relu>.
- [x] Sur dev : sans objet (données seulement).
## Non exécuté
Rien.
## Données
<ce qui change dans ce que le site affiche, ou « aucun changement »>
## Impact méthodologie
- [x] Aucun impact métho — … (justification, en nommant ce qui a été relu : …)
---
- [x] Vérifié sur dev le AAAA-MM-JJ : pipeline seulement, aucun fichier déployé touché ; <fichier> publié et relu sur data.radarplus.org
```

Vérifier avant que develop ne contient rien d'autre en attente : sinon c'est
une promotion visible, avec le tour de dev.


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
  **Ce lancement manuel demande le feu vert explicite d'Adrien dans la conversation**
  (en mode auto, il est refusé sans ça ; vécu le 27 nov. 2026). Sinon : fusionner et
  vérifier au cron suivant (heures de Montréal : 0, 4, 8, 12, 16, 20 h), en gardant
  un repli côté site tant que le nouveau fichier n'est pas publié.
- Une attente de run : `gh run watch <id> --exit-status --interval 15`.
- `curl … | grep -q` casse sous `set -o pipefail` (grep ferme le tube, curl sort
  en erreur 23) : télécharger dans un fichier puis grep.
- Les paquets R sont mis en cache avec une clé qui porte l'empreinte de l'image
  (`ubuntu-24.04` épinglée) : si un run casse sur `dyn.load` / `libicu`, c'est
  l'image qui a bougé, changer la clé (`r-constellation-vN`).

## 6. Cloudflare (une seule fois, déjà fait)

**Cache des données** (règle posée le 27 nov. 2026, zone radarplus.org → Caching →
Cache Rules) : `data.radarplus.org/*` est servi depuis le cache selon le
`Cache-Control` de `publish_r2.py` (60 s pour index, agrégats et ticker, 300 s pour le
reste) ; les 404 ne sont jamais mis en cache. Un fichier tout juste publié peut donc
rester ancien jusqu'à 5 min : pour le voir tout de suite, ajouter `?t=<n'importe quoi>`
(chaque paramètre a sa propre entrée de cache). Pas d'accès wrangler en local : la
règle se change dans le tableau de bord.

Projets Pages `radar-plus` et `radar-plus-dev`, bucket R2 `radar-plus-data`,
zone `radarplus.org` (compte `capp`). Si un jour il faut recréer un projet Pages
avec wrangler : `wrangler pages project create <nom> --production-branch <b> --force`
— **sans `--force`, wrangler 4 crée un Worker** (et écrit un `wrangler.jsonc`
parasite à la racine), pas un projet Pages.
