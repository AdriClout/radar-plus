/* La Une des Unes — classement des événements saillants, partagé par l'accueil
   (section #aune) et la page Classement (classement.html). Chargé après config.js,
   radar-data.js et i18n.js ; appeler RadarAune.init({...}) une fois le DOM prêt. */
(function() {
'use strict';
// ─── La Une des Unes (chantier 2, #49) ──────────────────────────────────────
// Sources : v2/events/latest.json (dernier bloc : manchettes, indice 24h courant),
// v2/events/index.json (seuils des bandes par région) et
// v2/events/storylines/{région}/{année}.json (indice et indice 24h par bloc de
// chaque histoire). Toutes les vues sont des classements, comme le Hot 20
// (décision d'Adrien, 31 oct. 2026 : plus de cartes). Fenêtres en heure de Montréal :
//   Dernières heures (défaut) = la mesure de la Vitrine : cumul 24h glissant avec
//   décroissance (sum24h / band24h de events/latest.json « current »), pour que la
//   Une n° 1 soit la même que celle de la Vitrine (et son illustration). Top 5 ;
//   la hauteur de chaque rang est proportionnelle à son indice 24h ; la colonne
//   « Variation 4h » = indice 24h courant moins celui de l'édition précédente (le
//   bloc de 4h d'avant) ; le mouvement = rang à cette même édition précédente.
//   Aujourd'hui (depuis minuit, top 5, décision d'Adrien du 31 oct.), Cette semaine
//   (depuis lundi 0h), Ce mois-ci, Cette année (top 10) = points cumulés par édition ;
//   classement = somme de l'indice des blocs de la fenêtre ; tag = bande du
//   meilleur bloc (seuils Vitrine) ; mouvement = rang dans la fenêtre précédente.
// L'illustration (events/art/<histoire>.webp, générée par la Vitrine pour SA Une)
// s'affiche dans le rang de l'histoire quand elle existe, jamais pour une autre.
// Pas d'événements pour les États-Unis (la table de la Vitrine ne couvre que QC
// et reste du Canada ; panel américain de 2 médias) : le bouton n'est pas offert,
// le message « aune.usa » reste en garde-fou. Le module garde la même hauteur
// quelle que soit la vue.
// Réglages par page (RadarAune.init) : l'accueil = 5 rangs proportionnels pour les vues
// courtes, 10 rangs serrés pour les longues ; la page Classement = 50 rangs serrés
// partout, avec un filtre de recherche.
var cfg = {
  sectionId: 'aune', gridId: 'aune-grid', subtitleId: 'aune-subtitle', footId: 'aune-foot',
  tabsId: 'aune-tabs', countriesId: 'aune-country-tabs', searchId: null, countId: null,
  limits: { '24h': 5, today: 5, week: 10, month: 10, year: 10 },
  proportionalMax: 5,   // au plus N rangs : hauteur proportionnelle, illustration au rang 1
  range: '24h', country: 'QC', // sélecteur propre au module, indépendant de celui du Hot 20
  loadLatest: true,     // le module charge lui-même events/latest.json
  subtitleKeys: 'aune.range_sub.' // préfixe i18n de la phrase sous le titre, par vue
};
var eventsLatestData = null;
var AUNE_LIMIT = cfg.limits;
var AUNE_BLOCK_MS = 4 * 3600e3;
var AUNE_HEIGHT = 600; // hauteur du module (--aune-h), pour calibrer la taille des rangs
var auneStore = { index: null, storylines: {}, loading: {} };
var AUNE_BANDS = ['faible', 'moderee', 'elevee', 'tres_elevee', 'extreme'];

function escapeHtml(str) { var d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; }
function mtlOffsetMs(d) {
  var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Montreal', timeZoneName: 'longOffset' }).formatToParts(d);
  var tz = (parts.find(function(x) { return x.type === 'timeZoneName'; }) || {}).value || 'GMT-05:00';
  var m = tz.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return -5 * 3600e3;
  return (m[1] === '-' ? -1 : 1) * ((+m[2]) * 3600e3 + (+(m[3] || 0)) * 60e3);
}
function mtlParts(d) {
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d);
  var o = {}; parts.forEach(function(x) { o[x.type] = x.value; });
  return { y: +o.year, m: +o.month, d: +o.day, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
}
function mtlMidnightUtc(y, m, d) {
  return Date.UTC(y, m - 1, d) - mtlOffsetMs(new Date(Date.UTC(y, m - 1, d, 12)));
}
function auneWindowStart(range) {
  var now = new Date(), p = mtlParts(now);
  if (range === '24h') return now.getTime() - 24 * 3600e3;
  if (range === 'today') return mtlMidnightUtc(p.y, p.m, p.d); // depuis minuit (Montréal)
  if (range === 'week') {
    var back = (p.wd + 6) % 7; // lundi = 0
    var q = mtlParts(new Date(mtlMidnightUtc(p.y, p.m, p.d) - back * 86400e3 + 12 * 3600e3));
    return mtlMidnightUtc(q.y, q.m, q.d);
  }
  if (range === 'month') return mtlMidnightUtc(p.y, p.m, 1);
  if (range === 'year') return mtlMidnightUtc(p.y, 1, 1);
  return 0;
}
// Fenêtre précédente de même nature (jour, semaine, mois, année) : [début, fin[ en ms UTC.
function aunePrevWindow(range) {
  var start = auneWindowStart(range), p = mtlParts(new Date(start + 12 * 3600e3));
  if (range === 'today') return [start - 86400e3, start];
  if (range === 'week') return [start - 7 * 86400e3, start];
  if (range === 'month') { var m = p.m === 1 ? 12 : p.m - 1, y = p.m === 1 ? p.y - 1 : p.y; return [mtlMidnightUtc(y, m, 1), start]; }
  if (range === 'year') return [mtlMidnightUtc(p.y - 1, 1, 1), start];
  return [0, start];
}
function periodStartUtc(key) { // 'AAAA-MM-JJ_HH-HH' (UTC)
  return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), parseInt(key.slice(11, 13), 10) || 0);
}
// Dernier bloc publié (clé 'AAAA-MM-JJ_HH-HH') et début, en ms UTC, de l'édition précédente.
function auneLatestKey(latest) { return latest && latest.period && latest.period.key ? latest.period.key : null; }
function aunePrevEditionStart(latest) { var k = auneLatestKey(latest); return k ? periodStartUtc(k) - AUNE_BLOCK_MS : null; }
function auneBand(region, value) {
  var th = auneStore.index && auneStore.index.thresholds && auneStore.index.thresholds[region] && auneStore.index.thresholds[region].block;
  if (!th) return 'aucune';
  var band = 'aucune';
  AUNE_BANDS.forEach(function(b) { if (typeof th[b] === 'number' && value >= th[b]) band = b; });
  return band;
}
var AUNE_FIRST_YEAR = 2026; // début du suivi des événements : 23 juillet 2026
function auneYears() {
  var y1 = new Date().getUTCFullYear();
  var out = []; for (var y = AUNE_FIRST_YEAR; y <= y1; y++) out.push(y); return out;
}
function auneIs24h(range) { return range === '24h'; }
function auneReady(region, range) {
  if (!auneStore.index) return false;
  if (!auneDayDates().every(function(d) { return !!auneStore.storylines['day:' + region + ':' + d]; })) return false;
  return auneYears().every(function(y) { return !!auneStore.storylines[region + '/' + y]; });
}
function auneDayDates() {
  var d = eventsLatestData && eventsLatestData.by_region && eventsLatestData.by_region.QC && eventsLatestData.by_region.QC.period
    ? eventsLatestData.by_region.QC.period.date : new Date().toISOString().slice(0, 10);
  var t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return [d, new Date(t - 86400e3).toISOString().slice(0, 10)];
}
function auneArticlesByStory(region) {
  var out = {}, since = Date.now() - 24 * 3600e3;
  auneDayDates().forEach(function(date) {
    var f = auneStore.storylines['day:' + region + ':' + date]; if (!f || !f.periods) return;
    Object.keys(f.periods).sort().reverse().forEach(function(key) {
      if (periodStartUtc(key) < since) return;
      (f.periods[key] || []).forEach(function(ev) {
        if (!ev || !ev.storyline) return;
        var o = out[ev.storyline] || (out[ev.storyline] = { articles: [], seen: {} });
        (ev.articles || []).forEach(function(a) {
          if (!a || !a.url || o.seen[a.media_id]) return; // un média par manchette, le plus récent
          o.seen[a.media_id] = true; o.articles.push(a);
        });
      });
    });
  });
  return out;
}
function auneLoad(region, range) {
  var jobs = [];
  auneDayDates().forEach(function(date) {
    var k = 'day:' + region + ':' + date;
    if (!auneStore.storylines[k] && !auneStore.loading[k]) {
      auneStore.loading[k] = window.radarData.eventsDay(region, date)
        .then(function(f) { auneStore.storylines[k] = f; })
        .catch(function() { auneStore.storylines[k] = { periods: {} }; });
    }
    if (auneStore.loading[k]) jobs.push(auneStore.loading[k]);
  });
  if (!auneStore.index) {
    if (!auneStore.loading.index) auneStore.loading.index = window.radarData.eventsIndex().then(function(i) { auneStore.index = i; });
    jobs.push(auneStore.loading.index);
  }
  auneYears().forEach(function(y) {
    var k = region + '/' + y;
    if (!auneStore.storylines[k] && !auneStore.loading[k]) {
      auneStore.loading[k] = window.radarData.eventsStorylines(region, y)
        .then(function(f) { auneStore.storylines[k] = f; })
        .catch(function() { auneStore.storylines[k] = { storylines: {} }; });
    }
    if (auneStore.loading[k]) jobs.push(auneStore.loading[k]);
  });
  return Promise.all(jobs);
}
function auneStoryline(region, sid) {
  var ys = auneYears();
  for (var i = 0; i < ys.length; i++) {
    var f = auneStore.storylines[region + '/' + ys[i]];
    if (f && f.storylines && f.storylines[sid]) return f.storylines[sid];
  }
  return null;
}
// Trois mesures, chacune à sa place (voir le commentaire de tête) :
//   total = somme de tous les blocs de l'histoire depuis sa première Une ;
//   gain  = somme des blocs dans la fenêtre choisie ;
//   peak  = meilleur bloc de 4h dans la fenêtre (indice du moment le plus fort).
function auneSums(region, range) {
  var start = auneWindowStart(range), now = Date.now(), out = {};
  auneYears().forEach(function(y) {
    var f = auneStore.storylines[region + '/' + y]; if (!f || !f.storylines) return;
    Object.keys(f.storylines).forEach(function(sid) {
      var series = f.storylines[sid].series || {};
      var o = out[sid] || (out[sid] = { total: 0, gain: 0, peak: 0, peakKey: null });
      Object.keys(series).forEach(function(key) {
        var v = Number(series[key]) || 0; o.total += v;
        var t = periodStartUtc(key); if (t < start || t > now) return;
        o.gain += v; if (v > o.peak) { o.peak = v; o.peakKey = key; }
      });
    });
  });
  return out;
}
// Indice 24h de chaque histoire à l'édition précédente (bloc de 4h avant le dernier),
// lu dans les fiches : sert au mouvement ET à la colonne « Variation 4h ».
function aunePrevEdition24h(region, latest) {
  var prevT = aunePrevEditionStart(latest), out = {};
  if (prevT === null) return out;
  auneYears().forEach(function(y) {
    var f = auneStore.storylines[region + '/' + y]; if (!f || !f.storylines) return;
    Object.keys(f.storylines).forEach(function(sid) {
      var cum = f.storylines[sid].sum24h || {};
      Object.keys(cum).forEach(function(k) {
        if (periodStartUtc(k) === prevT) out[sid] = Number(cum[k]) || 0;
      });
    });
  });
  return out;
}
// Rang de chaque histoire dans la période précédente (même mesure que la vue) :
// l'édition précédente pour Dernières heures, la fenêtre précédente sinon.
function aunePrevRanks(region, range, latest) {
  var ranks = {}, list = [];
  if (auneIs24h(range)) {
    var prev = aunePrevEdition24h(region, latest);
    list = Object.keys(prev).map(function(sid) { return { storyline: sid, points: prev[sid] }; });
  } else {
    list = auneRanking(region, range, 1e9, aunePrevWindow(range)).map(function(it) { return { storyline: it.storyline, points: it.points }; });
  }
  list.sort(function(a, b) { return b.points - a.points; });
  list.forEach(function(it, i) { ranks[it.storyline] = i + 1; });
  return ranks;
}
function auneFirstKey(region, sid) { var st = auneStoryline(region, sid); return st ? (st.first_key || null) : null; }
function auneTrendHtml(c, i, region, range, prevRanks, prevStart, T) {
  var now = i + 1, prev = prevRanks[c.storyline], limit = AUNE_LIMIT[range] || 10;
  var sfx = auneIs24h(range) ? '_24h' : ''; // libellés « édition précédente » plutôt que « période précédente »
  if (prev && prev <= limit) {
    var diff = prev - now;
    if (diff > 0) return '<span class="hot20-trend hot20-hint up" data-tip="' + escapeHtml(T('aune.trend_up_tip' + sfx, { n: diff, prev: prev, now: now })) + '">&#9650;' + diff + '</span>';
    if (diff < 0) return '<span class="hot20-trend hot20-hint down" data-tip="' + escapeHtml(T('aune.trend_down_tip' + sfx, { n: -diff, prev: prev, now: now })) + '">&#9660;' + (-diff) + '</span>';
    return '<span class="hot20-trend hot20-hint stable" data-tip="' + escapeHtml(T('aune.trend_stable_tip' + sfx, { now: now })) + '">&mdash;</span>';
  }
  // Absente du classement précédent : « Retour » si l'histoire existait déjà avant la période précédente, sinon « Nouveau ».
  var fk = auneFirstKey(region, c.storyline);
  if (fk && prevStart !== null && periodStartUtc(fk) < prevStart) {
    return '<span class="hot20-trend hot20-hint comeback" data-tip="' + escapeHtml(T('aune.trend_return_tip' + sfx)) + '">&#128260; ' + escapeHtml(T('homepage.trend_return_label')) + '</span>';
  }
  return '<span class="hot20-trend hot20-hint new" data-tip="' + escapeHtml(T('aune.trend_new_tip' + sfx)) + '">&#128293; ' + escapeHtml(T('homepage.trend_new_label')) + '</span>';
}
// Variation 4h (vue Dernières heures) : indice 24h courant moins celui de l'édition
// précédente, affichée à côté de l'indice comme la hausse du Hot 20.
function auneDeltaHtml(c, T) {
  var prev = typeof c.prev24h === 'number' ? c.prev24h : 0, d = c.points - prev;
  var cls = d >= 0.05 ? 'up' : d <= -0.05 ? 'down' : 'stable';
  var txt = cls === 'stable' ? '0.0' : (d > 0 ? '+' : '&minus;') + Math.abs(d).toFixed(1);
  var tip = T('aune.delta_tip', { prev: prev.toFixed(1), now: c.points.toFixed(1) });
  return '<span class="inc ' + cls + ' hot20-hint" data-tip="' + escapeHtml(tip) + '">' + txt + '</span>';
}
function auneRanking24h(latest, limit) {
  var cur = (latest && latest.current) || [];
  return cur.slice().sort(function(a, b) { return (b.sum24h || 0) - (a.sum24h || 0); }).slice(0, limit).map(function(c) {
    return { storyline: c.storyline, title: c.title || '', issue_fr: c.issue_fr, issue_en: c.issue_en, url: c.url, media: c.media,
             points: Number(c.sum24h) || 0, blocks: c.n_blocks || 0, band: c.band24h || 'aucune', lastKey: c.last_key, first_key: c.first_key, is24h: true };
  });
}
function auneRanking(region, range, limit, win) {
  var start = win ? win[0] : auneWindowStart(range), now = win ? win[1] : Date.now(), acc = {};
  auneYears().forEach(function(y) {
    var f = auneStore.storylines[region + '/' + y]; if (!f || !f.storylines) return;
    Object.keys(f.storylines).forEach(function(sid) {
      var st = f.storylines[sid], series = st.series || {};
      var pts = 0, blocks = 0, peak = 0, lastKey = null;
      Object.keys(series).forEach(function(key) {
        var t = periodStartUtc(key); if (t < start || t >= now) return;
        var v = Number(series[key]) || 0;
        pts += v; blocks++; if (v > peak) peak = v; if (!lastKey || key > lastKey) lastKey = key;
      });
      if (!blocks) return;
      var cur = acc[sid];
      // Titre : celui du bloc du pic de l'histoire si ce pic est dans la fenêtre (cohérent
      // avec le tag « Pic »), sinon celui de la dernière apparition.
      var peakIn = st.peak_key && periodStartUtc(st.peak_key) >= start && periodStartUtc(st.peak_key) <= now;
      var ttl = (peakIn && st.title_peak) ? st.title_peak : (st.title_last || st.title || '');
      if (!cur) acc[sid] = { storyline: sid, title: ttl, titleFrom: peakIn && st.title_peak ? 'peak' : 'last', titleKey: peakIn ? st.peak_key : st.last_key,
                             issue_fr: st.issue_fr, issue_en: st.issue_en, url: st.url, media: st.media, points: pts, blocks: blocks, peak: peak, lastKey: lastKey };
      else { cur.points += pts; cur.blocks += blocks; if (peak > cur.peak) cur.peak = peak; }
    });
  });
  var list = Object.keys(acc).map(function(k) { return acc[k]; });
  list.sort(function(a, b) { return b.points - a.points; });
  return list.slice(0, limit);
}
function auneBlockLabel(key, lang) {
  var start = periodStartUtc(key), end = start + 4 * 3600e3;
  var loc = lang === 'en' ? 'en-CA' : 'fr-CA';
  var day = new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', day: 'numeric', month: 'short' }).format(new Date(start));
  var hour = function(t) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', hour: 'numeric', hour12: false }).format(new Date(t)).replace(/^24$/, '0') + 'h'; };
  return day + ' · ' + hour(start) + '–' + hour(end);
}
// Moment d'un bloc, en heure de Montréal et en court : « 11h » si c'est aujourd'hui,
// « jeu. 19h » dans les six derniers jours, « 27 oct. » avant.
function auneWhen(key, lang) {
  if (!key) return '';
  var t = periodStartUtc(key), d = new Date(t), now = new Date(), loc = lang === 'en' ? 'en-CA' : 'fr-CA';
  var hour = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', hour: 'numeric', hour12: false }).format(d).replace(/^24$/, '0').replace(/^0(\d)$/, '$1') + 'h';
  var a = mtlParts(d), b = mtlParts(now);
  if (a.y === b.y && a.m === b.m && a.d === b.d) return hour;
  if (now.getTime() - t < 6 * 86400e3) return new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', weekday: 'short' }).format(d) + ' ' + hour;
  return new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', day: 'numeric', month: 'short' }).format(d);
}
function auneNorm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function auneQuery() { var el = cfg.searchId ? document.getElementById(cfg.searchId) : null; return el ? auneNorm(el.value.trim()) : ''; }
function auneIssue(c, lang) { return lang === 'en' ? (c.issue_en || c.issue_fr) : (c.issue_fr || c.issue_en); }
function auneHeadlines(c, ev, max) {
  var arts = ev && Array.isArray(ev.articles) ? ev.articles.slice(0, max) : [];
  if (!arts.length && c.url) arts = [{ url: c.url, media_id: c.media || '', title: c.title }];
  return arts;
}
// Clic sur un titre ou une illustration : un média au hasard parmi ceux qui ont
// couvert l'histoire (comme la Vitrine et le bandeau d'alerte).
function auneUrls(c, ev) {
  var urls = (ev && Array.isArray(ev.articles) ? ev.articles : []).map(function(a) { return a && a.url; }).filter(Boolean);
  if (!urls.length && c.url) urls = [c.url];
  return urls;
}
function auneRandomAttr(urls, T) {
  if (!urls.length) return '';
  // escapeHtml ne touche pas aux guillemets : on les encode pour l'attribut.
  return ' data-urls="' + escapeHtml(JSON.stringify(urls)).replace(/"/g, '&quot;') + '" title="' + escapeHtml(T('aune.open_random')).replace(/"/g, '&quot;') + '"';
}
// Puces des médias qui ont couvert (un par média, dernier article scrapé), pas de titres.
function auneChipsHtml(arts) {
  if (!arts.length) return '';
  return '<span class="aune-chips">' + arts.map(function(a) {
    return '<a class="aune-media-chip" href="' + escapeHtml(a.url) + '" target="_blank" rel="noopener" title="' + escapeHtml(a.title || '').replace(/"/g, '&quot;') + '">' + escapeHtml(a.media_id || '') + '</a>';
  }).join('') + '</span>';
}
// Illustration de la Vitrine pour CETTE histoire, si elle a été archivée (fetch_art.py) ;
// l'image ne s'affiche (classe has-art sur le rang) qu'une fois chargée. Pas de
// chargement différé : un <figure> masqué ne serait jamais demandé.
function auneArtHtml(c, rnd, urls, T) {
  if (!c.storyline) return '';
  return '<figure class="aune-row-art' + (urls.length ? ' aune-clickable' : '') + '"' + rnd + '>' +
    '<img src="' + escapeHtml(window.radarData.base + '/events/art/' + encodeURIComponent(c.storyline) + '.webp') + '" alt=""' +
    ' onload="this.closest(\'.aune-row\').classList.add(\'has-art\')" onerror="this.parentNode.remove()">' +
    '<figcaption>' + escapeHtml(T('aune.art_credit')) + '</figcaption></figure>';
}
// Un rang, à l'image du Hot 20 : rang, mouvement, [illustration], badge de saillance
// puis titre puis détails, et à droite la mesure de la vue avec sa variation et sa barre.
function auneRowHtml(c, i, region, lang, T, byStory, prevRanks, prevStart, dense) {
  var issue = auneIssue(c, lang);
  var ev = byStory && byStory[c.storyline];
  var urls = auneUrls(c, ev), rnd = auneRandomAttr(urls, T);
  var titleHtml = '<h3 class="aune-row-title' + (urls.length ? ' aune-clickable' : '') + '"' + rnd + '>' + escapeHtml(c.title) + '</h3>';
  var titleTip = c.titleFrom && c.titleKey
    ? ' ' + T('aune.title_from.' + c.titleFrom, { label: auneBlockLabel(c.titleKey, lang) })
    : '';
  // Badge : niveau de l'indice 24h (Dernières heures) ou du pic de la fenêtre (cumuls).
  // Sous le premier palier : « Sous le radar » (Adrien, 31 oct. 2026).
  var band = c.is24h ? (c.band || 'aucune') : (c.peakBand || 'aucune');
  var bandLabel = (!c.is24h && band !== 'aucune') ? T('aune.peak_prefix') + ' ' + T('aune.band.' + band) : T('aune.band.' + band);
  var bandTip = c.is24h ? T('aune.band24h_tip') : T('aune.peak_tip');
  var tagHtml = '<span class="aune-band band-' + escapeHtml(band) + ' hot20-hint" data-tip="' + escapeHtml(bandTip) + '">' + escapeHtml(bandLabel) + '</span>';
  var arts = auneHeadlines(c, ev, 12);
  var metaHtml = '<div class="aune-row-meta">' +
      // « Dans le radar depuis … » (première Une captée) et « sommet … » (meilleur bloc de la
      // période, avec son moment) plutôt que des comptes de blocs (Adrien, 31 oct. 2026).
      (c.firstKey ? '<span class="hot20-hint" data-tip="' + escapeHtml(T('aune.since_tip', { label: auneBlockLabel(c.firstKey, lang) })) + '">' + escapeHtml(T('aune.since_label', { when: auneWhen(c.firstKey, lang) })) + '</span>' : '') +
      '<span class="hot20-hint" data-tip="' + escapeHtml(T('aune.peak_tip') + (c.peakKey ? ' (' + auneBlockLabel(c.peakKey, lang) + ')' : '') + titleTip) + '">' + escapeHtml(T('aune.peak_label', { when: auneWhen(c.peakKey, lang), points: (c.peak || 0).toFixed(1) })) + '</span>' +
      (c.is24h ? '' : '<span class="hot20-hint" data-tip="' + escapeHtml(T('aune.score_tip')) + '">' + escapeHtml(T('aune.total_label', { points: (c.total || 0).toFixed(1) })) + '</span>') +
      '<span>' + escapeHtml(T(arts.length === 1 ? 'aune.medias_one' : 'aune.medias_many', { n: arts.length })) + '</span>' +
      auneChipsHtml(arts) +
    '</div>';
  // La mesure de la vue (l'en-tête la nomme : indice 24h ou points) et, à côté, la part
  // de l'événement dans l'actualité de la période (indice relatif), que la barre dessine.
  var shareHtml = '<span class="unit hot20-hint" data-tip="' + escapeHtml(T('aune.share_tip')) + '">' + escapeHtml(T('aune.share_label', { pct: Math.round(c.sharePct || 0) })) + '</span>';
  var scoreHtml = c.is24h
    // Dernières heures : indice 24h de la Vitrine + variation depuis l'édition précédente
    ? '<span class="num hot20-hint" data-tip="' + escapeHtml(T('aune.index24h_tip')) + '">' + c.points.toFixed(1) + '</span>' + shareHtml + auneDeltaHtml(c, T)
    // Cumuls : points gagnés dans la fenêtre (la mesure qui classe) ; total depuis la
    // première Une dans les détails.
    : '<span class="num hot20-hint" data-tip="' + escapeHtml(T('aune.gain_tip.' + cfg.range)) + '">' + c.points.toFixed(1) + '</span>' + shareHtml;
  var art = (i === 0 && !dense) ? auneArtHtml(c, rnd, urls, T) : '';
  var cls = 'aune-row rank-' + (i + 1) + ' band-' + escapeHtml(band) + (c.size ? ' size-' + c.size : '');
  var style = c.grow ? ' style="--grow:' + c.grow + '"' : '';
  return '<li class="' + cls + '"' + style + '>' +
    '<span class="aune-row-rank">' + (i + 1) + '</span>' +
    '<span class="aune-row-trend">' + auneTrendHtml(c, i, region, cfg.range, prevRanks || {}, prevStart, T) + '</span>' +
    art +
    '<div class="aune-row-main">' +
      '<div class="aune-row-top">' + tagHtml + (issue ? '<span class="aune-issue">' + escapeHtml(issue) + '</span>' : '') + '</div>' +
      titleHtml + metaHtml +
    '</div>' +
    '<div class="aune-row-score">' + scoreHtml +
      '<div class="hot20-bar-track"><div class="hot20-bar" style="width:' + (c.barPct || 2) + '%"></div></div>' +
    '</div>' +
  '</li>';
}
function renderALaUne() {
  var sec = document.getElementById(cfg.sectionId);
  var grid = document.getElementById(cfg.gridId);
  var sub = document.getElementById(cfg.subtitleId);
  if (!sec || !grid) return;
  var T = window.t || function(k) { return k; };
  var lang = (document.documentElement.lang || 'fr').slice(0, 2);
  sec.hidden = false;
  var region = cfg.country;
  if (region !== 'QC' && region !== 'CAN') {
    sub.textContent = T('aune.subtitle');
    var f0 = document.getElementById(cfg.footId); if (f0) f0.textContent = '';
    grid.innerHTML = '<div class="aune-empty">' + escapeHtml(T('aune.usa')) + '</div>';
    return;
  }
  var latest = eventsLatestData && eventsLatestData.by_region ? eventsLatestData.by_region[region] : null;
  sub.textContent = T(cfg.subtitleKeys + cfg.range);
  var seeAll = document.getElementById('aune-see-all');
  if (seeAll) seeAll.href = './classement.html?range=' + encodeURIComponent(cfg.range) + '&country=' + encodeURIComponent(region);
  var foot = document.getElementById(cfg.footId);
  if (foot) foot.textContent = auneLatestKey(latest) ? T('aune.updated', { label: auneBlockLabel(auneLatestKey(latest), lang) }) : '';
  if (!auneReady(region, cfg.range)) {
    grid.innerHTML = '<div class="aune-empty">' + escapeHtml(T('common.loading')) + '</div>';
    var r = cfg.range, c = region;
    auneLoad(c, r).then(function() { if (cfg.range === r && cfg.country === c) renderALaUne(); });
    return;
  }
  var is24h = auneIs24h(cfg.range), limit = AUNE_LIMIT[cfg.range] || 10, proportional = limit <= cfg.proportionalMax;
  var items = is24h ? auneRanking24h(latest, 1e9) : auneRanking(region, cfg.range, 1e9);
  // Filtre de recherche (page Classement) : titre ou thème, sans accents ni casse.
  var q = auneQuery();
  if (q) items = items.filter(function(it) { return auneNorm(it.title + ' ' + auneIssue(it, lang)).indexOf(q) !== -1; });
  var countEl = cfg.countId ? document.getElementById(cfg.countId) : null;
  var nAll = items.length;
  items = items.slice(0, limit);
  if (countEl) countEl.textContent = nAll > items.length ? T('aune.count_shown', { shown: items.length, n: nAll }) : T(nAll === 1 ? 'aune.count_one' : 'aune.count_many', { n: nAll });
  var sums = auneSums(region, cfg.range);
  items.forEach(function(it) {
    var o = sums[it.storyline] || { total: 0, gain: 0, peak: 0 };
    it.total = o.total; it.gain = o.gain; it.peak = o.peak; it.peakKey = o.peakKey; it.peakBand = auneBand(region, o.peak);
    it.firstKey = it.first_key || auneFirstKey(region, it.storyline);
  });
  // Barre et libellé = part de l'événement dans la saillance totale de TOUS les
  // événements de la période (indice relatif, méthodologie § 5.3 ; Adrien, 31 oct. 2026) :
  // une barre pleine au rang 1 = seul dans l'actualité ; à moitié = d'autres compétitionnent.
  var all = is24h ? ((latest && latest.current) || []).map(function(c) { return Number(c.sum24h) || 0; })
                  : auneRanking(region, cfg.range, 1e9).map(function(it) { return it.points; });
  var total = all.reduce(function(m, v) { return m + v; }, 0) || 1;
  items.forEach(function(it) { it.sharePct = 100 * it.points / total; it.barPct = Math.max(1, Math.round(it.sharePct)); });
  if (!items.length) {
    grid.innerHTML = '<div class="aune-empty">' + escapeHtml(T('aune.empty')) + '</div>';
    return;
  }
  var prevStart = is24h ? aunePrevEditionStart(latest) : aunePrevWindow(cfg.range)[0];
  if (proportional) {
    // Hauteur de chaque rang proportionnelle à sa mesure (flex-grow) ; un rang qui
    // n'aurait pas la place d'une troisième ligne (détails) ne l'affiche pas.
    var sum = items.reduce(function(m, it) { return m + it.points; }, 0) || 1;
    var avail = Math.max(0, grid.clientHeight - 34 - 18); // moins l'en-tête et la marge du rang 1
    items.forEach(function(it) {
      it.grow = Math.max(it.points, 0.01).toFixed(3);
      it.size = avail && avail * it.points / sum < 72 ? 's' : 'm';
    });
  }
  if (is24h) {
    var prev24h = aunePrevEdition24h(region, latest);
    items.forEach(function(it) { it.prev24h = typeof prev24h[it.storyline] === 'number' ? prev24h[it.storyline] : 0; });
  }
  // Manchettes : les blocs des 24 dernières heures (fichiers du jour), sinon le dernier bloc.
  var byStory = auneArticlesByStory(region);
  ((latest && latest.events) || []).forEach(function(e) { if (e && e.storyline && !byStory[e.storyline]) byStory[e.storyline] = e; });
  var prevRanks = aunePrevRanks(region, cfg.range, latest);
  var header = '<li class="aune-list-header">' +
    '<span>' + escapeHtml(T('hot20.header_rank')) + '</span>' +
    '<span class="center">' + escapeHtml(T('hot20.header_movement')) + '</span>' +
    '<span>' + escapeHtml(T('aune.header_subject')) + '</span>' +
    '<span class="right">' + escapeHtml(T(is24h ? 'aune.header_score24h' : 'aune.header_points')) + '</span>' +
  '</li>';
  grid.innerHTML = '<ol class="aune-list' + (proportional ? ' proportional' : ' dense') + '">' + header +
    items.map(function(it, i) { return auneRowHtml(it, i, region, lang, T, byStory, prevRanks, prevStart, !proportional); }).join('') + '</ol>';
}
function init(opts) {
  Object.keys(opts || {}).forEach(function(k) { cfg[k] = opts[k]; });
  AUNE_LIMIT = cfg.limits;
  var grid = document.getElementById(cfg.gridId);
  if (grid) grid.addEventListener('click', function(e) {
    if (e.target.closest('a')) return; // manchettes et puces : liens normaux
    var el = e.target.closest('.aune-clickable');
    if (!el || !el.dataset.urls) return;
    var urls = [];
    try { urls = JSON.parse(el.dataset.urls); } catch (err) { urls = []; }
    if (!urls.length) return;
    window.open(urls[Math.floor(Math.random() * urls.length)], '_blank', 'noopener');
  });
  var tabs = document.getElementById(cfg.tabsId);
  var countries = document.getElementById(cfg.countriesId);
  if (tabs) tabs.addEventListener('click', function(e) {
    var btn = e.target.closest('.aune-tab');
    if (!btn) return;
    tabs.querySelectorAll('.aune-tab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    cfg.range = btn.dataset.range;
    renderALaUne();
  });
  if (countries) countries.addEventListener('click', function(e) {
    var btn = e.target.closest('.country-tab');
    if (!btn) return;
    countries.querySelectorAll('.country-tab').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    cfg.country = btn.dataset.country;
    renderALaUne();
  });
  var search = cfg.searchId ? document.getElementById(cfg.searchId) : null;
  if (search) search.addEventListener('input', function() { renderALaUne(); });
  document.addEventListener('i18n:applied', function() { renderALaUne(); });
  renderALaUne();
  if (cfg.loadLatest && window.radarData) {
    window.radarData.eventsLatest()
      .then(function(d) { eventsLatestData = d; renderALaUne(); })
      .catch(function(e) { console.warn('La Une des Unes : événements indisponibles', e); renderALaUne(); });
  }
}
window.RadarAune = { init: init, render: renderALaUne, cfg: cfg };
})();
