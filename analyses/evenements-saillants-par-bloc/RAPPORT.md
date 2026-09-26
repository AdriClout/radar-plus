# Combien d'événements saillants par tranche de 4 h ? Québec vs Canada

*Mesure du 2026-08-23, préalable à l'affichage des événements saillants sur radarplus.org.*
Script : [`mesure_evenements_par_bloc.R`](mesure_evenements_par_bloc.R) · sortie intégrale : [`sortie_mesure.md`](sortie_mesure.md).

## 1. Question et hypothèse

Hypothèse à tester : dans une tranche de 4 h, l'actualité québécoise est très convergente — il y a rarement plus de 3 événements vraiment saillants (souvent 1, 2 ou 3) ; le Canada anglais serait peut-être différent. Enjeu : montrer 1, 2, 3, 5 ou 10 événements en page d'accueil, et le même choix pour une page de suivi longitudinal.

## 2. Sources, et le piège confirmé

| Source | État | Verdict |
|---|---|---|
| (a) Rejeu local d'un an `banc-235/out/year_llm.rds` (2025-05-17 → 2026-08-07, 2 683 blocs, régime LLM) | **tronqué au top 3 par région par bloc** : `max(event_rank_in_region) = 3`, 3 lignes/bloc dans 97 % des blocs | utilisé, avec diagnostic de censure |
| (b) Athena DEV `headline_events_4h` (≥ 2026-07-23) | même troncature, par construction (`runtime.R` l. 1253 : « ne contient que le top TARGET_MIN_EVENTS par bloc/pays », `TARGET_MIN_EVENTS = 3`) | pas plus informatif que (a), non interrogé |
| (c) `public/data/headline-events.json` (3 jours) | 88 blocs, rangs 1–3 seulement | insuffisant |
| Checkpoint du rejeu `year_llm.rds.ckpt` | stocke les cartes **après** `project_top_events_per_country` (`replay_year.R` l. 750) | tronqué aussi |
| Objets `banc-235/out/objet_year.rds` (indice objet spec v1, 720 k lignes) | **non tronqué** | complément, § 5 |

**Conséquence** : aucune source n'observe un 4e événement. Tout comptage « n événements ≥ seuil » est plafonné à 3. Ce qui reste mesurable proprement :

