# Langage visuel RADAR+

Source de vérité du design system. Les valeurs vivent dans
[`site/assets/css/tokens.css`](site/assets/css/tokens.css), chargé sur toutes
les pages **avant** leur `<style>` local. Modèle : le `design_language.md` de
La Vitrine démocratique — la discipline, pas le style (les deux identités
restent volontairement distinctes : la Vitrine est un journal papier, RADAR+
est un **observatoire nocturne**).

## L'identité en cinq phrases

RADAR+ se lit comme la salle de contrôle d'un observatoire : fond bleu-noir
profond (`#020010`), ciel étoilé discret, cartes translucides bordées d'un
filet bleu. La hiérarchie est portée par deux polices à rôle strict —
**Orbitron** pour les titres et labels d'interface (toujours en capitales,
espacées), **Space Mono** pour le corps et les données. Un seul accent
chromatique, le **bleu radar `#5588ff`**, porte tout ce qui est actif ou
navigable. Les couleurs chaudes sont réservées à la **sémantique de
saillance** : jaune « élevé », orange « très élevé », rouge « extrême » —
jamais décoratives. Rien ne bouge sans raison : les seules animations sont
le ciel, le balayage radar et le ticker, tous soumis à
`prefers-reduced-motion`.

## Les deux vocabulaires de niveau (ne pas les mélanger)

| Vocabulaire | Valeurs | Où |
|---|---|---|
| **Alertes objets** (masculin) | `eleve`, `tres_eleve`, `extreme` | pipeline `graph.json`, badges, bandeau global — classes `.level-eleve`… |
| **Bandes événements** (féminin) | `faible`, `moderee`, `elevee`, `tres_elevee`, `extreme` | `events.json`, seuils Vitrine — classes `.band-moderee`… |

Les tokens `--eleve/--tres-eleve/--extreme` (+ variantes `-d` sombres) et
`--band-*` couvrent les deux. Le mapping événements→badge est
`EVENT_BAND_TO_ALERT` (index.html, evolution.html).

## Règles

1. **Aucune couleur hors palette.** Un nouveau besoin = un nouveau token
   dans `tokens.css`, discuté, jamais une valeur en dur.
2. **`--border` est le nom canonique** de la bordure (l'alias `--line`
   existe pour la migration ; ne plus l'utiliser dans du code neuf).
3. **Un `<h1>` par page**, portant le nom de la page ; les labels Orbitron
   uppercase gardent un `letter-spacing` ≥ 1px.
4. **`--muted` vaut 0.75 d'opacité minimum** — 0.6 échouait le contraste
   AA sur `#020010` (audit du 2026-08-30).
5. **Breakpoints canoniques : 480 / 768 / 980 px.** Les 14 valeurs
   historiques se replient dessus à mesure des retouches.
6. **Tout mouvement respecte `prefers-reduced-motion`** — le kill-switch
   CSS est global (tokens.css) ; les boucles canvas doivent vérifier
   `matchMedia('(prefers-reduced-motion: reduce)')` elles-mêmes.
7. **Titres de pages : `Page · RADAR+`** ; la marque s'écrit RADAR+ dans
   l'interface, Radar+ dans la prose.

## État de la migration des `:root` locaux

- **Migrées** (le `:root` local est supprimé, tokens.css fait foi) :
  `index.html`, `alertes.html`, `unes.html`, `presentation.html`.
- **À migrer** (famille « noir » `#00000f`, variable `--line`) :
  `methodologie.html`, `radarplus.html`, `sonar.html`, `statistiques.html`,
  `acces-donnees.html`, `partenaires.html`, `monitoring.html` (famille
  « slate » à part).
- **Sans variables** (couleurs en dur à tokeniser à l'occasion) :
  `evolution.html`, `constellation.html`.

## Ce qu'il ne faut pas faire

- Pas de mode clair : le site est nocturne par identité.
- Pas d'ombres portées ni de dégradés décoratifs — la lumière vient des
  glows d'accent (`--accent-glow`), avec parcimonie.
- Pas de rouge/orange/jaune hors sémantique de saillance.
- Pas de nouvelle famille de police.
- Pas de « Hot 20 » pour désigner le Classement vivant de l'accueil — ce
  nom est réservé aux archives officielles figées (page à venir).
