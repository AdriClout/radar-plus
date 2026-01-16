# 📊 RADAR+ - Guide des Métriques de Saillance

Ce document explique les différentes métriques utilisées pour mesurer la **saillance médiatique** dans les analyses RADAR+, ainsi que l'interprétation des visualisations générées.

---

## 🎯 Qu'est-ce que la saillance médiatique?

La **saillance médiatique** mesure l'**attention** qu'accordent les médias d'information à un objet (personne, lieu, événement, enjeu) dans l'espace public.

**Principe clé** : Un objet est saillant s'il est :
- **Mentionné fréquemment** dans les manchettes
- **Affiché longtemps** en Une des sites médias

---

## 📈 Métriques Principales

### 1. Indice de Saillance Absolu

**Définition** : Score brut mesurant l'importance médiatique totale d'un objet.

**Formule** :
```
Score = (Nombre de mentions) × (Temps pondéré en Une)

Où :
- Nombre de mentions : Combien de fois l'objet apparaît dans les titres
- Temps pondéré : headline_minutes normalisé par la moyenne globale
```

**Normalisation** : Le temps est pondéré pour permettre de comparer équitablement :
- Un journal papier (1 édition/jour)
- Un site web d'info continue (MAJ toutes les 15 min)
- Une télé (bulletins réguliers)

**Exemple** :
```
Semaine 1 - "Donald Trump"
- Apparitions : 50 manchettes
- Temps pondéré total : 200 unités normalisées
→ Score = 50 × 200 = 10,000 pts
```

**Pour le classement annuel** : On somme les scores hebdomadaires de toute l'année.

**Utilité** :
- Mesure l'**attention médiatique totale**
- Combine **fréquence** et **durée**
- Comparable entre médias différents

---

### 2. Indice de Saillance Relatif

**Définition** : Pourcentage de l'attention médiatique totale capturé par un objet.

**Formule** :
```
Indice relatif (%) = (Score de l'objet / Somme de tous les scores) × 100
```

**Exemple** :
```
Trump : 100,000 pts
Total tous objets : 500,000 pts
→ Indice relatif = (100,000 / 500,000) × 100 = 20%
```

**Interprétation** : Trump représente 20% de toute l'attention médiatique mesurée.

**Utilité** :
- Mettre en **perspective** la dominance d'un objet
- Comparer des périodes différentes (quotidien vs mensuel)

---

### 3. Taux de Croissance 🚀

**Définition** : Vitesse moyenne d'accélération de la saillance d'une période à l'autre.

**Formule** :
```
Taux de croissance (%) = ((Période N - Période N-1) / Période N-1) × 100
```

**Exemple** :
```
Semaine 1 : 500 pts
Semaine 2 : 1,000 pts
→ Taux = ((1000 - 500) / 500) × 100 = +100%
```

**Pourquoi c'est différent de la saillance brute?**

| Objet | Score total | Taux de croissance | Interprétation |
|-------|-------------|-------------------|----------------|
| Trump | 100,000 pts | +5%/semaine | Saillance énorme mais **stable** |
| Événement X | 5,000 pts | +200%/semaine | Petit score mais **explosion rapide** |

**Utilité** :
- Identifier les **événements qui explosent**
- Différencier les **constantes** des **nouveautés chocs**
- Compléter le classement brut (qui favorise les sujets récurrents)

---

### 4. Impact Initial (Breakout) 💥

**Définition** : Score de saillance lors de la **première période d'apparition**.

**Formule** :
```
Impact initial = Score de la période 1 d'apparition
```

**Exemple** :
```
Incendie Los Angeles apparaît pour la première fois :
- Semaine 1 : 5,000 pts
→ Impact initial = 5,000 pts

Trump (présent depuis toujours) :
- Semaine 1 de 2025 : 3,000 pts
→ Impact initial = 3,000 pts
```

**Interprétation** :
- **Score élevé** = événement qui a **immédiatement capté l'attention**
- **Score faible** = montée progressive, accumulation lente

**Différence avec la saillance totale** :

