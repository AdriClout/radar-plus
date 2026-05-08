<!--
================================================================================
INSTRUCTIONS POUR L'IA QUI VA CONVERTIR CE FICHIER EN HTML
================================================================================

OBJECTIF
  Convertir ce markdown en page HTML autonome pour le site radarplus.org.
  Cette page est la page « Radar+ » (présentation longue du projet).
  URL cible suggérée : radarplus.org/radarplus.html

EMPLACEMENT SUR LE SITE
  Cette page est accessible depuis la navigation principale du site, sous
  l'entrée « Radar+ ». Elle remplace l'ancien contenu de radarplus.html (qui
  n'était qu'une reprise des textes courts de la page d'accueil).

STRUCTURE ATTENDUE
  - Titre principal (h1) : « Radar+ »
  - Sous-titre : « Comprendre ce que les médias mettent (vraiment) de l'avant »
  - Encadré TL;DR (visuellement distinct, par exemple bordure de couleur à
    gauche, fond légèrement différent)
  - Section « Pour tout savoir » contenant 6 sous-sections (h2) numérotées
  - Section finale « Sources » (h2) avec liste ordonnée des références

CONVENTIONS À RESPECTER
  1. Les citations [^N] dans le texte deviennent : <sup><a href="#ref-N">N</a></sup>
  2. Les notes de bas de page deviennent : <li id="ref-N">…</li>
  3. Tous les liens externes (DOI, URL d'éditeurs) :
       target="_blank" rel="noopener noreferrer"
  4. Les liens cliqués sur un numéro de référence doivent scroller en douceur
     vers la note correspondante (CSS : html { scroll-behavior: smooth; })
  5. Préserver TOUS les accents français (é, è, ê, à, ô, ç, etc.)
  6. lang="fr" sur l'élément <html>
  7. <meta charset="UTF-8">

STYLE / DESIGN
  Reprendre le style visuel des autres pages du site radarplus.org. Si tu
  produis une page autonome, privilégie une typographie sobre (sans-serif),
  une largeur maximale de ~720px pour le texte, un interligne ~1.6.

NE PAS CONVERTIR
  - Ce bloc « INSTRUCTIONS POUR L'IA » (commentaire HTML, à supprimer)
  - Tout autre commentaire HTML que je laisserais dans le document

================================================================================
-->

# Radar+

## Comprendre ce que les médias mettent (vraiment) de l'avant

---

## TL;DR

Radar+ archive les pages d'accueil de 15 grands médias canadiens et américains **toutes les 10 minutes, sans interruption depuis septembre 2019**. Pour chaque sujet — Donald Trump, l'immigration, le climat, Hydro-Québec — un **indice de saillance** combine trois choses : où le sujet est placé, combien d'espace il occupe, combien de temps il y reste. Le résultat : une carte vivante des priorités médiatiques, qui permet de voir comment un événement monte, dure, puis disparaît — et de comparer les choix d'un média à ceux d'un autre. Radar+ fait partie de la **Vitrine démocratique**, un projet de la CLESSN (Université Laval) qui mesure le pouls de la démocratie sous trois angles : médias, opinion publique et promesses électorales. Les données sont ouvertes, la méthode est documentée, et l'outil est utilisable par tout le monde.

---

## Pour tout savoir

### 1. Pourquoi mesurer la saillance médiatique?

Depuis les travaux fondateurs de McCombs et Shaw, on sait que les médias ne disent pas seulement *quoi* penser : ils disent surtout *à quoi* penser [^1]. Plus un sujet revient en grands titres, plus il a de chances de devenir une priorité dans l'esprit du public. C'est l'effet d'**agenda-setting**, étudié et confirmé dans une multitude de contextes, y compris au Canada [^2].

Or, dans un environnement médiatique de plus en plus fragmenté [^3], les publics ne consomment plus tous les mêmes nouvelles. Ils s'exposent surtout à des sources qui confirment leurs vues [^4][^5][^6], ce qui alimente une polarisation politique et même affective — une hostilité qui dépasse le simple désaccord d'opinions [^7][^8]. Cette dynamique fragilise ce que Habermas appelait la **sphère publique** : un espace partagé où les citoyens débattent à partir d'une réalité commune [^9].

Pour étudier ce phénomène sérieusement, il faut des **données systématiques** sur ce que chaque média met en avant, à quel moment, et pendant combien de temps. C'est exactement ce que Radar+ fournit.

### 2. Comment Radar+ mesure

**Capture continue.** Toutes les 10 minutes, depuis septembre 2019, Radar+ photographie la page d'accueil de chaque média suivi. Aucune interruption, aucun jour manqué — près de sept ans d'archive et plus de **5 millions de captures** cumulées sur 15 médias.

**Identification automatique des objets.** Sur chaque capture, deux modèles d'intelligence artificielle tournant localement entrent en action : un premier repère les **entités nommées** présentes (personnes, lieux, organisations, enjeux), un second les normalise et les harmonise entre français et anglais. Aucun dictionnaire fermé : le système peut détecter des objets émergents qu'aucun chercheur n'aurait pensé à inclure d'avance.

**Trois dimensions de la saillance.** Pour chaque objet identifié, on mesure :
- **la position** sur la page (haut, milieu, bas);
- **la taille** du traitement (gros titre, photo principale, simple brève);
- **la durée** de présence (quelques minutes, plusieurs heures, des journées entières).

**Deux indices.** Ces trois dimensions se combinent en deux indicateurs :
- l'**indice absolu**, cumulatif, qui mesure la saillance totale d'un sujet sur une période;
- l'**indice relatif**, normalisé entre 0 et 100, qui permet de comparer des périodes ou des médias entre eux.

### 3. Ce qu'on peut faire avec Radar+

- **Suivre la trajectoire d'un sujet** dans le temps : son ascension, son sommet, son déclin.
- **Comparer deux médias** sur une même période : qui parle de quoi, quand, et pendant combien de temps.
- **Repérer les angles morts** : sujets qu'un média ignore alors qu'un autre les met en avant.
- **Quantifier les asymétries** entre univers médiatiques (par exemple, Fox News c. CNN aux États-Unis [^10]).
- **Documenter des moments démocratiques majeurs** : élections, crises, débats publics. Les élections fédérales canadiennes de 2021 et de 2025, ainsi que l'élection québécoise de 2022, ont été parmi les premiers grands bancs d'essai publics de l'outil.

### 4. Une histoire qui commence en 2018

Le développement de Radar+ commence en **septembre 2018** à l'Université Laval, dans une équipe de chercheurs en sciences sociales numériques qui se demande comment documenter, de façon rigoureuse et continue, ce que les médias choisissent de mettre en avant. Pendant un an, le scraper est conçu, testé et raffiné en coulisse.

**Septembre 2019 — le premier grand rendez-vous public.** Radar+ est déployé pour couvrir l'**élection fédérale canadienne**. La CLESSN lance un site web dédié et publie sur ses réseaux sociaux **six fois par jour**, chaque jour de la campagne, des analyses tirées en direct de la saillance des partis, enjeux et personnalités sur les pages d'accueil des grands médias canadiens. C'est la naissance publique de l'outil — et l'épreuve du feu.

Le succès de la couverture 2019 donne à l'équipe la confiance d'aller plus loin. L'**élection fédérale de 2021** devient le deuxième grand terrain, suivie l'année d'après par l'**élection québécoise de 2022**, puis par l'**élection fédérale de 2025** dont les données alimentent plusieurs publications scientifiques sur la mesure de la saillance médiatique.

Pendant que l'équipe scientifique extrait des analyses de l'archive, l'infrastructure technique mûrit. Plusieurs refontes successives — chacune apportant plus de fiabilité, plus de couverture et plus de précision — culminent en 2024 avec une migration vers le nuage informatique (Amazon Web Services) et l'introduction de modèles de langage locaux pour la reconnaissance et la normalisation des entités. Radar+ atteint alors un taux de fiabilité supérieur à 95 % sur 15 médias actifs.

En 2026, après huit ans depuis les premières lignes de code et près de sept ans d'archivage continu, Radar+ s'ouvre pleinement au public. Le site **radarplus.org** rend les indices, les unes archivées et les outils d'analyse consultables par tout le monde — chercheurs, journalistes, étudiants, citoyens. La même année, un postdoctorat à UCLA sous la supervision de Stuart Soroka — l'un des grands noms de l'agenda-setting au Canada et aux États-Unis [^2][^11] — inaugure une nouvelle phase consacrée à l'expansion de la couverture américaine et à la comparaison des univers médiatiques nord-américains.

### 5. Radar+ dans la Vitrine démocratique

Radar+ est l'un des trois piliers de la **Vitrine démocratique**, un projet structurant de la CLESSN (Chaire de leadership en enseignement des sciences sociales numériques) sous la direction de **Yannick Dufresne**, à l'Université Laval. Les trois modules couvrent les trois sommets du triangle démocratique :

- **Polimètre+** suit les **promesses électorales** et leur accomplissement;
- **Radar+** mesure la **saillance médiatique** des sujets dans la couverture;
- **Agora+** capte l'**opinion publique** sur les enjeux clés.

Ensemble, ces trois modules permettent une innovation méthodologique inédite : **pondérer les promesses politiques par leur saillance** — une première mondiale dans le domaine du suivi des promesses gouvernementales. Le projet est porté en collaboration avec d'autres centres affiliés à l'Université Laval (GRCP, CAPP, CRDIP, CSDC) et s'inscrit dans une démarche d'**ouverture des données** au service de la recherche, du journalisme et du débat citoyen.

### 6. L'équipe

Radar+ est une œuvre collective. Depuis 2018, le projet rassemble des chercheurs, développeurs, analystes et collaborateurs qui ont contribué à le faire grandir.

**Direction et coordination**
- **Yannick Dufresne** — direction scientifique (CLESSN, Université Laval)
- **Adrien Cloutier** — chargé de projet
- **Étienne Proulx** — gestion de projet (Vitrine démocratique)

**Développement actuel**
- **Patrick Poncet** — développement principal (infrastructure AWS, versions récentes)

**Développement (équipe d'origine et refontes successives)**
- **Olivier Banville** — développement fondateur (premières versions, 2019–2023)
- **Marc-Antoine Rancourt** — équipe fondatrice (web scraping, théorie de la visualisation)
- **William Poirier** — équipe fondatrice
- **Camille Tremblay-Antoine** — équipe fondatrice
- **Clément Cadieux** — développement

**Recherche, analyses et raffinement**
- **Jérémie Drouin**
- **Alexandre Fortier-Chouinard**
- **Jérémy Gilbert**
- **Antoine Lemore**
- **Hubert Cadieux**
- **Hugues-Étienne Moisan-Plante**
- **Benjamin Carignan**
- **Karine Dufresne**
- **Alexandre Bouillon**
- **Arnaud Beaulé**

> Ce projet existe aussi grâce à toutes les personnes qui, à un moment ou un autre, ont contribué à valider, annoter, déboguer ou penser Radar+. Merci à toute l'équipe — actuelle et d'époque.

---

## Sources

[^1]: McCombs, M. E., & Shaw, D. L. (1972). The agenda-setting function of mass media. *Public Opinion Quarterly*, 36(2), 176–187. [https://doi.org/10.1086/267990](https://doi.org/10.1086/267990)

[^2]: Soroka, S. N. (2002). *Agenda-setting dynamics in Canada*. UBC Press. [https://www.ubcpress.ca/agenda-setting-dynamics-in-canada](https://www.ubcpress.ca/agenda-setting-dynamics-in-canada)

[^3]: Mancini, P. (2013). Media fragmentation, party system, and democracy. *The International Journal of Press/Politics*, 18(1), 43–60. [https://doi.org/10.1177/1940161212458200](https://doi.org/10.1177/1940161212458200)

[^4]: Stroud, N. J. (2010). Polarization and partisan selective exposure. *Journal of Communication*, 60(3), 556–576. [https://doi.org/10.1111/j.1460-2466.2010.01497.x](https://doi.org/10.1111/j.1460-2466.2010.01497.x)

[^5]: Stroud, N. J. (2011). *Niche news: The politics of news choice*. Oxford University Press. [https://doi.org/10.1093/acprof:oso/9780199755509.001.0001](https://doi.org/10.1093/acprof:oso/9780199755509.001.0001)

[^6]: Prior, M. (2013). Media and political polarization. *Annual Review of Political Science*, 16, 101–127. [https://doi.org/10.1146/annurev-polisci-100711-135242](https://doi.org/10.1146/annurev-polisci-100711-135242)

[^7]: Iyengar, S., Sood, G., & Lelkes, Y. (2012). Affect, not ideology: A social identity perspective on polarization. *Public Opinion Quarterly*, 76(3), 405–431. [https://doi.org/10.1093/poq/nfs038](https://doi.org/10.1093/poq/nfs038)

[^8]: Iyengar, S., Lelkes, Y., Levendusky, M., Malhotra, N., & Westwood, S. J. (2019). The origins and consequences of affective polarization in the United States. *Annual Review of Political Science*, 22, 129–146. [https://doi.org/10.1146/annurev-polisci-051117-073034](https://doi.org/10.1146/annurev-polisci-051117-073034)

[^9]: Habermas, J. (1991). *The structural transformation of the public sphere: An inquiry into a category of bourgeois society*. MIT Press. [https://mitpress.mit.edu/9780262581080/the-structural-transformation-of-the-public-sphere/](https://mitpress.mit.edu/9780262581080/the-structural-transformation-of-the-public-sphere/)

[^10]: Iyengar, S., & Hahn, K. S. (2009). Red media, blue media: Evidence of ideological selectivity in media use. *Journal of Communication*, 59(1), 19–39. [https://doi.org/10.1111/j.1460-2466.2008.01402.x](https://doi.org/10.1111/j.1460-2466.2008.01402.x)

[^11]: Soroka, S. (2014). *Negativity in democratic politics: Causes and consequences*. Cambridge University Press. [https://doi.org/10.1017/CBO9781107477971](https://doi.org/10.1017/CBO9781107477971)

