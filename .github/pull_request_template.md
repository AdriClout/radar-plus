## Quoi

<!-- Une PR = un sujet, tenable en un écran. Refs #… -->

## Vérifié

- [ ] En local (`python3 -m http.server 8000` → `/site/`)
- [ ] Sur dev (https://dev.radarplus.org) si le changement est visible

## Non exécuté

<!-- Ce qui n'a pas été testé et pourquoi. « Rien » est une réponse valable. -->

## Données

<!-- Si la PR touche pipeline/ ou l'indice : quoi, et ce qui change dans ce que le site affiche. Sinon : « aucun ». -->

## Impact méthodologie

<!--
« Métho » = les textes publics qui disent comment les chiffres sont produits :
  1. site/methodologie.html   (le contrat public, FR et EN)
  2. site/radarplus.html      (À propos : collecte, modèles)
  3. site/presentation.html   (chiffres et modèles)
  + l'info-bulle de description de site/index.html
  + les copies radarplus_textes/*.md, qui disent la même chose.
Ils doivent TOUJOURS décrire le système tel qu'il est déployé.

⚠️ Piège vécu (26 oct. 2026) : la page affirmait « aucun appel à OpenAI ni à
Anthropic » et des mesures de position et de taille qui n'ont jamais existé.
« Pas décrit dans la méthodo » n'est pas « aucun impact » : vérifiez les
textes, pas seulement la page Méthodologie.

Cochez UNE case (le check garde-metho la vérifie si la PR touche des fichiers
sensibles). Guide : .claude/skills/synchro-methodologie-radar/SKILL.md
-->

- [ ] Aucun impact métho — ne change ni calcul, ni seuil, ni horaire, ni collecte, ni modèle, ni représentation, ET les textes publics restent exacts (justification, en nommant ce qui a été relu : …)
- [ ] Métho mise à jour dans cette PR (sections et pages : …)
- [ ] PR métho séparée : #… (à fusionner avec ou après le déploiement de celle-ci)

---
**Promotion vers `main` seulement** (PR `develop → main`) — obligatoire, vérifiée par `garde-promotion` :

- [ ] Vérifié sur dev le AAAA-MM-JJ : <ce que tu as observé>