| Objet | Score total | Impact initial | Pattern |
|-------|-------------|----------------|---------|
| Trump | 100,000 pts | 3,000 pts | Présence continue |
| Incendie | 8,000 pts | 5,000 pts | **Explosion immédiate** puis baisse |

**Utilité** :
- Identifier les **chocs médiatiques**
- Distinguer événements soudains vs sujets qui s'imposent graduellement

---

### 5. Persistance (Durée de Vie)

**Définition** : Nombre de périodes où l'objet apparaît dans les données.

**Exemple** :
```
Trump : présent 32 semaines sur 32 → Persistance maximale
Incendie : présent 2 semaines → Faible persistance
```

**Utilité** :
- Distinguer **sujets récurrents** (Trump, climat, économie) des **événements ponctuels** (catastrophes, scandales)
- Mesurer la **longévité médiatique**

**Visualisation** : Barplot horizontal des nombres de semaines de présence

---

### 6. Volatilité / Variabilité

**Définition** : Écart-type du score sur les différentes périodes.

**Calcul** :
```
Volatilité = Écart-type des scores hebdomadaires
```

**Interprétation** :
- **Faible variabilité** : Score stable d'une période à l'autre (ex: Trump, Biden)
- **Forte variabilité** : Pics et creux importants (ex: événements cycliques, crises)

**Utilité** :
- Identifier les objets **stables** vs **erratiques**
- Détecter les patterns cycliques

**Visualisation** : Violin plot (distribution des scores)

---

## 📊 Visualisations Standard (Hot 20)

Le projet **Hot 20** génère 9 types de visualisations pour chaque édition (QC, CAN, USA) :

### VIZ 1 : Évolution Temporelle - Top 10

**Type** : Line chart

**Contenu** : Évolution du score hebdomadaire des 10 objets les plus saillants de l'année.

**À quoi ça sert** :
- Voir les **tendances** : qui monte, qui descend
- Identifier les **pics** (événements majeurs)
- Comparer la **stabilité** des objets

**Exemple d'insight** :
> "Trump est stable autour de 3,000 pts/semaine, mais Iran a explosé en octobre à 6,000 pts."

---

### VIZ 2 : Heatmap - Qui Domine Quand

**Type** : Heatmap (semaines × objets)

**Contenu** : Intensité de chaque objet du top 10 pour chaque semaine de l'année.

**À quoi ça sert** :
- Repérer les **périodes de dominance**
- Voir les **absences** (cases vides/foncées)
- Identifier les **patterns temporels**

**Exemple d'insight** :
> "Gaza domine en janvier-février, puis disparaît en été."

---

### VIZ 3 : Persistance - Durée de Vie

**Type** : Barplot horizontal

**Contenu** : Nombre de semaines où chaque objet top 20 apparaît.

**À quoi ça sert** :
- Distinguer **constantes** vs **événements ponctuels**
- Mesurer la **longévité médiatique**

**Exemple d'insight** :
> "Trump et United States : 32 semaines. Incendie Los Angeles : 2 semaines."

---

### VIZ 4 : Taux de Croissance - Les "Rockets" 🚀

**Type** : Barplot

**Contenu** : Objets avec la plus forte **accélération** moyenne de saillance.

**À quoi ça sert** :
- Trouver les **événements qui explosent**
- Identifier ce qui est **nouveau et choquant**
- Compléter le classement brut (qui favorise les constantes)

**Exemple d'insight** :
> "Incendie Los Angeles : +300%/semaine → explosion fulgurante"

---

### VIZ 5 : Treemap - Vue d'Ensemble

**Type** : Treemap (rectangles proportionnels)

**Contenu** : Taille des rectangles = score total annuel

**À quoi ça sert** :
- Vue d'ensemble **visuelle** immédiate
- Comparer les **proportions** relatives
- Communication grand public

---

### VIZ 6 : Slope Chart - Évolution Début/Fin

**Type** : Slope chart (lignes début → fin année)

**Contenu** : Position dans le top 10 en début vs fin d'année

