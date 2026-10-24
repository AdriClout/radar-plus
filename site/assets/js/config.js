// Configuration du site RADAR+ — adresse publique des données générées.
//
// Les JSON produits par les workflows de rafraîchissement (graph, timeseries,
// articles, monitor_input, ticker) ne vivent plus dans le dépôt : ils sont
// écrits dans le bucket R2 « radar-plus-data » et servis à l'adresse ci-dessous.
// En local (python3 -m http.server), le site lit la même adresse : rien à
// télécharger. qualite.json et i18n/ restent servis avec le site.
(function () {
  var base = 'https://data.radarplus.org';
  window.RADAR_DATA_BASE = base;
  window.radarDataUrl = function (name) {
    return base.replace(/\/+$/, '') + '/' + String(name).replace(/^\/+/, '');
  };
})();
