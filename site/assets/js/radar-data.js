// RADAR+ — chargeur des données découpées (v2, chantier 7, #59).
//
// Les données vivent dans le bucket R2 (adresse dans config.js) sous la forme
// de petits fichiers : index.json, latest.json, periods/{AAAA}.json,
// days/{pays}/{date}.json, articles/{pays}/{date}.json, series/{pays}/{AAAA}.json,
// episodes/{pays}/{AAAA}.json. Ce module les charge à la demande, les garde en
// mémoire, et sait RECOMPOSER l'ancienne forme (timeseries / graph / articles)
// pour que les pages existantes migrent sans réécrire leur logique.
//
// API (toutes les fonctions renvoient des promesses) :
//   radarData.index()                     → index.json
//   radarData.latest()                    → latest.json (dernière période par pays)
//   radarData.periods()                   → liste de toutes les périodes de la fenêtre
//   radarData.day(country, date)          → days/{country}/{date}.json
//   radarData.articlesDay(country, date)  → articles/{country}/{date}.json
//   radarData.series(country, year)       → series/{country}/{year}.json
//   radarData.episodes(country, year)     → episodes/{country}/{year}.json
//   radarData.timeseries()                → { meta, graphs } comme l'ancien timeseries.json
//   radarData.graph()                     → { meta, graphs } comme l'ancien graph.json (fenêtre liens)
//   radarData.articles(country, periodKeys) → { periodKey: { objet: [articles] } } pour ces périodes
//   radarData.latestAsGraph()             → { meta, graphs } réduit à la dernière période (menu, badges)
//   radarData.eventsStorylines(région, année) → fiches d'événements de l'année (version allégée recomposée)
(function () {
  'use strict';

  var base = (window.RADAR_DATA_BASE || '').replace(/\/+$/, '') + '/v2';
  var cache = Object.create(null);
  var LEVELS = ['none', 'eleve', 'tres_eleve', 'extreme'];

  function fetchJson(path, opts) {
    var key = path;
    if (!cache[key]) {
      var url = base + '/' + path.replace(/^\/+/, '');
      if (opts && opts.bust) url += (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
      cache[key] = fetch(url, { cache: opts && opts.noStore ? 'no-store' : 'default' })
        .then(function (r) {
          if (!r.ok) throw new Error('radar-data : ' + path + ' → HTTP ' + r.status);
          return r.json();
        })
        .catch(function (err) { delete cache[key]; throw err; });
    }
    return cache[key];
  }

  function index() { return fetchJson('index.json', { noStore: true, bust: true }); }
  function latest() { return fetchJson('latest.json', { noStore: true, bust: true }); }
  function day(country, date) { return fetchJson('days/' + country + '/' + date + '.json'); }
  function articlesDay(country, date) { return fetchJson('articles/' + country + '/' + date + '.json'); }
  function series(country, year) { return fetchJson('series/' + country + '/' + year + '.json'); }
  function episodes(country, year) { return fetchJson('episodes/' + country + '/' + year + '.json'); }

  function periods() {
    return index().then(function (idx) {
      return Promise.all(idx.years.map(function (y) { return fetchJson('periods/' + y + '.json'); }))
        .then(function (parts) {
          var out = [];
          parts.forEach(function (p) { out = out.concat(p.periods); });
          return out;
        });
    });
  }

  // Index des épisodes par objet, pour retrouver les champs alert_* d'un nœud.
  function episodeIndex(epsFile) {
    var byObject = Object.create(null);
    var ctxByObject = Object.create(null);
    (epsFile.episodes || []).forEach(function (e) {
      (byObject[e.object] = byObject[e.object] || []).push(e);
    });
    (epsFile.context || []).forEach(function (c) {
      (ctxByObject[c.object] = ctxByObject[c.object] || []).push(c);
    });
    return { byObject: byObject, ctxByObject: ctxByObject };
  }

  function alertFieldsFor(epIdx, objectId, date) {
    var eps = epIdx.byObject[objectId] || [];
    var hit = null;
    for (var i = 0; i < eps.length; i++) {
      if (date >= eps[i].first_day && date <= eps[i].last_day) { hit = eps[i]; break; }
    }
    if (hit) {
      return {
        alert_level: hit.level,
        alert_active: hit.level !== 'none',
        alert_episode_id: hit.id,
        alert_episode_first_day: hit.first_day,
        alert_episode_last_day: hit.last_day,
        alert_episode_n_days: hit.n_days,
        alert_episode_peak: hit.peak,
        alert_episode_status: hit.status,
        alert_cluster_id: hit.cluster_id || null,
        alert_cluster_pivot: !!hit.cluster_pivot,
        alert_cluster_size: hit.cluster_size || null,
        alert_cluster_context: false
      };
    }
    var ctx = epIdx.ctxByObject[objectId] || [];
    for (var j = 0; j < ctx.length; j++) {
      if (date >= ctx[j].start && date <= ctx[j].end) {
        return {
          alert_level: 'none', alert_active: false,
          alert_episode_id: null, alert_episode_first_day: null, alert_episode_last_day: null,
          alert_episode_n_days: null, alert_episode_peak: null, alert_episode_status: null,
          alert_cluster_id: ctx[j].cluster_id, alert_cluster_pivot: false,
          alert_cluster_size: null, alert_cluster_context: true
        };
      }
    }
    return {
      alert_level: 'none', alert_active: false,
      alert_episode_id: null, alert_episode_first_day: null, alert_episode_last_day: null,
      alert_episode_n_days: null, alert_episode_peak: null, alert_episode_status: null,
      alert_cluster_id: null, alert_cluster_pivot: false, alert_cluster_size: null,
      alert_cluster_context: false
    };
  }

  function metaFrom(idx, periodList, mode) {
    return {
      generated_at: idx.generated_at,
      mode: mode,
      history_days: idx.history_days,
      graph_days: idx.graph_days,
      top_n: idx.top_n,
      alert_thresholds: idx.alert_thresholds,
      salience_tiers: idx.salience_tiers,
      index: idx.index,
      media_ids: idx.media_ids,
      periods: periodList,
      countries: idx.countries
    };
  }

  // Ancien timeseries.json : nœuds (sans articles) pour toutes les périodes.
  function timeseries() {
    if (cache.__timeseries) return cache.__timeseries;
    cache.__timeseries = index().then(function (idx) {
      return periods().then(function (periodList) {
        var graphs = {};
        return Promise.all(idx.countries.map(function (country) {
          graphs[country] = {};
          periodList.forEach(function (p) { graphs[country][p.key] = { nodes: [], links: [] }; });
          return Promise.all(idx.years.map(function (year) {
            return Promise.all([series(country, year), episodes(country, year)]).then(function (res) {
              var ser = res[0], epIdx = episodeIndex(res[1]);
              Object.keys(ser.objects).forEach(function (id) {
                ser.objects[id].forEach(function (pt) {
                  var key = ser.periods[pt[0]];
                  if (!graphs[country][key]) return;
                  var date = key.slice(0, 10);
                  var node = { id: id, size: pt[1], n: pt[2] };
                  var af = alertFieldsFor(epIdx, id, date);
                  // Le niveau du bloc vient de la série (il peut différer de l'épisode : none hors épisode).
                  af.alert_level = LEVELS[pt[3]] || 'none';
                  af.alert_active = af.alert_level !== 'none';
                  for (var k in af) node[k] = af[k];
                  graphs[country][key].nodes.push(node);
                });
              });
              Object.keys(graphs[country]).forEach(function (key) {
                graphs[country][key].nodes.sort(function (a, b) { return b.size - a.size; });
              });
            });
          }));
        })).then(function () {
          return { meta: metaFrom(idx, periodList, 'timeseries'), graphs: graphs };
        });
      });
    });
    return cache.__timeseries;
  }

  // Jours de la fenêtre « graph » (liens + événements), les plus récents.
  function graphDates(idx, country) {
    var dates = idx.dates[country] || [];
    return dates.slice(Math.max(0, dates.length - (idx.graph_days || 14)));
  }

  // Ancien graph.json : nœuds avec articles + media_ids, liens, événements, fenêtre graph.
  function graph() {
    if (cache.__graph) return cache.__graph;
    cache.__graph = index().then(function (idx) {
      var graphs = {};
      var periodSet = {};
      return Promise.all(idx.countries.map(function (country) {
        graphs[country] = {};
        return Promise.all(graphDates(idx, country).map(function (date) {
          return Promise.all([day(country, date), articlesDay(country, date)]).then(function (res) {
            var d = res[0], a = res[1];
            Object.keys(d.periods).forEach(function (key) {
              var per = d.periods[key];
              var arts = (a.periods && a.periods[key]) || {};
              periodSet[key] = true;
              graphs[country][key] = {
                nodes: per.nodes.map(function (n) {
                  var node = {};
                  for (var k in n) node[k] = n[k];
                  node.articles = arts[n.id] || [];
                  return node;
                }),
                links: per.links || [],
                events: per.events || []
              };
            });
          });
        }));
      })).then(function () {
        return periods().then(function (periodList) {
          var sub = periodList.filter(function (p) { return periodSet[p.key]; });
          return { meta: metaFrom(idx, sub, 'graph'), graphs: graphs };
        });
      });
    });
    return cache.__graph;
  }

  // Articles pour un pays et une liste de clés de période (charge les jours nécessaires).
  function articles(country, periodKeys) {
    var dates = {};
    (periodKeys || []).forEach(function (k) { dates[String(k).slice(0, 10)] = true; });
    var out = {};
    return Promise.all(Object.keys(dates).map(function (date) {
      return articlesDay(country, date).then(function (a) {
        Object.keys(a.periods || {}).forEach(function (key) { out[key] = a.periods[key]; });
      }).catch(function () { /* jour absent : pas d'articles */ });
    })).then(function () { return out; });
  }

  // latest.json dans la forme graph.json réduite à la dernière période (menu d'alertes, badges).
  function latestAsGraph() {
    return Promise.all([index(), latest()]).then(function (res) {
      var idx = res[0], lt = res[1];
      var graphs = {}, periodList = [];
      Object.keys(lt.by_country).forEach(function (country) {
        var c = lt.by_country[country];
        graphs[country] = {};
        graphs[country][c.period.key] = { nodes: c.nodes, links: c.links || [], events: c.events || [] };
        if (!periodList.some(function (p) { return p.key === c.period.key; })) periodList.push(c.period);
      });
      periodList.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
      return { meta: metaFrom(idx, periodList, 'latest'), graphs: graphs };
    });
  }

  // Magasin d'articles progressif, dans l'ancienne forme de articles.json
  // ({ articles: { pays: { clé_de_période: { objet: [articles] } } } }) : les pages
  // gardent leur getArticlesFor(...) tel quel, et appellent ensure(...) avant de
  // rendre ce qui dépend des articles (compteurs, panneau, « Précédemment »).
  function articleStore() {
    var data = { articles: {} };
    var loadedDays = Object.create(null); // "pays|date" → true
    var pending = Object.create(null);    // "pays|date" → promesse

    function datesOf(periodKeys) {
      var out = Object.create(null);
      (periodKeys || []).forEach(function (k) { if (k) out[String(k).slice(0, 10)] = true; });
      return Object.keys(out);
    }
    function has(country, periodKeys) {
      return datesOf(periodKeys).every(function (d) { return loadedDays[country + '|' + d]; });
    }
    function ensure(country, periodKeys) {
      data.articles[country] = data.articles[country] || {};
      return Promise.all(datesOf(periodKeys).map(function (date) {
        var id = country + '|' + date;
        if (loadedDays[id]) return Promise.resolve();
        if (!pending[id]) {
          pending[id] = articlesDay(country, date).then(function (a) {
            Object.keys(a.periods || {}).forEach(function (key) { data.articles[country][key] = a.periods[key]; });
          }).catch(function () { /* jour absent : aucun article */ })
            .then(function () { loadedDays[id] = true; delete pending[id]; });
        }
        return pending[id];
      })).then(function () { return data; });
    }
    // Clés des `nBack` périodes qui précèdent l'index `idx` dans `periodList` (plus la période elle-même).
    function keysBefore(periodList, idx, nBack) {
      var out = [];
      for (var i = Math.max(0, idx - nBack); i <= idx && i < periodList.length; i++) out.push(periodList[i].key);
      return out;
    }
    return { data: data, has: has, ensure: ensure, keysBefore: keysBefore };
  }

  // Événements saillants (chantier 2, #49) : v2/events/…
  function eventsIndex() { return fetchJson('events/index.json', { noStore: true, bust: true }); }
  function eventsLatest() { return fetchJson('events/latest.json', { noStore: true, bust: true }); }
  function eventsDay(region, date) { return fetchJson('events/' + region + '/' + date + '.json'); }
  // Fiches d'événements de l'année : version allégée (events/storylines-light/, ~2 fois plus
  // légère, pipeline/build_storylines_light.py) recomposée ici dans la forme du fichier complet,
  // aux mêmes chiffres. Repli sur le fichier complet si la version allégée manque.
  var storyCache = Object.create(null);
  function eventsStorylines(region, year) {
    var key = region + '/' + year;
    if (!storyCache[key]) {
      storyCache[key] = fetchJson('events/storylines-light/' + key + '.json')
        .then(decodeStorylinesLight)
        .catch(function () { return fetchJson('events/storylines/' + key + '.json'); })
        .catch(function (err) { delete storyCache[key]; throw err; });
    }
    return storyCache[key];
  }
  // Miroir exact de decode() dans pipeline/build_storylines_light.py.
  function storyDerived(series) {
    var ks = Object.keys(series).sort();
    if (!ks.length) return {};
    var pk = ks[0];
    for (var i = 1; i < ks.length; i++) if (series[ks[i]] > series[pk]) pk = ks[i];
    return { first_key: ks[0], last_key: ks[ks.length - 1], peak_key: pk, peak: series[pk], n_blocks: ks.length };
  }
  function decodeStorylinesLight(light) {
    if (!light || light.format !== 'storylines-light-1') throw new Error('radar-data : format allégé inconnu');
    // Boucles simples : ~6 700 fiches par fichier, la recomposition doit rester sous ~0,1 s.
    var P = light.periods, I = light.issues, S = light.storylines, out = {};
    var FILL = ['title_last', 'title_peak'], DER = ['first_key', 'last_key', 'peak_key', 'peak', 'n_blocks'];
    for (var sid in S) {
      var e = S[sid], s = {}, absent = {}, k, i, v;
      if (e._absent) for (i = 0; i < e._absent.length; i++) absent[e._absent[i]] = true;
      for (k in e) {
        v = e[k];
        if (k === 'series' || k === 'sum24h') {
          var m = {};
          for (var a = 0; a < v.length; a++) { var r = v[a], st = r[0] - 1; for (var j = 1; j < r.length; j++) m[P[st + j]] = r[j]; }
          s[k] = m;
        } else if ((k === 'first_key' || k === 'last_key' || k === 'peak_key') && typeof v === 'number') s[k] = P[v];
        else if (k === 'issue') { s.issue_fr = I[v][0]; s.issue_en = I[v][1]; }
        else if (k !== '_absent') s[k] = v;
      }
      if ('title' in s) for (i = 0; i < FILL.length; i++) if (!(FILL[i] in s) && !absent[FILL[i]]) s[FILL[i]] = s.title;
      if (s.series && typeof s.series === 'object') {
        var d = null;
        for (i = 0; i < DER.length; i++) if (!(DER[i] in s) && !absent[DER[i]]) { d = d || storyDerived(s.series); if (DER[i] in d) s[DER[i]] = d[DER[i]]; }
      }
      out[sid] = s;
    }
    return { region: light.region, year: light.year, storylines: out };
  }

  // Lieux du Canada écartés des palmarès d'objets (Hot 10, Hot 20, Classement), au Québec comme dans le
  // reste du Canada : le pays, ses provinces et territoires et ses plus grandes villes situent la
  // nouvelle sans en être l'objet. MÊME LISTE que l'article scientifique de Radar+ (36 noms ;
  // doctorat/4_these/code/fig_a2_objets_annee.R) : la changer ici, c'est la changer là-bas, et dans
  // methodologie.html (§ 5, « Objets écartés des classements »). Les données gardent ces objets :
  // on les trouve encore par la recherche d'Évolution et sur leur fiche (Adrien, 17 nov. 2026).
  // Pas de liste pour les États-Unis : le pipeline y retire déjà « united states ».
  var LIEUX_CANADA = ['canada', 'quebec', 'ontario', 'british columbia', 'alberta', 'saskatchewan', 'manitoba',
    'new brunswick', 'nova scotia', 'prince edward island', 'newfoundland and labrador', 'newfoundland', 'labrador',
    'yukon', 'northwest territories', 'nunavut',
    'montreal', 'ottawa', 'toronto', 'vancouver', 'calgary', 'edmonton', 'winnipeg', 'quebec city', 'laval', 'halifax',
    'victoria', 'regina', 'saskatoon', 'longueuil', 'gatineau', 'sherbrooke', 'mississauga', 'surrey', 'hamilton', 'brampton'];
  var CADRE = { QC: LIEUX_CANADA, CAN: LIEUX_CANADA };
  var cadreSet = {};
  Object.keys(CADRE).forEach(function (c) { cadreSet[c] = {}; CADRE[c].forEach(function (x) { cadreSet[c][x] = true; }); });
  // Comparaison sans majuscules ni accents : « Québec » et « montréal » sont écartés comme « quebec » et « montreal ».
  function estCadre(country, id) {
    var set = cadreSet[country]; if (!set || id == null) return false;
    var k = String(id).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return set[k] === true;
  }
  // Copie de { meta, graphs } sans les objets de cadre (ni leurs liens) : pour les pages qui ne montrent que des palmarès.
  function sansCadre(d) {
    if (!d || !d.graphs) return d;
    var graphs = {};
    Object.keys(d.graphs).forEach(function (country) {
      var src = d.graphs[country] || {}, out = graphs[country] = {};
      if (!cadreSet[country]) { Object.keys(src).forEach(function (k) { out[k] = src[k]; }); return; }
      var idOf = function (x) { return (x && x.id) || x; };
      Object.keys(src).forEach(function (k) {
        var g = src[k] || {}, copy = {};
        for (var f in g) copy[f] = g[f];
        copy.nodes = (g.nodes || []).filter(function (n) { return !estCadre(country, n.id); });
        if (g.links) copy.links = g.links.filter(function (l) { return !estCadre(country, idOf(l.source)) && !estCadre(country, idOf(l.target)); });
        out[k] = copy;
      });
    });
    var res = {}; for (var f2 in d) res[f2] = d[f2];
    res.graphs = graphs;
    return res;
  }

  // Taille d'un événement : les cinq tranches de points de l'article scientifique de Radar+ (« lire les points »),
  // appliquées au TOTAL de points d'un événement (somme de ses notes d'édition), jamais à la note d'une édition
  // (qui a ses niveaux, calés sur l'année de référence). Bornes 50, 100, 500 et 1 000 : chiffres ronds, choisis
  // pour se lire. Part des événements et événement médian de chaque tranche (médias à la fois, jours, heures en
  // tête) : année de référence, 16 oct. 2025 → 15 oct. 2026, par région (CAN = Canada hors Québec).
  // Source : doctorat/4_these/index/data/tabledata_a2_lecture_points.csv (code/tab_a2_lecture_points.R), relu le
  // 17 nov. 2026 ; les totaux publiés par le site redonnent ces tranches (QC : 5 152 / 1 435 / 889 / 60 / 20).
  // Seul nom propre : « événement majeur » (1 000 points et plus), celui de l'article. Méthodologie § 5.5.
  var TRANCHES = [
    { id: 'lt50', min: 0,    fr: 'Moins de 50 points',  en: 'Fewer than 50 points', QC: [68.2, 1, 1, 1.5],  CAN: [66.5, 1, 1, 1.8] },
    { id: 't50',  min: 50,   fr: '50 à 99 points',      en: '50 to 99 points',      QC: [19, 1, 2, 5.7],    CAN: [18.6, 1, 2, 7.5] },
    { id: 't100', min: 100,  fr: '100 à 499 points',    en: '100 to 499 points',    QC: [11.8, 3, 2, 12],   CAN: [13.6, 2, 2, 16] },
    { id: 't500', min: 500,  fr: '500 à 999 points',    en: '500 to 999 points',    QC: [0.8, 4, 5, 41],    CAN: [1.1, 5, 5, 51] },
    { id: 'majeur', min: 1000, fr: 'Événement majeur : 1 000 points et plus', en: 'Major event: 1,000 points or more', QC: [0.3, 6, 8.5, 83], CAN: [0.3, 6, 8, 100] }
  ];
  // { id, label, tip } pour un total de points, une région (QC, CAN) et une langue ; null hors de ces régions.
  function tailleEvenement(points, region, lang) {
    var p = Number(points); if (!(p >= 0)) return null;
    var t = TRANCHES[0]; TRANCHES.forEach(function (x) { if (p >= x.min) t = x; });
    var v = t[region]; if (!v) return null;
    var en = String(lang || 'fr').slice(0, 2) === 'en';
    var n = function (x) { return en ? String(x) : String(x).replace('.', ','); };
    var tip = en
      ? v[0] + '% of the events of the reference year (Oct. 16, 2025 – Oct. 15, 2026) fall in this band. Its median event: ' +
        v[1] + (v[1] > 1 ? ' outlets' : ' outlet') + ' at once, ' + v[2] + (v[2] > 1 ? ' days' : ' day') + ' and ' + v[3] + ' hours in the lead position.'
      : n(v[0]) + ' % des événements de l\'année de référence (16 oct. 2025 – 15 oct. 2026) sont dans cette tranche. Son événement médian : ' +
        n(v[1]) + (v[1] > 1 ? ' médias' : ' média') + ' à la fois, ' + n(v[2]) + (v[2] > 1 ? ' jours' : ' jour') + ' et ' + n(v[3]) + ' heures en tête des pages d\'accueil.';
    // Version courte, pour une info-bulle de tableau
    var court = en
      ? (t.en + ' (' + v[0] + '% of events). Median event: ' + v[1] + (v[1] > 1 ? ' outlets' : ' outlet') + ' at once, ' + v[2] + (v[2] > 1 ? ' days' : ' day') + ', ' + v[3] + ' h in the lead.')
      : (t.fr + ' (' + n(v[0]) + ' % des événements). Événement médian : ' + n(v[1]) + (v[1] > 1 ? ' médias' : ' média') + ' à la fois, ' + n(v[2]) + (v[2] > 1 ? ' jours' : ' jour') + ', ' + n(v[3]) + ' h en tête.');
    return { id: t.id, label: en ? t.en : t.fr, tip: tip, court: court };
  }

  window.radarData = {
    base: base,
    tailleEvenement: tailleEvenement,
    estCadre: estCadre, sansCadre: sansCadre, lieuxCadre: CADRE,
    eventsIndex: eventsIndex, eventsLatest: eventsLatest, eventsDay: eventsDay, eventsStorylines: eventsStorylines, decodeStorylinesLight: decodeStorylinesLight,
    index: index, latest: latest, periods: periods,
    day: day, articlesDay: articlesDay, series: series, episodes: episodes,
    timeseries: timeseries, graph: graph, articles: articles, latestAsGraph: latestAsGraph,
    articleStore: articleStore
  };
})();