**À quoi ça sert** :
- Voir qui **monte** ou **descend** sur l'année
- Identifier les changements de **dominance**

**Exemple d'insight** :
> "Trump #1 en janvier, mais Iran #1 en décembre."

---

### VIZ 7 : Violin Plot - Distribution

**Type** : Violin plot

**Contenu** : Distribution des scores hebdomadaires pour chaque objet top 10

**À quoi ça sert** :
- Visualiser la **variabilité** des scores
- Identifier les objets **stables** vs **volatiles**
- Détecter les outliers (semaines exceptionnelles)

**Exemple d'insight** :
> "Trump a un score très stable. Iran a quelques semaines exceptionnelles."

---

### VIZ 8 : Cumulative - Accumulation

**Type** : Area chart

**Contenu** : Score cumulé au fil de l'année

**À quoi ça sert** :
- Voir la **vitesse d'accumulation**
- Identifier les périodes d'accélération
- Montrer quand un objet a "pris son envol"

---

### VIZ 9 : Breakouts - Impact Initial

**Type** : Barplot

**Contenu** : Score de la première semaine d'apparition

**À quoi ça sert** :
- Identifier les **débuts fracassants**
- Distinguer les explosions soudaines des montées graduelles

**Exemple d'insight** :
> "Incendie LA démarre à 5,000 pts (choc), Trump démarre à 3,000 pts (présence continue)."

---

## 🔄 Analyses de Convergence (QC-CAN)

Ces métriques comparent la saillance entre éditions médiatiques (typiquement QC vs CAN).

### Indice de Jaccard (Similarité)

**Formule** :
```
J(A,B) = |A ∩ B| / |A ∪ B|

Où :
- A = Set des objets top 20 QC
- B = Set des objets top 20 CAN
```

**Interprétation** :
- 0.0 = Aucun objet en commun
- 1.0 = Top 20 identiques

**Exemple** :
```
QC top 20 : 12 objets uniques
CAN top 20 : 15 objets uniques
En commun : 8 objets
→ J = 8 / (12 + 15 - 8) = 8/19 = 0.42
```

### Objets Convergents vs Divergents

**Convergent** : Objet présent dans les 2 top 20 (QC et CAN)

**Divergent** : Objet présent seulement dans 1 des 2

**Métriques dérivées** :
- **Exclusifs QC** : Objets top 20 QC mais pas CAN
- **Exclusifs CAN** : Objets top 20 CAN mais pas QC
- **Ponts** : Objets convergents à haute saillance
- **Murs** : Objets divergents à haute saillance

---

## 🎨 Autres Visualisations

### Réseau de Co-occurrence

**Type** : Network graph (igraph)

**Contenu** : Objets = nœuds, co-apparitions dans manchettes = liens

**À quoi ça sert** :
- Identifier les **clusters thématiques**
- Voir quels objets sont **mentionnés ensemble**

### Communautés (Clustering)

**Algorithme** : Louvain ou walktrap

**Interprétation** : Groupes d'objets fortement connectés (ex: cluster "Ukraine", cluster "Économie")

---

## 💡 Comment Interpréter les Résultats

### Comparaison Trump vs Événement Ponctuel

| Métrique | Trump | Incendie LA | Interprétation |
|----------|-------|-------------|----------------|
| Score total | 100,000 | 8,000 | Trump domine largement |
| Taux de croissance | +5% | +300% | Incendie explose plus vite |
| Persistance | 32 semaines | 2 semaines | Trump = constant, Incendie = ponctuel |
| Impact initial | 3,000 | 5,000 | Incendie = choc immédiat plus fort |
| Variabilité | Faible | Élevée | Trump stable, Incendie volatile |

**Conclusion** : Trump domine en volume total, mais l'incendie a eu un impact initial plus fort et une croissance explosive avant de disparaître.

---

## 🔗 Ressources

- **Code de calcul** : `scripts/metrics.R`
- **Architecture Vitrine** : `docs/ARCHITECTURE.md`
- **Exemple Hot 20** : `analyses/hot20/hot20_2025.R`
