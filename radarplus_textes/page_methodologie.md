<!--
================================================================================
INSTRUCTIONS POUR L'IA QUI VA CONVERTIR CE FICHIER EN HTML
================================================================================

OBJECTIF
  Convertir ce markdown en NOUVELLE page HTML pour le site radarplus.org.
  Cette page n'existe pas encore sur le site. URL cible : radarplus.org/methodologie.html

EMPLACEMENT SUR LE SITE
  Ajouter un nouveau lien « Méthodologie » dans la navigation principale
  (à côté de « Radar+ », « Constellation », « Évolution », « Statistiques »,
  « Les Unes »).

AUDIENCE CIBLE
  Chercheurs, journalistes, étudiants gradués. Niveau de précision élevé
  assumé. La page doit pouvoir résister à un examen critique scientifique.

STRUCTURE ATTENDUE
  - Titre principal (h1) : « Méthodologie »
  - Sous-titre : « Comment Radar+ produit ses indices de saillance médiatique »
  - SOMMAIRE NAVIGABLE (TOC) en haut, avec ancres cliquables vers chaque
    section. Chaque entrée scrolle vers la section correspondante.
  - 10 sections principales (h2) numérotées, chacune avec sous-sections (h3)
  - Section finale « Sources » avec liste ordonnée numérotée

CONVENTIONS À RESPECTER (importantes)
  1. Citations [^N] dans le texte : <sup><a href="#ref-N">N</a></sup>
  2. Notes de bas de page : <li id="ref-N">…</li>
  3. Sommaire : ancres vers <h2 id="sec-1">…</h2> etc.
  4. CSS : html { scroll-behavior: smooth; } pour le scroll fluide
  5. Liens externes (DOI, GitHub) : target="_blank" rel="noopener noreferrer"
  6. Préserver les accents français
  7. Préserver les blocs de code inline (notation `pond_time = …`) avec <code>
  8. Le tableau des durées moyennes par média (§5.1) doit devenir un <table>
     HTML propre, avec <thead>, <tbody>, alignement à droite pour la colonne
     numérique
  9. Les blockquotes markdown (>) deviennent <blockquote>, à styliser
     visiblement (encart bordure / fond léger)
  10. Le tableau des fenêtres temporelles (§6) idem : <table> propre
  11. lang="fr", <meta charset="UTF-8">

STYLE / DESIGN
  Page longue et dense — privilégier la lisibilité :
  - Largeur maximale ~720px pour le corps de texte
  - Sommaire (TOC) éventuellement en sticky ou en colonne latérale sur écrans
    larges (optionnel)
  - Bouton « Retour en haut » à la fin (optionnel)
  - Reprendre la palette et la typographie du reste du site

NE PAS CONVERTIR
  Ce bloc « INSTRUCTIONS POUR L'IA » (commentaire HTML, à supprimer)

================================================================================
-->

# Méthodologie

## Comment Radar+ produit ses indices de saillance médiatique

---

## Sommaire

1. Cadre conceptuel
2. Architecture de collecte
3. Identification des objets médiatiques
4. Mesure de la saillance : trois dimensions
5. Calcul des indices
6. Fenêtres temporelles
7. Validation et fiabilité
8. Limites méthodologiques
9. Reproductibilité et accès aux données
10. Sources

---

## 1. Cadre conceptuel

### 1.1 Saillance médiatique : définition opérationnelle

La **saillance** est définie dans la littérature scientifique comme la **prépondérance d'un enjeu ou d'une question dans une sphère donnée** [^1] [^2]. Appliquée aux médias, elle permet de comprendre l'importance accordée par les groupes médiatiques à une nouvelle, un événement, un enjeu, une personne ou un groupe. La saillance médiatique est utilisée dans la littérature comme proxy de l'opinion publique [^3] [^4] [^5], proxy de la sphère politique [^2] [^6], ou comme un mécanisme de sélection et de cadrage de l'information [^6].

### 1.2 Deux types de saillance

