---
name: redaction-methodologie
description: >
  Écrire ou réviser la méthodologie publique de Radar+ (site/methodologie.html,
  site/radarplus.html, site/presentation.html, info-bulle de l'accueil) au bon
  registre : pour le grand public, complète, simple à lire, et inattaquable pour un
  lecteur qui chercherait la faute — chaque affirmation vraie, sourcée, datée, ses
  limites dites. Sans jargon interne (noms de raffineurs, de tables, de colonnes)
  ni détail qui exposerait la propriété intellectuelle ou les droits des médias.
  À utiliser dès qu'on écrit, simplifie ou révise un passage de ces pages, ou qu'il
  est jugé « trop technique », « trop interne », « pas sourcé ». Complète
  synchro-methodologie-radar (QUOI et QUAND) ; celui-ci dit COMMENT.
---

# Rédaction de la méthodologie (Radar+, registre public)

Modèle : le skill du même nom de la Vitrine. La méthodologie de Radar+ vise le même
niveau, avec l'exigence d'Adrien du 26 oct. 2026 : **complète, simple à lire, dans
notre style, et impressionnante pour le lecteur qui voudrait y trouver des défauts.**

## Deux registres à ne jamais confondre

| Doc d'ÉQUIPE (interne) | Méthodologie (publique) |
|---|---|
| Noms de raffineurs (`radar-salient-index`), de tables, de colonnes (`headline_minutes`, `mean_time`, `s_volume`) | Ce que le système **fait**, en français clair |
| Chemins, workflows, détails d'implémentation | Le **principe** et la **logique** |
| Vise la reproduction du code | Vise la **compréhension** et la **confiance** |

Règle d'or : **une phrase qui ne parle qu'aux développeurs n'a pas sa place.** On
décrit le comportement, jamais le composant. (Au 26 oct. 2026, les § 5, 10 et 11
de la page portent encore des noms internes et des formules en code : à reprendre
au fil des mises à jour, section par section.)

## Le test du lecteur hostile

Avant de publier une phrase, se demander : « un lecteur qui veut prouver que c'est
faux peut-il le faire avec nos propres données, notre code ou nos pannes ? »

- **Chaque affirmation se vérifie** : un chiffre a une source et une date (« plus de
  1,6 million de pages d'accueil depuis mai 2024, au 11 juillet 2026 »). Un chiffre
  sans source sort de la page (« plus de 5 millions de captures » : retiré).
- **Pas d'absolu que les données démentent** : « aucun jour manqué », « sans
  interruption », « en temps réel », « fiable à 95 % et plus » sont faux ou
  invérifiables. Dire ce qui est mesuré : « concordance de 96,9 % sur 12 mois ».
- **Nommer les modèles et les fournisseurs** : transparence et reproductibilité
  (GPT-4o d'OpenAI, Claude Sonnet 5 d'Anthropic, GLiNER, Gemma 3). Dire quelle
  chaîne sert à quoi ; ne jamais présenter une chaîne en évaluation comme celle en
  service.
- **Dire les limites avec leur chiffre**, près de la mesure qu'elles touchent (la
  durée surestimée d'environ 1 % ; le temps moyen fixé, avec son effet mesuré).
- **Distinguer le fait de l'objectif** : « l'objectif de l'équipe est… ; ce n'est pas
  encore le cas » — jamais une intention au présent (règle 4 d'`AGENTS.md`).
- **Cohérence interne** : une définition (la Une, les facettes) est la même dans
  toutes les sections et toutes les pages.

## Ce qu'on montre, ce qu'on ne montre pas

- On montre : les sources (médias, période, cadence), les définitions, la logique
  des calculs et des seuils en mots, les modèles employés, les limites connues.
- On ne montre pas : les noms internes, la recette copiable ligne à ligne (PI), le
  texte intégral des articles (toujours renvoyer au site du média).

## Style

- Phrases simples, une idée par phrase ; ton scientifique mais accessible.
- Nommer les choses par leur sens (« le temps moyen qu'un article reste en Une »),
  pas par leur nom de code.
- **FR et EN dans le même fichier** : l'anglais dit exactement la même chose.
- Typographie de la Vitrine (normes de l'OQLF, `AGENTS.md` de la Vitrine, règle 7) :
  pas d'espace avant `; ? !`, insécable avant `:` et `%`, guillemets « ». La page de
  Radar+ n'y est pas encore (espaces ordinaires) : garder sa convention dans une
  retouche ponctuelle, appliquer la norme lors d'une passe complète.

## Exemples (avant → après, 26 oct. 2026)

- ❌ « deux modèles d'IA tournant entièrement en local (aucun appel à des API
  externes, ni à OpenAI ni à Anthropic) »
  ✅ « Depuis mai 2025, ce modèle est GPT-4o (OpenAI). […] Une seconde chaîne,
  entièrement locale, analyse les mêmes Unes en parallèle […] ; ce n'est pas encore
  le cas, faute d'une validation terminée. »
- ❌ « La position est calculée à partir des coordonnées de l'élément HTML. »
  ✅ « Radar+ ne retient que la Une […]. La proéminence est donc incluse par
  construction, mais elle n'est pas graduée. »
- ❌ « Toutes les 10 minutes depuis septembre 2019. Aucune interruption. »
  ✅ « Toutes les 5 minutes en 2019 et 2020, environ toutes les 15 minutes de 2021 à
  l'automne 2022, puis toutes les 10 minutes depuis le 17 avril 2023. […] chacune
  [des pannes] est documentée en direct sur la page Sonar. »

## Procédure

1. Repérer les passages (carte du skill `synchro-methodologie-radar`).
2. Vérifier que le contenu est **vrai et actuel** dans le code ou les données.
3. Réécrire au registre public, passer le test du lecteur hostile, FR et EN.
4. Vérifier qu'aucun détail ne compromet la PI ni les droits des médias.
5. Vérifier le rendu en local puis sur dev.
