// Configuration du site RADAR+ — adresse publique des données générées.
//
// Les JSON produits par les workflows de rafraîchissement (graph, timeseries,
// articles, monitor_input, ticker) ne vivent plus dans le dépôt : ils sont
// écrits dans le bucket R2 « radar-plus-data » et servis à l'adresse ci-dessous.
// En local (python3 -m http.server), le site lit la même adresse : rien à
// télécharger. qualite.json et i18n/ restent servis avec le site.
(function () {
  var base = 'https://data.radarplus.org';
  // Dev : ?data_base=http://localhost:8000/pipeline/out_r2 (mémorisé dans localStorage ;
  // ?data_base=reset pour revenir à l'adresse publique). En local seulement : sur le
  // site en ligne, un lien piégé pourrait sinon faire lire des données d'ailleurs.
  var local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if (local) try {
    var q = new URLSearchParams(window.location.search).get('data_base');
    if (q === 'reset') { localStorage.removeItem('RADAR_DATA_BASE'); }
    else if (q) { localStorage.setItem('RADAR_DATA_BASE', q); }
    var saved = localStorage.getItem('RADAR_DATA_BASE');
    if (saved) { base = saved; console.info('[radar] données lues depuis', base); }
  } catch (e) { /* stockage indisponible : adresse publique */ }
  window.RADAR_DATA_BASE = base;
  window.radarDataUrl = function (name) {
    return base.replace(/\/+$/, '') + '/' + String(name).replace(/^\/+/, '');
  };
})();

// Pas d'éclair de clés de traduction au chargement (Adrien, 1er nov. 2026 : « je vois pendant une
// seconde plein de code »). Les textes (i18n/ui.*.json) arrivent après le premier affichage ; d'ici
// là, les libellés écrits par les scripts valent leur clé (« hot20.header_rank »). config.js est lu
// dans le <head> de chaque page : la page reste masquée jusqu'à ce que i18n.js ait appliqué les
// textes, ou au plus 2,5 s (filet si le fichier ne vient pas). Pages sans i18n.js : affichées tout de suite.
(function () {
  var root = document.documentElement;
  root.classList.add('i18n-pending');
  var st = document.createElement('style');
  // Sans fondu : une transition reste figée dans un onglet ouvert en arrière-plan.
  st.textContent = 'html.i18n-pending{background:#00000f}html.i18n-pending body{opacity:0}';
  (document.head || root).appendChild(st);
  function show() { root.classList.remove('i18n-pending'); }
  window.radarShowPage = show;
  setTimeout(show, 2500);
  document.addEventListener('i18n:applied', show);
  document.addEventListener('DOMContentLoaded', function () { if (!window.__i18n) show(); });
})();

// Typographie des heures (règle Vitrine, Adrien 24 oct. 2026) : « 17h57 », « 24h »,
// jamais d'espace avant le h. À appliquer aux sorties des formateurs de date.
window.radarTypo = function (s) {
  return String(s == null ? '' : s)
    .replace(/(\d{1,2})\s*h\s*(\d{2})/g, '$1h$2')
    .replace(/(\d{1,2})\s+h\b/g, '$1h');
};