Radar+ articule sa mesure autour de **deux axes complémentaires** :

- **Saillance verticale** — le **positionnement des nouvelles** sur la page d'accueil d'un média. Une nouvelle « à la Une », définie comme la première en importance sur la page, est plus saillante que celle située en dessous, qui elle-même est plus saillante que la suivante. C'est cette saillance que les indices calculent en continu.

- **Saillance horizontale** — l'**importance relative des médias entre eux** dans un écosystème médiatique donné. Tous les médias d'un territoire ne pèsent pas le même poids : certains structurent l'agenda public davantage que d'autres. Cette saillance se reflète dans le **choix même des médias** suivis (voir §2 Architecture de collecte).

L'objectif central de Radar+ n'est donc pas de collecter l'ensemble des données de tous les médias d'un territoire, mais bien d'**entreposer les nouvelles les plus saillantes (saillance verticale) des médias les plus saillants (saillance horizontale)**.

### 1.3 Pourquoi la page d'accueil

La page d'accueil constitue la **vitrine éditoriale** d'un média : c'est le lieu où la rédaction décide, en continu, ce qui mérite d'être vu en premier, en plus gros, et le plus longtemps. Elle reflète donc explicitement les priorités éditoriales — bien plus directement que le simple décompte des articles publiés. Cette approche s'inscrit dans la lignée des travaux fondateurs en *agenda-setting* [^6] [^7], qui établissent que les médias structurent les priorités du public moins par ce qu'ils disent que par ce qu'ils mettent en avant [^8].

### 1.4 Articulation théorique

Trois littératures encadrent la démarche :

- **L'agenda-setting** [^6] [^7] : les médias dictent à quoi penser plus qu'ils ne dictent quoi penser.
- **La fragmentation médiatique** [^9] : dans un environnement saturé et hybride [^10], les choix éditoriaux divergent et alimentent des publics aux référents distincts.
- **La saillance comme objet mesurable** [^11] : mesurer rigoureusement ce que chaque média met en avant permet de quantifier des asymétries auparavant intuitives.

---

## 2. Architecture de collecte

### 2.1 Capture continue

Le développement de Radar+ a commencé en **septembre 2018** au sein de la CLESSN. La première version publique a été déployée en **septembre 2019** à l'occasion de l'élection fédérale canadienne, avec un site web dédié et des publications quotidiennes sur les réseaux sociaux. Depuis, sans interruption, un système automatisé photographie **toutes les 10 minutes** la page d'accueil de chaque média suivi. Pour chaque capture, le système conserve :

