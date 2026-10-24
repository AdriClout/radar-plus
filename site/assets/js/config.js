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
  // ?data_base=reset pour revenir à l'adresse publique).
  try {
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

// Typographie des heures (règle Vitrine, Adrien 24 oct. 2026) : « 17h57 », « 24h »,
// jamais d'espace avant le h. À appliquer aux sorties des formateurs de date.
window.radarTypo = function (s) {
  return String(s == null ? '' : s)
    .replace(/(\d{1,2})\s*h\s*(\d{2})/g, '$1h$2')
    .replace(/(\d{1,2})\s+h\b/g, '$1h');
};