1. la part des blocs où **le 3e du top 3 dépasse encore le seuil** — c'est une **borne supérieure** de la part réelle des blocs à ≥ 4 (au biais près que le top 3 est trié par l'ancien `score_region`, pas par l'indice spec v1 ; les deux sont fortement corrélés) ;
2. la **concentration** (rang 2 et rang 3 en % du rang 1) ;
3. des critères **absolus**, non calibrés sur le top 3 : couverture par ≥ 2, ≥ 3, ≥ 4 médias de la région ;
4. le **cumul 24 h** par storyline, aux conventions exactes du frontend Vitrine (6 blocs, demi-vie 10 h, poids normalisés, vitrine#566) — c'est la grandeur que le site classe, calculée sur la même table tronquée.

Indice : spec v1 **recomposée** depuis le JSON `articles` (constantes et fonctions copiées de `grilles_annee_specv1.R`), jamais la colonne publiée (mélange ancienne/nouvelle formule avant le bloc 15-19 du 2026-08-08). Seuils : constantes du frontend (`NEW_BLOCK_*_THRESHOLDS`, `SUM_*_CUMUL_MESURE ÷ 3,347`). Les percentiles annuels recalculés concordent avec ces grilles (QC p20/p50/p80 = 18,0 / 21,6 / 43,9 contre 17,4 / 21,5 / 41,9 ; ROC 15,9 / 20,0 / 39,3 contre 15,9 / 20,0 / 37,2).

**Mise en garde de lecture.** Les bandes par bloc sont des percentiles *de la population top-3 elle-même* (Faible = p5, Modérée = p20, Élevée = p50, Très élevée = p80, Extrême = p95). « Combien d'événements ≥ Modérée par bloc » vaut donc ≈ 3 × 0,8 = 2,4 par construction ; ce n'est pas une mesure de convergence. Les colonnes informatives sont la *répartition* entre blocs, les bandes hautes (Très élevée, Extrême) et les critères absolus (≥ 2 médias).

## 3. Résultats par bloc de 4 h

### 3.1 Part des blocs selon le nombre d'événements au-dessus du seuil (plafond 3)

| Seuil | Région | 0 | 1 | 2 | 3 (plafond) = borne sup. de « ≥ 4 » |
|---|---|---|---|---|---|
| ≥ Élevée (p50) | **QC** | 6,9 % | 42,5 % | 39,5 % | **11,0 %** |
| | **CAN** | 6,2 % | 46,1 % | 39,7 % | **7,9 %** |
| ≥ Très élevée (p80) | **QC** | 44,1 % | 47,7 % | 7,8 % | **0,5 %** |
| | **CAN** | 41,7 % | 52,6 % | 5,6 % | **0,1 %** |
| couvert par ≥ 2 médias de la région | **QC** | 19,1 % | 47,3 % | 27,3 % | **6,3 %** |
| | **CAN** | 11,2 % | 51,4 % | 31,9 % | **5,5 %** |
| couvert par ≥ 3 médias | **QC** | 49,6 % | 42,8 % | 7,2 % | **0,4 %** |
| | **CAN** | 40,6 % | 52,8 % | 6,3 % | **0,3 %** |

Compte moyen par bloc (QC / CAN) : ≥ Élevée 1,55 / 1,49 · ≥ Très élevée 0,65 / 0,64 · ≥ Extrême 0,16 / 0,16 · ≥ 2 médias 1,21 / 1,32 · ≥ 3 médias 0,58 / 0,66 · ≥ 4 médias 0,24 / 0,36.

### 3.2 Concentration

| | QC p20 / p50 / p80 | CAN p20 / p50 / p80 |
|---|---|---|
| rang 2 / rang 1 | 37 % / **61 %** / 90 % | 36 % / **60 %** / 87 % |
| rang 3 / rang 1 | 25 % / **42 %** / 70 % | 26 % / **40 %** / 60 % |

Le 1er est ≥ Élevée dans 93 % des blocs (QC 93,1 %, CAN 93,8 %). « Une seule histoire domine » (1er ≥ Élevée et 2e < Modérée) : 7,6 % QC, 9,2 % CAN. Blocs sans aucun événement ≥ Modérée : 0,1–0,2 %.

### 3.3 Stabilité dans le temps

La part mensuelle des blocs à « 3 événements ≥ Élevée » oscille entre 2 % (QC, janvier 2026) et 17 % (QC, octobre 2025) ; côté canadien entre 5 % et 15 %. Pas de mois où le plafond est atteint souvent : le constat tient sur les 15 mois (tableau complet dans la sortie).

## 4. Résultats sur le cumul 24 h par storyline (ce que le site classe)

Fenêtre glissante de 6 blocs, toutes les storylines de la fenêtre comptées (12 par fenêtre au QC, 11 au Canada, en médiane).

| Seuil (cumul, points sur 100) | Région | 0 | 1 | 2 | 3 | 4 | 5+ |
|---|---|---|---|---|---|---|---|
| ≥ Modérée | **QC** (12,5) | 6,1 % | 31,7 % | 37,5 % | 19,9 % | 4,3 % | 0,4 % |
| | **CAN** (9,1) | 0,4 % | 11,4 % | 32,3 % | 36,2 % | 15,8 % | 4,0 % |
| ≥ Élevée | **QC** (17,7) | 23,9 % | 49,8 % | 23,2 % | 2,8 % | 0,3 % | 0 % |
| | **CAN** (13,6) | 7,7 % | 40,0 % | 38,1 % | 12,7 % | 1,5 % | 0 % |
| ≥ Très élevée | **QC** (28,8) | 62,0 % | 35,4 % | 2,6 % | 0 % | 0 % | 0 % |
| | **CAN** (25,4) | 48,0 % | 47,0 % | 4,8 % | 0,1 % | 0 % | 0 % |

Part des fenêtres où un **top 3 laisserait de côté** au moins une storyline ≥ Modérée / ≥ Élevée : **QC 4,7 % / 0,3 % ; Canada 19,7 % / 1,5 %**.

Ratio des cumuls (p50) : 2e / 1re = 65 % QC, 62 % CAN ; 3e / 1re = 44 % QC, 39 % CAN.

### Combien d'événements chaque règle d'affichage montrerait-elle ?

Toujours au moins le 1er (« héros »), au plus 3. Lecture : part des cas où la règle affiche 1 / 2 / 3.

| Règle | QC bloc | CAN bloc | QC 24 h | CAN 24 h |
|---|---|---|---|---|
| Top 3 fixe | 0 / 2 / 97 % | 0 / 1 / 99 % | 0 / 0 / 100 % | 0 / 0 / 100 % |
| Héros + ceux ≥ Modérée | 9 / 33 / 58 % | 10 / 41 / 49 % | **38 / 38 / 25 %** | **12 / 32 / 56 %** |
| Héros + ceux ≥ Élevée | 49 / 40 / 11 % | 52 / 40 / 8 % | 74 / 23 / 3 % | 48 / 38 / 14 % |
| Héros + ceux ≥ Très élevée | 92 / 8 / 0 % | 94 / 6 / 0 % | 97 / 3 / 0 % | 95 / 5 / 0 % |
| Héros + ceux couverts par ≥ 2 médias | 66 / 27 / 6 % | 63 / 32 / 6 % | 2 / 7 / 91 % | 5 / 9 / 86 % |
| Héros + ceux couverts par ≥ 3 médias | 92 / 7 / 0 % | 93 / 6 / 0 % | 26 / 33 / 41 % | 31 / 29 / 40 % |

## 5. Complément non censuré : les objets

`objet_year.rds` (indice objet spec v1, sans troncature). Un événement porte plusieurs objets, donc les comptes ne sont pas comparables terme à terme ; mais la répartition dit la même chose. Objets **≥ p99** de leur pays par bloc : QC 0 → 55 %, 1 → 22 %, 2 → 8 %, 3+ → 14 % ; CAN 0 → 46 %, 1 → 22 %, 2 → 10 %, 3+ → 21 %. Le Canada est un peu plus dispersé (panel de 7 médias plus hétérogènes : CBC, CTV, GAM, NP, TTS, VS, GN), le Québec un peu plus concentré.

## 6. Conclusions

**L'hypothèse est confirmée, dans les limites de la censure.**

1. **Par bloc de 4 h, 1 à 3 événements suffisent, des deux côtés.** Au-delà du 1er (≥ Élevée dans 93 % des blocs), le 2e vaut typiquement 60 % du 1er et le 3e 40 %. Le 3e est ≥ Élevée dans 11 % des blocs (QC) et 8 % (CAN) — donc « ≥ 4 événements ≥ Élevée » arrive dans **au plus** 11 % / 8 % des blocs, et en réalité bien moins. Au niveau Très élevée ou couvert par ≥ 3 médias, le 3e ne dépasse presque jamais (≤ 0,5 %) : la censure ne mord pas, et il n'y a jamais plus de 2 événements de ce calibre dans une même tranche.
2. **Sur 24 h (la grandeur affichée), le Québec est nettement plus convergent que le Canada.** Au QC, 1 ou 2 storylines ≥ Modérée dans 69 % des fenêtres, et un top 3 n'omet une storyline ≥ Modérée que 4,7 % du temps (≥ Élevée : 0,3 %). Au Canada, 3 ou plus ≥ Modérée dans 56 % des fenêtres et un top 3 en omet une dans 19,7 % des cas (≥ Élevée : 1,5 %). Le Canada justifie un **top 5** pour couvrir « Modérée et plus » ; aucun des deux ne justifie un top 10 — ce qui est au-delà du 5e est, par construction des bandes, sous la médiane des Unes.
3. **Top 3 / top 5 / top 10 ?** Par bloc : **top 3** (et souvent moins) des deux côtés — un top 5 ou 10 par bloc n'est ni mesurable ni, au vu de la concentration, utile. Sur 24 h : **top 3 au Québec, top 5 au Canada** si on veut couvrir Modérée+, **top 3 des deux côtés** si le critère est Élevée+. Top 10 : non justifié nulle part.
4. **Règle d'affichage recommandée pour l'accueil** (24 h, comme la Une des Unes de Vitrine) : héros toujours affiché, 2e et 3e seulement s'ils sont ≥ Modérée. Cela montre 1 / 2 / 3 événements dans 38 / 38 / 25 % des cas au Québec et 12 / 32 / 56 % au Canada — exactement le « souvent 1, 2 ou 3 » de l'hypothèse, et la différence Québec/Canada devient visible sans seuil différent.

### Limites et comment lever la censure

- Le top 3 est trié par l'ancien `score_region` ; la borne « ≥ 4 » suppose que le 4e par ancien score n'a pas un indice spec v1 supérieur au 3e. Rarement faux, jamais vérifié.
- Le seul moyen d'observer un 4e événement : rejouer avec `overrides = list(TARGET_MIN_EVENTS = 10L)` dans `replay_year.R` (mécanisme d'override existant, l. 110). Coût : appels OpenAI (clustering LLM) — un mois (~186 blocs) sur gpt-4o-mini ≈ 0,50 $ et ~1 h ; l'année ≈ 5 $ et une nuit (plafond `CAP_USD` du banc). Un mois suffirait pour vérifier que le 4e est sous Modérée dans > 95 % des blocs. **À décider par Adrien**, non lancé ici.
- La grille cumul ROC (n = 75 sur trois semaines d'Athena) est fragile ; les constats canadiens sur 24 h sont à relire après la recalibration sur l'année civile prévue (`ref-2025`).

---

# Étape 2 — Cadrage de l'adaptation de radarplus.org (proposition, rien d'implémenté)

Inventaire de l'existant (fait en lecture seule) : l'accueil (`site/index.html`, 2 573 l.) affiche par défaut le **Hot 20 des objets** (`renderHot20()`, `aggregateNodes()` somme les `size` = `absolute_normalized_index` sur la période) à partir de `graph.json` + `timeseries.json` (130 jours, blocs de 4 h, clé `YYYY-MM-DD_HH-HH`, nœuds `{id, size, n, alert_*}`), plus le ticker. `evolution.html` (3 617 l., ~2 940 l. de JS inline) lit `timeseries.json` seul : modes **Hot 10** (`ranked`, top-N par granularité jour/semaine/mois/année/total) et **Recherche/suivi** (`tracking`), journée partielle avec blocs futurs synthétiques et badge « EN DIRECT », heatmap de convergence sur la barre temporelle. Pipeline : `fetch_data.py` (2 requêtes Athena : `salient_index`, `salient_headlines_objects`, 130 jours) → `build_data.R` → 4 JSON, via `refresh-constellation.yml` 6×/jour (secrets `AWS_*_DEV`, `GH_PAT`). Pas de hook interdisant l'édition des JSON, mais la quality-gate valide `jq` sur `site/*.json` et refuse tout `.rds/.csv` ; les JSON sont de toute façon écrasés à chaque run.

## (4) Données : ce que le pipeline doit lire en plus, et quel JSON produire

**À lire** — une 3e requête dans `fetch_data.py` sur `"vitrine_datamart-headline_events_4h"` : `date_utc, time_interval_utc, event_id, storyline_id, event_label, title, text, main_issue, target_region, country_id, event_rank_in_region, salience_index_qc, salience_index_roc, outlets_qc, outlets_roc, media_ids_qc, media_ids_roc, representative_url, representative_media_id, first_seen_utc, articles` `WHERE date_utc >= …` → `pipeline/headline_events.csv`. Filtres côté build : `target_region ∈ {QC, ROC}`, `country_id ≠ USA`, titre requis ; pour le Canada, `target_region = ROC` (pas de dédup QC/ROC : chaque région garde ses 3 lignes, comme la mesure).

**Deux contraintes de fenêtre** :
- régime LLM seulement depuis le **2026-07-23** (avant : regroupement statistique, événements plus fragmentés — ne pas mélanger dans une série longitudinale) ;
- la colonne publiée `salience_index_qc/roc` n'est spec v1 que depuis le **bloc 15-19 du 2026-08-08**. Pour remonter plus haut, recomposer depuis `articles` dans le build (port en R des ~40 lignes de `reg_idx_v1` + constantes du tag spec-v1, déjà dans le script de mesure) — ou attendre le rejeu/backfill de la table prévu côté Vitrine. **Recommandation** : recomposer dans le build, avec la date de bascule en constante, pour que radarplus.org et Vitrine affichent le même chiffre.

**À produire** — `site/events.json` (nouveau ; ~2–4 Mo pour 130 jours : 2 régions × 6 blocs × 3 événements × 130 j ≈ 4 700 lignes + articles) :

```
{ meta: { generated_at, regime_from: "2026-07-23", half_life_h: 10, window_blocks: 6,
          thresholds: { QC: { block: {...}, sum24h: {...} }, ROC: { block: {...}, sum24h: {...} } },
          periods: [{key, date, interval, label}] },            // mêmes clés que timeseries.json
  blocks: { QC: { "<periodKey>": [ { event_id, storyline_id, title, text, main_issue,
                                     index, outlets, media_ids, rank, url, media } ] }, ROC: {...} },
  storylines: { "<storyline_id>": { label, title, first_seen, series: { "<periodKey>": index },
                                    sum24h: { "<periodKey>": cumul } } } }
```

Le cumul 24 h se calcule au build (même formule que `salienceCutover.ts` : Σ 2^(−âge/10) · indice ÷ 3,347, bloc absent = 0) et s'écrit dans le JSON pour que le frontend n'ait pas à rejouer la pondération. Les seuils sont **copiés** des constantes Vitrine dans `build_events.R` (source de vérité unique, à mettre à jour lors des recalibrations).

**Coût** : `fetch_data.py` +15 lignes ; nouveau `pipeline/build_events.R` (~150–200 lignes : filtres, recomposition spec v1, cumul, JSON) ; `refresh-constellation.yml` +1 fichier dans le `git add`. ≈ ½ à 1 journée, y compris un contrôle de concordance avec `headline-events.json` de Vitrine sur 3 jours.

## (1) Page d'accueil : les événements saillants du moment

**Option A — « À la Une » au-dessus du Hot 20 (recommandée).** Une section `#unes-saillantes` avant `#hot20` : le héros en grand (titre LLM, lead `text`, bande de saillance, « N médias sur 6 », liste des médias) et, à droite ou dessous, 0 à 2 cartes secondaires (règle : ≥ Modérée sur le cumul 24 h). Sélecteur QC / Canada partagé avec le Hot 20 (`currentCountry`). Sous la section, une ligne : « Les objets du Hot 20 ci-dessous et ces événements sont classés par le **même indice de saillance** ». Coût ≈ 1 journée (HTML/CSS + ~150 lignes JS, lecture d'`events.json`, i18n FR/EN).

**Option B — onglet « Événements | Objets » dans le Hot 20.** Moins de hauteur de page, mais le message « même indice » est moins visible et on perd la hiérarchie héros/secondaires. Coût ≈ ½ journée.

**Option C — nombre fixe (top 3).** Plus simple, mais la mesure montre que le 3e est sous Modérée dans 75 % des fenêtres au Québec : on afficherait souvent une Une qui n'en est pas une. Déconseillé.

Dans tous les cas, le bloc « en direct » suit la logique de journée partielle déjà présente (dernier bloc complété, `computeNextUpdate()`).

## (2) Page de suivi longitudinal des événements

`evolution.html` est un monolithe de ~2 940 lignes de JS inline, étroitement couplé à la forme `graphs[country][period].nodes`. Deux voies :

**Option A — nouvelle page `evenements.html` légère (recommandée).** Reprend le *gabarit* d'`evolution.html` (menu partagé, onglets Hot N / Recherche, boutons de période, barre temporelle avec heatmap, journée partielle) mais branche sur `events.json` : en mode **Hot N**, les N storylines de plus fort cumul sur la période (N = 3 jour / 5 semaine / 8 mois, cohérent avec la mesure) avec leur courbe d'indice par bloc ; en mode **Recherche**, une storyline (ou un mot du titre) suivie dans le temps, avec ses médias par bloc. La heatmap de convergence réutilise `interval_convergence_score` (déjà dans la table) au lieu de la recalculer. Coût ≈ 2–3 journées ; on extrait au passage dans `site/assets/js/` les fonctions de barre temporelle et de journée partielle pour qu'`evolution.html` et `evenements.html` les partagent (refactor optionnel, +1 journée, évite deux copies divergentes).

**Option B — mode « Événements » dans `evolution.html`.** Moins de pages, mais ajoute un 3e mode à un fichier déjà lourd, avec un modèle de données différent (storyline ≠ objet, cumul ≠ somme). Coût ≈ 2 journées, risque de régression sur la page existante.

Dans les deux cas, chaque événement renvoie vers ses objets (les `extracted_objects` de l'événement sont des nœuds du Hot 20 / de la constellation) : c'est le pont concret entre les deux vues.

## (3) Rappeler partout que c'est le même indice

- Une phrase unique, en i18n (`site/i18n/ui.fr.json` / `ui.en.json`), réutilisée : « Objets et événements sont classés par le même indice de saillance : les minutes passées en Une, article par article et média par média. Pour un événement, l'indice combine trois facettes — visibilité (combien de médias), intensité (combien d'articles par média) et durée (combien de temps en Une). » Affichée : sous la section « À la Une » de l'accueil, dans l'en-tête de `evenements.html`, dans l'infobulle de la bande de saillance (objet comme événement).
- `methodologie.html` : une sous-section « Un seul indice, deux niveaux de lecture » reprenant les § « L'indice de saillance », « Trois façons d'occuper l'espace médiatique » et « Niveaux de saillance affichés » de la Méthodologie Vitrine, avec les deux grilles (par bloc et cumul 24 h) et leur date de calibration. Source markdown dans `radarplus_textes/page_methodologie.md`, comme le reste.
- Tooltips conceptuels du ciel d'accueil (« Indices de saillance ») : ajouter l'événement comme second niveau.
- Coût ≈ ½ journée, à faire en même temps que (1).

## Ordre proposé et total

1. (4) données — sans quoi rien ne s'affiche : ½–1 j.
2. (1) option A + (3) : 1½ j.
3. (2) option A : 2–3 j (+1 j si refactor partagé).

Total ≈ 4–6 journées. Décisions attendues d'Adrien : règle d'affichage (héros + ≥ Modérée sur 24 h, ou autre ligne du tableau § 4) ; recomposition spec v1 dans le build ou attente du backfill ; option A ou B pour (1) et (2) ; lancer ou non le rejeu d'un mois à `TARGET_MIN_EVENTS = 10` (~0,50 $) pour lever la censure.