- la **structure HTML** complète de la page;
- la **position relative** de chaque article (coordonnées sur la grille, niveau hiérarchique);
- les **éléments visuels** associés (titre, surtitre, présence d'une photo, taille du bloc);
- l'**horodatage** précis.

Cette granularité de 10 minutes a été retenue comme compromis entre fidélité à la dynamique éditoriale (les unes peuvent changer plusieurs fois dans une heure lors d'événements vifs) et coûts de stockage. Sur près de sept ans, l'archive cumule plus de **5 millions de captures**.

### 2.2 Médias suivis

Au moment de la mise en ligne publique du site, Radar+ collecte les pages d'accueil de **15 médias actifs** répartis comme suit :

- **Québec (6)** : Radio-Canada, La Presse, Le Devoir, TVA Nouvelles, Journal de Montréal, Montreal Gazette
- **Canada anglophone (7)** : CBC, CTV News, Global News, Toronto Star, The Globe and Mail, National Post, Vancouver Sun
- **États-Unis (2)** : CNN, Fox News

D'autres sources américaines (*The New York Times*, *The Wall Street Journal*) ont été suivies par le passé puis débranchées, principalement pour des raisons d'accès et d'évolution de paywalls. Une expansion vers les médias britanniques, français et belges est en cours, ce qui portera la couverture à **41 médias** à terme.

### 2.3 Critères de sélection des sources

La sélection des médias respecte le postulat de la **saillance horizontale** (§1.2) : il s'agit de retenir les médias les plus structurants d'un écosystème, pas l'ensemble exhaustif. Pour chaque écosystème médiatique, **3 à 10 sources** sont retenues selon **quatre critères** approuvés par le comité scientifique de la CLESSN [^12] :

**1. Fiabilité.** Les médias doivent diffuser des nouvelles journalistiques (pas de tabloïdes). L'ajout d'une source est appuyé sur des sources fiables et académiques justifiant son professionnalisme. La fiabilité d'un média est critique pour la confiance que l'audience lui accorde, les sources fiables étant plus persuasives auprès des lecteurs [^13]. Selon Miller et Peterson, quatre dimensions caractérisent le degré d'attitude : **importance, accessibilité, ambivalence et certitude** [^2]. Les articles dans les journaux et sites de nouvelles présentent un niveau de qualité et de fiabilité supérieur à d'autres sources comme la radio, la télévision ou les réseaux sociaux [^14].

**2. Diversité.** Les médias retenus doivent ensemble représenter la diversité du public d'un écosystème : éventail de **positions idéologiques, langues, cultures et orientations politiques**. Les médias ont un pouvoir de sélection et de cadrage [^15] qui oriente la perception des débats publics; multiplier les angles évite la sélection partiale d'informations [^14]. La partialité de certains médias et leurs tendances ont un impact significatif sur l'opinion publique, surtout lorsque l'audience ne perçoit pas ces penchants.

**3. Portée.** Les médias retenus doivent avoir une **large audience** dans leur écosystème. Avec le temps, les médias sont devenus des centralisateurs d'opinions et de valeurs collectives, structurant la solidarité sociale et l'interprétation partagée du monde [^16]. Plus un média gagne en popularité, plus son audience grandit et plus sa voix gagne en importance auprès des institutions politiques, influençant d'autant sa saillance. Pour quantifier l'audience, des **sources fiables nationales** (par exemple le CRTC au Canada) sont consultées.

**4. Format.** Les médias de Radar+ visent un **équilibre entre formats** : journaux papier, radio, télévision et médias numériques. Tous doivent toutefois disposer d'une page d'accueil web active pour permettre la collecte en continu (la collecte des contenus audio est en développement). Le format médiatique influence le contenu disponible (un journal détaille plus qu'un bulletin télévisé contraint par le temps [^6]) et la mémorisation des nouvelles par le public [^2]. Médias en ligne et médias papier ont un impact comparable sur l'opinion publique mais selon des mécanismes différents et auprès de groupes distincts [^17] : balancer les formats améliore donc la représentation des réalités sociales d'un territoire.

> **À retenir** — chaque écosystème médiatique présente ses particularités. La sélection demeure flexible et conciliante, mais doit toujours servir l'objectif central : la mise en évidence de la **saillance** comme facteur déterminant.

### 2.4 Infrastructure technique

Les données sont archivées et traitées dans une infrastructure **cloud (Amazon Web Services)** depuis 2024, avec environnements de développement, d'acceptation et de production séparés. Le pipeline de traitement est orchestré sur la plateforme **Ellipse** de la CLESSN, qui mutualise les outils techniques entre les modules de la Vitrine démocratique (Polimètre+, Radar+, Agora+).

---

## 3. Identification des objets médiatiques

### 3.1 Définition d'un objet médiatique

Un **objet médiatique** est une entité nommée, identifiable et suivie dans le temps. Quatre grandes catégories sont retenues :

- **Personnes** : politiciens, dirigeants, personnalités publiques (ex. *Donald Trump*, *Mark Carney*);
- **Enjeux** : thèmes politiques et sociaux (ex. *immigration*, *climat*, *économie*);
- **Institutions et organisations** : (ex. *Cour suprême*, *Hydro-Québec*, *Hamas*);
- **Lieux** : (ex. *Ottawa*, *Kyiv*, *Gaza*).

### 3.2 Pipeline d'extraction

À chaque capture, deux modèles d'intelligence artificielle tournant **entièrement en local** (aucun appel à des API externes, ni à OpenAI ni à Anthropic) traitent les titres et amorces d'articles :

1. **Reconnaissance d'entités nommées** — **GLiNER** (*Generalist and Lightweight Model for Named Entity Recognition*), modèle de NER ouvert et zero-shot, identifie l'ensemble des entités présentes dans chaque manchette sans s'appuyer sur un dictionnaire fermé. Cette approche permet de détecter des objets émergents — un nouvel acteur politique, une crise inattendue, un mot-valise propre à un événement — qu'aucun chercheur n'aurait pensé à inclure d'avance.

2. **Normalisation bilingue** — **Gemma 3**, modèle de langage open-weight de Google DeepMind exécuté localement, harmonise les variantes d'un même objet (*Donald J. Trump*, *Trump*, *le président américain*) et résout les correspondances français-anglais (*Cour suprême* / *Supreme Court*; *changements climatiques* / *climate change*). Cette étape est cruciale pour comparer rigoureusement la saillance d'un même objet à travers des médias de langues différentes.

L'exécution locale garantit la souveraineté des données, l'absence de dépendance commerciale, la reproductibilité scientifique et une maîtrise complète des coûts de traitement.

### 3.3 Validation humaine

Les modèles font l'objet d'une **validation humaine continue**. Un benchmark d'environ **1 500 phrases annotées manuellement** par l'équipe sert à étalonner les seuils de prédiction des modèles, à mesurer leur taux d'accord avec le jugement humain et à guider les ajustements successifs lors des mises à jour.

---

## 4. Mesure de la saillance : trois dimensions

Pour chaque objet identifié sur une capture donnée, trois dimensions sont mesurées.

### 4.1 Position

La **position** indique où l'objet apparaît sur la page d'accueil. Elle est calculée à partir des coordonnées de l'élément HTML correspondant et hiérarchisée selon la logique éditoriale du média (zone supérieure, bloc principal, colonnes secondaires, bas de page). Un objet en haut de page reçoit une pondération supérieure à un objet en bas. Cette dimension correspond directement au postulat de **saillance verticale** (§1.2).

### 4.2 Taille

La **taille** mesure l'espace que l'objet occupe : longueur du titre, présence et taille d'une photo associée, dimension du bloc HTML. Un *gros titre* avec image principale n'a pas le même poids qu'une simple brève dans une colonne.

### 4.3 Durée

La **durée** capte la persistance de l'objet dans le temps. Comme les captures sont effectuées toutes les 10 minutes, on peut suivre précisément combien de temps un objet reste affiché sur la page d'accueil — quelques minutes, plusieurs heures, des journées entières — et reconstituer sa **trajectoire** complète. Concrètement, chaque manchette se voit attribuer un nombre de minutes en Une (`headline_minutes`), qui sert ensuite de matière première au calcul des indices (§5).

### 4.4 Pour les chercheurs : les indicateurs textuels complémentaires

> En parallèle des trois dimensions visuelles ci-dessus (position, taille, durée), les travaux de recherche associés à Radar+ développent des **indicateurs textuels** plus fins, calculés à partir du contenu des manchettes et articles : **la durée de vie** (life span — combien de temps un sujet persiste dans la couverture), **le ton** (tone — orientation positive, neutre ou négative du traitement) et **l'intensité** (intensity — densité de couverture sur une période donnée). Ces indicateurs alimentent les analyses scientifiques approfondies (voir §10) et seront progressivement intégrés à l'interface publique. Ils ne remplacent pas les dimensions visuelles, mais les complètent : les unes mesurent ce que le média **affiche**, les autres ce que la couverture **dit**.

---

## 5. Calcul des indices

L'unité de base du calcul est le **bloc de 4 heures (UTC)**. La journée est divisée en six blocs (00–04, 04–08, 08–12, 12–16, 16–20, 20–24); pour chaque bloc, pour chaque pays, pour chaque objet identifié, un indice absolu est calculé. Ce bloc de 4 heures est suffisamment fin pour suivre l'actualité en quasi-temps réel, et suffisamment large pour absorber la variabilité éditoriale entre les médias.

### 5.1 Pondération par média

Tous les médias ne traitent pas leurs manchettes de la même manière. Certains laissent une nouvelle en Une plusieurs heures, d'autres font tourner leur page d'accueil rapidement. Pour rendre les comparaisons équitables, Radar+ calcule pour chaque média sa **durée moyenne en Une** (`mean_time`, en minutes) sur une fenêtre roulante de 3 mois.

À titre indicatif, voici un instantané représentatif de ces durées moyennes :

| Média | Durée moyenne en Une (min) |
|---|---:|
| La Presse | 120,9 |
| TVA Nouvelles | 125,0 |
| Journal de Montréal | 143,0 |
| Fox News | 146,1 |
| CBC | 159,5 |
| Radio-Canada | 160,0 |
| Toronto Star | 221,3 |
| CTV News | 227,9 |
| Montreal Gazette | 241,4 |
| Le Devoir | 241,8 |
| National Post | 249,0 |
| CNN | 296,2 |
| The Globe and Mail | 325,9 |
| Global News | 375,4 |
| Vancouver Sun | 505,3 |

À partir de cette base, deux pondérations sont calculées pour chaque manchette :

- la **pondération intra-média** : `pond_time = headline_minutes / mean_time_média`, qui ramène le temps en Une à la moyenne du média;
- la **pondération inter-médias** : `pond_time_norm = headline_minutes / mean_time_global`, qui ramène ce même temps à la moyenne globale tous médias confondus (**≈ 235,9 min** sur les 15 médias actifs).

C'est la pondération **inter-médias** qui sert au calcul des indices publics, parce qu'elle permet de comparer rigoureusement des médias aux rythmes éditoriaux différents — un *gros titre* de 60 minutes à *La Presse* (où la rotation est rapide) reçoit ainsi un poids différent qu'un *gros titre* de 60 minutes au *Vancouver Sun* (où la stabilité est longue).

### 5.2 Indice de saillance absolu

L'**indice absolu** d'un objet, sur un bloc de 4 heures, combine deux composantes : la **fréquence** d'apparition de l'objet (nombre de manchettes le mentionnant), et la **somme des pondérations inter-médias** des manchettes correspondantes. Plus formellement :

> `absolute_normalized_index = n × Σ pond_time_norm`

où `n` est le nombre de manchettes mentionnant l'objet dans le bloc, et `Σ pond_time_norm` la somme des pondérations inter-médias de ces manchettes.

Cet indice traduit donc **à la fois la fréquence et l'insistance** : un sujet présent sur de nombreux médias mais peu de temps obtient un score élevé; un sujet présent longtemps mais sur un seul média aussi. Les deux régimes sont reconnus.

L'indice absolu se cumule ensuite par addition simple à travers les blocs de 4 heures pour produire des scores **journaliers, hebdomadaires, mensuels et annuels**.

### 5.3 Indice de saillance relatif

L'**indice relatif** d'un objet, sur une fenêtre temporelle donnée, est exprimé en **pourcentage de la saillance totale** de cette fenêtre :

> `relative_normalized_index = (absolute_normalized_index_objet / Σ absolute_normalized_index_tous_objets) × 100`

Toutes les valeurs relatives d'une fenêtre somment donc à 100 %. Cette normalisation permet de **comparer** :

- des périodes différentes (un mois calme c. un mois électoral);
- des médias différents (la saillance du climat à Radio-Canada c. à TVA Nouvelles);
- des univers médiatiques différents (Québec c. Canada anglophone c. États-Unis).

Pour les classements (Hot 20), certains objets purement géographiques très englobants — comme « quebec », « montreal », « canada » — sont exclus, parce qu'ils figurent presque toujours en tête sans véritable signal éditorial.

### 5.4 Pourquoi deux indices

L'indice **absolu** garde la trace de l'intensité réelle d'un événement; l'indice **relatif** rend les comparaisons rigoureuses. Les deux sont nécessaires pour répondre à des questions différentes : *À quel point ce sujet a-t-il dominé?* vs *Comparativement à quoi?*

---

## 6. Fenêtres temporelles

Radar+ permet d'analyser les indices selon plusieurs **fenêtres temporelles**, qui correspondent à des questions différentes :

| Fenêtre | Construction | Question typique |
|---|---|---|
| **4 heures** | Bloc de base (unité de calcul) | Que se passe-t-il en ce moment? Quels objets émergent? |
| **1 jour** | 6 blocs de 4 h | Quelles sont les priorités de la journée? |
| **1 semaine** | 42 blocs de 4 h (6 × 7) | Quelle est la tendance hebdomadaire? Quel est le « gagnant de la semaine »? |
| **1 mois** | ~180 blocs | Quels sujets ont dominé le mois écoulé? |
| **1 année** | ~2 190 blocs | Quelles sont les grandes lignes annuelles de la couverture? |

La fenêtre **hebdomadaire** est calculée à partir d'un point de coupure configurable (par défaut **vendredi 16:00 UTC**), choisi pour minimiser les artefacts de fin de semaine. Le choix de fenêtre influence considérablement les interprétations : un sujet peut être premier sur 4 h sans figurer dans le top 20 hebdomadaire.

---

## 7. Validation et fiabilité

### 7.1 Taux de fiabilité

L'infrastructure actuelle (en production depuis 2024) atteint un taux de fiabilité **supérieur à 95 %** sur les 15 médias actifs. Ce taux est mesuré à partir :

- de la **complétude des captures** (pourcentage de tranches de 10 minutes effectivement archivées);
- de la **qualité d'extraction** des objets médiatiques (taux d'accord avec le benchmark humain);
- de la **stabilité de la normalisation** bilingue (cohérence des regroupements d'entités à travers les langues).

### 7.2 Seuils de complétude temporelle

Les analyses hebdomadaires (Hot 20 notamment) reposent sur une attente théorique de **42 blocs de 4 heures par semaine** (6 par jour × 7 jours). Un seuil minimal configurable — par défaut **39 blocs sur 42** (≈ 93 %) — sert à valider la complétude des données avant publication. Lorsqu'une semaine présente moins de blocs que ce seuil, le système enregistre l'incomplétude dans les journaux et continue le traitement avec les données disponibles, plutôt que de bloquer la publication. Cette tolérance permet de préserver la continuité de la couverture face aux interruptions techniques mineures, tout en signalant explicitement la dégradation de qualité.

### 7.3 Maturation technique et continuité historique

Quatre refontes successives de l'infrastructure technique ont eu lieu entre 2019 et 2024, chacune visant à améliorer la robustesse, la couverture et la précision. Les données antérieures à 2024 (versions plus anciennes) sont conservées et exploitées avec les précautions méthodologiques correspondantes; le **format normalisé issu de la refonte 2024 sert de référence** pour les analyses publiques actuelles.

### 7.4 Benchmark humain

Pour chaque mise à jour majeure des modèles, un échantillon de captures fait l'objet d'une **annotation manuelle** par plusieurs membres de l'équipe. Le **taux d'accord inter-annotateur** sert à évaluer la solidité du benchmark, et les divergences sont arbitrées avant intégration dans les seuils des modèles.

---

## 8. Limites méthodologiques

Aucune mesure n'est neutre. Radar+ revendique sa rigueur en exposant aussi ses limites.

### 8.1 La page d'accueil n'est pas la couverture totale

Radar+ mesure ce qu'un média **met en vitrine**, pas l'ensemble de ce qu'il publie. Un sujet peut faire l'objet de plusieurs articles relégués dans des sections internes sans jamais apparaître sur la page d'accueil. Pour cette raison, Radar+ doit être interprété comme une mesure des **priorités éditoriales mises en avant**, et non comme un recensement exhaustif de la production journalistique.

### 8.2 Biais de sélection des médias

Le corpus suivi est circonscrit (15 médias, en majorité écrits et anglophones/francophones). Les médias diffusés majoritairement à la radio ou à la télévision (sans page d'accueil journalistique active) ne sont pas couverts; les médias hyperlocaux et les nouveaux espaces (réseaux sociaux, infolettres) non plus.

### 8.3 Imperfection des modèles d'IA

La reconnaissance et la normalisation des entités, bien que validées par benchmark humain, restent perfectibles. Les **homonymes**, les **entités émergentes** et les **objets ambigus** (par exemple, un nom propre commun à plusieurs personnalités) peuvent induire des erreurs résiduelles. L'équipe documente publiquement ces cas et révise les modèles périodiquement.

### 8.4 Comparabilité interlinguistique

Comparer la saillance d'un objet en français et en anglais suppose une normalisation parfaite des variantes — un objectif activement poursuivi mais jamais pleinement atteint. Les comparaisons interlinguistiques doivent être interprétées avec cette précaution.

### 8.5 Effet de plateforme

Chaque média structure différemment sa page d'accueil. La normalisation des positions et des tailles à travers des architectures éditoriales hétérogènes implique des choix de conception qui sont documentés mais qui restent des **conventions méthodologiques**, non des vérités absolues.

---

## 9. Reproductibilité et accès aux données

### 9.1 Code ouvert

Le code de Radar+ — pipelines de capture, raffineurs (refiners) AWS Lambda, modèles d'extraction, calculs d'indices, visualisations — est versionné et conservé sur le **GitHub de la CLESSN** ([github.com/clessn](https://github.com/clessn)) et sur **Ellipse Sciences** ([github.com/ellipse-science](https://github.com/ellipse-science)), la plateforme technique mutualisée qui accueille les outils de la Vitrine démocratique. Le package R **`tube`** ([github.com/ellipse-science/tube](https://github.com/ellipse-science/tube)) est utilisé pour interagir avec les datalakes et datamarts. La communauté scientifique est invitée à inspecter, signaler des problèmes et proposer des améliorations.

### 9.2 Accès aux données

Les chercheuses et chercheurs intéressés à exploiter le corpus à des fins d'analyse peuvent en faire la demande via le **formulaire d'accès aux données** disponible sur radarplus.org. Les modalités d'accès sont conçues pour respecter à la fois l'ouverture scientifique et les obligations contractuelles avec les médias source. Les données sont disponibles à plusieurs niveaux de traitement : captures brutes (pages d'accueil archivées), tables intermédiaires (objets extraits, indices par bloc de 4 h), et tables agrégées (Hot 20, classements hebdomadaires/mensuels/annuels).

### 9.3 Pour citer Radar+

Une référence stable est fournie pour citer l'outil dans une publication scientifique. La forme recommandée est :

> CLESSN (2026). *Radar+ : Outil de mesure de la saillance médiatique*. Université Laval. [https://radarplus.org](https://radarplus.org)

Une publication méthodologique détaillée [^11] est en préparation et viendra compléter la documentation officielle.

---

## 10. Sources

[^1]: Krosnick, J. A., Boninger, D. S., Chuang, Y. C., Berent, M. K., & Carnot, C. G. (1993). Attitude strength: One construct or many related constructs? *Journal of Personality and Social Psychology*, 65(6), 1132–1151. [https://doi.org/10.1037/0022-3514.65.6.1132](https://doi.org/10.1037/0022-3514.65.6.1132)

[^2]: Miller, J. M., & Peterson, D. A. M. (2004). Theoretical and empirical implications of attitude strength. *The Journal of Politics*, 66(3), 847–867. [https://doi.org/10.1111/j.1468-2508.2004.00282.x](https://doi.org/10.1111/j.1468-2508.2004.00282.x)

[^3]: Lewis-Beck, M. S., Jacoby, W. G., Norpoth, H., & Weisberg, H. F. (2008). *The American voter revisited*. University of Michigan Press. [https://www.press.umich.edu/206390/american_voter_revisited](https://www.press.umich.edu/206390/american_voter_revisited)

[^4]: Zaller, J. R. (1992). *The nature and origins of mass opinion*. Cambridge University Press. [https://doi.org/10.1017/CBO9780511818691](https://doi.org/10.1017/CBO9780511818691)

[^5]: Van de Wardt, M. (2014). Putting the damper on: Do parties de-emphasize issues in response to internal divisions among their supporters? *Party Politics*, 20(3), 330–340. [https://doi.org/10.1177/1354068811436045](https://doi.org/10.1177/1354068811436045)

[^6]: McCombs, M. E., & Shaw, D. L. (1972). The agenda-setting function of mass media. *Public Opinion Quarterly*, 36(2), 176–187. [https://doi.org/10.1086/267990](https://doi.org/10.1086/267990)

[^7]: Soroka, S. N. (2002). *Agenda-setting dynamics in Canada*. UBC Press. [https://www.ubcpress.ca/agenda-setting-dynamics-in-canada](https://www.ubcpress.ca/agenda-setting-dynamics-in-canada)

[^8]: Iyengar, S., & Kinder, D. R. (2010). *News that matters: Television and American opinion* (Updated ed.). University of Chicago Press. [https://doi.org/10.7208/chicago/9780226388182.001.0001](https://doi.org/10.7208/chicago/9780226388182.001.0001)

[^9]: Mancini, P. (2013). Media fragmentation, party system, and democracy. *The International Journal of Press/Politics*, 18(1), 43–60. [https://doi.org/10.1177/1940161212458200](https://doi.org/10.1177/1940161212458200)

[^10]: Chadwick, A. (2017). *The hybrid media system: Politics and power* (2nd ed.). Oxford University Press. [https://doi.org/10.1093/oso/9780190696726.001.0001](https://doi.org/10.1093/oso/9780190696726.001.0001)

[^11]: CLESSN (en préparation). Publication méthodologique sur Radar+ : indices de saillance et applications dans le contexte canadien. *À paraître*.

[^12]: CLESSN (2021). *Les médias de Radar+ : Document méthodologique de sélection des sources pour l'analyse de contenu médiatique*. Université Laval.

[^13]: Miller, J. M., & Krosnick, J. A. (2000). News media impact on the ingredients of presidential evaluations: Politically knowledgeable citizens are guided by a trusted source. *American Journal of Political Science*, 44(2), 301–315. [https://doi.org/10.2307/2669312](https://doi.org/10.2307/2669312)

[^14]: Hamborg, F., Donnay, K., & Gipp, B. (2019). Automated identification of media bias in news articles: An interdisciplinary literature review. *International Journal on Digital Libraries*, 20(4), 391–415. [https://doi.org/10.1007/s00799-018-0261-y](https://doi.org/10.1007/s00799-018-0261-y)

[^15]: Domke, D., Shah, D. V., & Wackman, D. B. (1998). Media priming effects: Accessibility, association, and activation. *International Journal of Public Opinion Research*, 10(1), 51–74. [https://doi.org/10.1093/ijpor/10.1.51](https://doi.org/10.1093/ijpor/10.1.51)

[^16]: Curran, J. (2012). *Media and power*. Routledge. [https://doi.org/10.4324/9780203077672](https://doi.org/10.4324/9780203077672)

[^17]: Schoenbach, K., De Waal, E., & Lauf, E. (2005). Online and print newspapers: Their impact on the extent of the perceived public agenda. *European Journal of Communication*, 20(2), 245–258. [https://doi.org/10.1177/0267323105052300](https://doi.org/10.1177/0267323105052300)

