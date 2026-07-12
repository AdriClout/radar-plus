# radar-plus — CLAUDE.md

**Commence par [`AGENTS.md`](./AGENTS.md).** Il porte les règles universelles : ce qu'est le repo, la stack, les commandes, branches/PR/déploiement, les hard rules et la place dans l'écosystème de la saillance. Ce fichier ajoute la guidance propre à Claude et un index chargé au besoin, pour garder le contexte de travail petit.

## Comment travailler ici (context engineering)

- **Divulgation progressive.** Ne charge un fichier de référence que quand la tâche le demande — l'index ci-dessous mappe besoins → fichiers.
- **Vérifier avant de livrer.** Le `quality-gate` est obligatoire sur PR (il bloque données brutes/export et secrets). Traite un `quality-gate` vert comme la barre minimale. Pour un changement visible, vérifie le rendu en local (`python3 -m http.server 8000` → `/site/`).
- **FAIT vs VISION.** Ne décris jamais une intention au présent. Le code des scripts + les workflows sont la source de vérité ; `pipeline/README.md` sépare déjà l'ETL temporaire (fait) de la cible raffineurs (vision).

## Index (à lire au besoin)

| Besoin | Fichier |
|--------|---------|
| Pipeline ETL (extraction Athena, transformation, cible raffineurs) | [`pipeline/README.md`](./pipeline/README.md) |
| Politique d'accès aux données brutes | `site/acces-donnees.html` |
| CI / refresh / déploiement (crons Montréal, quality-gate, Pages) | `.github/workflows/` |

## Rappels rapides (les règles le plus souvent oubliées)

- **Ne jamais éditer à la main les JSON sous `site/`** — réécrits par les workflows de refresh depuis `pipeline/`.
- **Les crons sont en heure de Montréal** (EDT/EST), pas UTC.
- **Aucun secret ni donnée brute dans le repo** — le `quality-gate` les bloque.
- **`main` est protégée** : passer par une PR, `quality-gate` requis.

Détail et rationale complets : [`AGENTS.md`](./AGENTS.md).
