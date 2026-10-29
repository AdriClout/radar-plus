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
  function eventsStorylines(region, year) { return fetchJson('events/storylines/' + region + '/' + year + '.json'); }

  window.radarData = {
    base: base,
    eventsIndex: eventsIndex, eventsLatest: eventsLatest, eventsDay: eventsDay, eventsStorylines: eventsStorylines,
    index: index, latest: latest, periods: periods,
    day: day, articlesDay: articlesDay, series: series, episodes: episodes,
    timeseries: timeseries, graph: graph, articles: articles, latestAsGraph: latestAsGraph,
    articleStore: articleStore
  };
})();
