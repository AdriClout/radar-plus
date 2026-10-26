---
name: synchro-methodologie-radar
description: >
  Garder la méthodologie publique de Radar+ TOUJOURS vraie : site/methodologie.html
  (FR et EN), site/radarplus.html (À propos), site/presentation.html, l'info-bulle
  de description de site/index.html et leurs copies radarplus_textes/*.md. Dit QUOI
  et QUAND mettre à jour : carte sections ↔ sources de vérité dans le code, faits
  vérifiés et datés, moment de publication. À utiliser pour toute PR (radar-plus,
  aws-refiners, aws-infra) qui touche un calcul, un seuil, un horaire, la collecte,
  un modèle ou une représentation de Radar+ ; pour remplir la section « Impact
  méthodologie » du gabarit de PR (check garde-metho) ; et pour auditer la page
  (« la métho est-elle à jour ? », « vérifie la méthodologie »). Complète
  redaction-methodologie, qui dit COMMENT l'écrire.
---

# Synchro méthodologie (Radar+)

La méthodologie est le **contrat public** de Radar+ : elle dit comment les chiffres
affichés sont produits, et elle sert de base à l'article 2 de la thèse d'Adrien.
**Elle ne doit jamais être périmée, et chaque phrase doit résister à un lecteur qui
cherche la faute.** Règle 5 d'`AGENTS.md`, vérifiée par le check `garde-metho`.
Modèle : le skill du même nom de la Vitrine
(`~/repo_github/vitrine/vitrine-showcase.github.io/.claude/skills/synchro-methodologie/`).

## Les textes couverts (un seul contenu, plusieurs endroits)

1. `site/methodologie.html` — le contrat public, **FR et EN dans le même fichier** :
   toute correction se fait dans les deux langues ;
2. `site/radarplus.html` — À propos (§ 2 « Comment Radar+ mesure », § 4 l'histoire) ;
3. `site/presentation.html` — chiffres clés et cartes des modèles ;
4. l'info-bulle de description de `site/index.html` (classe `cst-tooltip-desc`) ;
5. les copies `radarplus_textes/page_methodologie.md`, `page_radarplus.md`,
   `textes_accueil.md`, qui disent la même chose que le site (pages écrites à la
   main, pas générées : la copie se fait à la main ou par script, voir plus bas).

La page **Sonar** (`site/qualite.json`) décrit la collecte et ses pannes ; elle a sa
propre règle (à jour le soir même du constat) et n'entre pas dans ce check.

## Quand une PR a un impact métho

Impact = un de ces textes deviendrait faux ou incomplet après le **déploiement**.
Cas typiques : calcul ou pondération de l'indice, seuil (paliers, plancher,
alertes), grille des blocs ou cadence, liste des médias ou définition de la Une,
**changement de modèle** (extraction, regroupement, tonalité), nouvelle
représentation ou métrique affichée, retrait d'un élément décrit.
Pas d'impact : refactor sans changement de comportement, correctif qui RAMÈNE le
comportement à ce que la métho décrit déjà, CI et outillage, mise en page.

⚠️ « Pas décrit dans la méthodo » n'est pas « aucun impact ». Le 26 oct. 2026, la
page affirmait « aucun appel à OpenAI ni à Anthropic » alors que GPT-4o extrait les
objets depuis mai 2025 : chaque changement de modèle avait coché « rien à dire ».

## Carte sections ↔ sources de vérité (auditée le 26 oct. 2026)

L'`id` est stable ; le numéro de § bouge. Repérer une section par son `id`.

| Section (`id`, FR) | Décrit | Sources de vérité |
|---|---|---|
| § 1 `cadre-conceptuel` | Concepts (saillance, Une) | rarement touché par le code |
| § 2 `architecture-de-collecte` | Cadences par génération, ce qui est archivé, médias suivis, pannes | aws-infra `src/utils/medias.ts`, `src/utils/etl/<media>-css.ts` (définition de la Une), crons `media-frontpages`/`media-headlines` ; historique `doctorat/_pilotage/HISTORIQUE_RADAR_2019-2026.md` ; pannes : Sonar |
| § 3 `identification-des-objets-médiatiques` | Modèles d'extraction et de regroupement, chaîne locale, validation | aws-refiners `refiners/radar-salient-objects/runtime.R` (modèle des objets), `refiners/radar-event-salience/runtime.R` (fournisseur LLM, mémoire des histoires), `radar-data-preparation` et `radar-object-extraction` (chaîne locale) ; banc : `aws-refiners/docs/validation/`, `_data_article2/03_validation/` |
| § 4 `mesure-de-la-saillance-trois-dimensions` | La Une seule, puis diffusion, volume, durée ; règles de la Une | skill `valider-scrapers-unes` (règles de la Une) et page Notion « Les Unes de Radar+ » ; sélecteurs aws-infra |
| § 5 `calcul-des-indices` | Bloc de 4 h, temps moyen par média, formule spec v1 | aws-refiners `radar-salient-index/runtime.R` (K_VOLUME, K_DUREE, EPS, `media_meta`, panel), `radar-event-salience/runtime.R` (EV_*), fiche `_data_article2/SPEC_V1_REFERENCE.md` ; radar-plus `pipeline/build_data.R` (indice × 100) |
| § 6 `fenêtres-temporelles` | Grille des blocs, jour, semaine | grille de blocs des raffineurs (heure de Montréal depuis le 15 juil. 2026) ; `pipeline/build_data.R` ; crons de `refresh-constellation.yml` |
| § 7 `validation-et-fiabilité` | Concordance, garde-Une, audits | `aws-refiners#207` (campagne), garde-Une `#286`, `site/qualite.json` |
| § 8 `limites-méthodologiques` | Limites connues | TOUT changement qui lève ou introduit une limite ; § 7 de `SPEC_V1_REFERENCE.md` |
| § 9 `reproductibilité-et-accès-aux-données` | Données ouvertes, accès au brut | `site/acces-donnees.html`, contrat R2 de `pipeline/README.md` |
| § 10 `alertes` | Trois niveaux dérivés du pic | `pipeline/build_data.R` (`ALERT_*`) |
| § 11 `paliers` | Paliers de saillance absolue | `pipeline/build_data.R` (paliers par pays, plancher `ALERT_MIN_ABS_SCORE`) |
| § 12 `sources` | Références | — |

Un changement dans une source de droite ⇒ relire la section de gauche **et** les
passages correspondants de `radarplus.html`, `presentation.html` et de l'info-bulle.

## Faits vérifiés à réutiliser (avec leur source)

| Fait | Valeur au 26 oct. 2026 | Source |
|---|---|---|
| Cadence | 5 min (2019-2020), ~15 min (2021-oct. 2022), 10 min depuis le 17 avril 2023 | historique § A.3 |
| Série continue | depuis le 17 avril 2023 ; collecte arrêtée nov. 2022 → avril 2023 | historique |
| Archive | > 1,6 million de pages d'accueil depuis mai 2024 (au 11 juil. 2026) | `aws-refiners#207` |
| Concordance de la collecte | 96,9 % sur 12 mois (628 pages) ; c'est une concordance, pas une exactitude | `aws-refiners#207` |
| Objets | GPT-4o (OpenAI) depuis mai 2025 | `radar-salient-objects` |
| Événements | Claude Sonnet 5 (Anthropic) depuis le 26 août 2026 ; série recalculée avec ce modèle, sauf 23 juil. → 26 août 2026 (GPT-4o) | aws-refiners #400 |
| Chaîne locale | GLiNER + Gemma 3, tonalité ; validation pour l'extraction non terminée | `radar-object-extraction` |
| Blocs | heure de Montréal depuis le 15 juil. 2026, UTC avant | historique, #195 |
| Temps moyen par média | constante estimée une fois (~3 mois), pas de fenêtre roulante | `EV_MEDIA_MEAN_TIME`, `media_meta` |
| Début du développement | sept. 2018 (décision d'Adrien du 25 sept. 2026 ; aucune source primaire datée) | historique § C.1 |

Rafraîchir ce tableau à chaque vérification ; un chiffre sans source n'entre pas
dans la page (cas « plus de 5 millions de captures », retiré le 26 oct. 2026).

## Procédure

1. **Lire le diff** et repérer les sections touchées avec la carte ci-dessus.
2. **Lire le texte actuel** des sections candidates, dans les deux langues, et les
   passages de `radarplus.html`, `presentation.html`, de l'info-bulle — ne jamais
   conclure depuis la carte seule.
3. **Rédiger la mise à jour** (skill `redaction-methodologie`) : ce qui EST déployé,
   jamais ce qui est prévu ; chaque chiffre recopié depuis le code ou une mesure
   datée, jamais de mémoire.
4. **Moment de publication** : PR radar-plus → mise à jour dans la même PR. PR
   aws-refiners/aws-infra → ouvrir la PR métho radar-plus tout de suite, la
   fusionner seulement quand le changement est **déployé**.
5. **Copies** : reporter le texte français dans `radarplus_textes/*.md` (conversion
   HTML → Markdown : `**gras**`, `*italique*`, `[lien](url)`, apostrophes droites).
6. **Vérifier** : rendu local (`python3 -m http.server 8000` → `/site/methodologie.html`),
   table des matières (titres des § 1 à 12, FR et EN), équilibre des balises,
   puis dev.radarplus.org après fusion ; une recherche des anciennes formulations
   doit revenir vide.
7. **Remplir « Impact méthodologie »** dans le corps de la PR : UNE case, avec la
   justification ou les sections touchées.

## Pièges vécus

- **Les dépôts AWS déclarent leur impact sur la Vitrine seulement** : le gabarit de
  PR d'`aws-refiners`/`aws-infra` nomme les trois documents de la Vitrine. Un
  changement d'un étage `radar-*` doit aussi être relu contre la métho de Radar+.
- **Deux langues, un fichier** : corriger le français sans l'anglais laisse une
  page fausse pour la moitié des lecteurs.
- **La section 4 contredisait la section 5** (position et taille « mesurées » contre
  la formule à trois facettes) : relire la page en entier quand une définition change.
