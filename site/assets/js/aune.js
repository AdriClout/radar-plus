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
  subtitleKeys: 'aune.range_sub.', // préfixe i18n de la phrase sous le titre, par vue
  navId: null,          // page Classement : navigateur de période (‹ libellé ›), ids navId-prev/-label/-next
  offset: 0,            // 0 = période courante ; −1 = la précédente (édition, jour, semaine, mois, année)…
  type: 'evenements',   // page Classement : 'evenements' (ce module) ou 'objets' (assets/js/objets.js)
  table: false          // page Classement : table large avec les statistiques d'archive
};
var CHART_N = 20;      // « au classement » = dans le top 20 de la période (comme le Hot 20)
var AUNE_FIRST_DATE = Date.UTC(2026, 6, 23); // premières données d'événements : 23 juillet 2026
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
// Minuit (Montréal) du jour qui contient l'instant t.
function auneDayStart(t) { var q = mtlParts(new Date(t)); return mtlMidnightUtc(q.y, q.m, q.d); }
// Fenêtre [début, fin[ en ms UTC d'une vue, décalée de `offset` périodes (0 = courante,
// −1 = précédente…). Les bornes suivent l'heure de Montréal (jour, lundi, 1er du mois).
function auneWindow(range, offset) {
  offset = offset || 0;
  var now = Date.now(), p = mtlParts(new Date(now)), s, e;
  if (range === 'today') { s = auneDayStart(auneDayStart(now) + offset * 86400e3 + 12 * 3600e3); e = auneDayStart(s + 36 * 3600e3); return [s, e]; }
  if (range === 'week') {
    var back = (p.wd + 6) % 7; // lundi = 0
    var monday = auneDayStart(auneDayStart(now) - back * 86400e3 + 12 * 3600e3);
    s = auneDayStart(monday + offset * 7 * 86400e3 + 12 * 3600e3); e = auneDayStart(s + 7 * 86400e3 + 12 * 3600e3); return [s, e];
  }
  if (range === 'month') {
    var m = p.m - 1 + offset, y = p.y + Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    s = mtlMidnightUtc(y, m + 1, 1); e = m === 11 ? mtlMidnightUtc(y + 1, 1, 1) : mtlMidnightUtc(y, m + 2, 1); return [s, e];
  }
  if (range === 'year') return [mtlMidnightUtc(p.y + offset, 1, 1), mtlMidnightUtc(p.y + offset + 1, 1, 1)];
  // Dernières heures : la fenêtre des 6 éditions de l'indice 24h de l'édition choisie
  var t0 = auneEditionStart(offset); if (t0 === null) return [now - 24 * 3600e3, now];
  return [t0 - 5 * AUNE_BLOCK_MS, t0 + AUNE_BLOCK_MS];
}
function auneWindowStart(range) { return auneWindow(range, cfg.offset)[0]; }
// Fenêtre précédente de même nature (jour, semaine, mois, année) : [début, fin[ en ms UTC.
// Fenêtre précédente de même nature : [début, fin[ en ms UTC.
function aunePrevWindow(range) { return auneWindow(range, cfg.offset - 1); }
function periodStartUtc(key) { // 'AAAA-MM-JJ_HH-HH' (UTC)
  return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), parseInt(key.slice(11, 13), 10) || 0);
}
// Dernier bloc publié (clé 'AAAA-MM-JJ_HH-HH') et début, en ms UTC, de l'édition précédente.
function auneLatestKey(latest) { return latest && latest.period && latest.period.key ? latest.period.key : null; }
// Début (ms UTC) du bloc de l'édition choisie (offset 0 = la dernière publiée) et de la précédente.
function auneEditionStart(offset) {
  var latest = eventsLatestData && eventsLatestData.by_region ? eventsLatestData.by_region[cfg.country] : null;
  var k = auneLatestKey(latest); return k ? periodStartUtc(k) + (offset || 0) * AUNE_BLOCK_MS : null;
}
function aunePrevEditionStart() { var t = auneEditionStart(cfg.offset); return t === null ? null : t - AUNE_BLOCK_MS; }
// Clé 'AAAA-MM-JJ_HH-HH' (UTC) du bloc qui commence à t.
function auneKeyAt(t) {
  var d = new Date(t), h = d.getUTCHours(), p = function(n) { return (n < 10 ? '0' : '') + n; };
  return d.toISOString().slice(0, 10) + '_' + p(h) + '-' + p((h + 4) % 24);
}
// Niveau de l'indice 24h (seuils sum24h de events/index.json), pour une édition passée.
function auneBand24h(region, value) {
  var th = auneStore.index && auneStore.index.thresholds && auneStore.index.thresholds[region] && auneStore.index.thresholds[region].sum24h;
  if (!th) return 'aucune';
  var band = 'aucune';
  AUNE_BANDS.forEach(function(b) { if (typeof th[b] === 'number' && value >= th[b]) band = b; });
  return band;
}
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
// Dates (UTC, nom des fichiers du jour) à charger pour les manchettes : celles de la fenêtre
// courante quand elle est courte (édition, jour, semaine), sinon aujourd'hui et hier.
function auneDayDates() {
  var d = eventsLatestData && eventsLatestData.by_region && eventsLatestData.by_region.QC && eventsLatestData.by_region.QC.period
    ? eventsLatestData.by_region.QC.period.date : new Date().toISOString().slice(0, 10);
  var t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  var out = [d, new Date(t - 86400e3).toISOString().slice(0, 10)];
  if (cfg.range === 'month' || cfg.range === 'year') return out;
  var w = auneWindow(cfg.range, cfg.offset), from = w[0] - 86400e3, to = Math.min(w[1], Date.now());
  for (var x = from; x <= to && out.length < 12; x += 86400e3) { var k = new Date(x).toISOString().slice(0, 10); if (out.indexOf(k) === -1) out.push(k); }
  return out;
}
function auneArticlesByStory(region) {
  // Tous les blocs des fichiers du jour et de la veille (pas seulement 24 h) : un média qui a
  // porté l'histoire hier soir reste affiché tant qu'elle est dans le radar (Adrien, 31 oct.).
  var out = {};
  auneDayDates().forEach(function(date) {
    var f = auneStore.storylines['day:' + region + ':' + date]; if (!f || !f.periods) return;
    Object.keys(f.periods).sort().reverse().forEach(function(key) {
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
  var win = auneWindow(range, cfg.offset), start = win[0], now = win[1], out = {};
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
// Indice 24h de chaque histoire au bloc qui commence à t (ms UTC), lu dans les fiches :
// sert aux éditions passées, au mouvement et à la colonne « Variation 4h ».
function auneSum24hAt(region, t) {
  var out = {};
  if (t === null || t === undefined) return out;
  var key = auneKeyAt(t);
  auneYears().forEach(function(y) {
    var f = auneStore.storylines[region + '/' + y]; if (!f || !f.storylines) return;
    Object.keys(f.storylines).forEach(function(sid) {
      var cum = f.storylines[sid].sum24h || {};
      if (typeof cum[key] === 'number') out[sid] = cum[key];
    });
  });
  return out;
}
function aunePrevEdition24h(region) { return auneSum24hAt(region, aunePrevEditionStart()); }
// Classement par indice 24h à une édition passée (fiches), même forme que auneRanking24h.
function auneRanking24hAt(region, t, limit) {
  var vals = auneSum24hAt(region, t), key = auneKeyAt(t);
  var list = Object.keys(vals).map(function(sid) {
    var st = auneStoryline(region, sid) || {};
    var ttl = (st.peak_key && st.peak_key <= key && st.title_peak) ? st.title_peak : (st.title_last || st.title || '');
    return { storyline: sid, title: ttl, issue_fr: st.issue_fr, issue_en: st.issue_en, url: st.url, media: st.media,
             points: Number(vals[sid]) || 0, blocks: 0, band: auneBand24h(region, Number(vals[sid]) || 0), lastKey: key, first_key: st.first_key, is24h: true };
  }).filter(function(it) { return it.points > 0; });
  list.sort(function(a, b) { return b.points - a.points; });
  return list.slice(0, limit);
}
// Rang de chaque histoire dans la période précédente (même mesure que la vue) :
// l'édition précédente pour Dernières heures, la fenêtre précédente sinon.
// Rang de chaque histoire dans la période précédente (même mesure que la vue) :
// l'édition précédente pour Dernières heures, la fenêtre précédente sinon.
function aunePrevRanks(region, range) {
  var ranks = {}, list = [];
  if (auneIs24h(range)) {
    var prev = aunePrevEdition24h(region);
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
    return '<span class="hot20-trend hot20-hint comeback" data-tip="' + escapeHtml(T('aune.trend_return_tip' + sfx)) + '">' + escapeHtml(T('homepage.trend_return_label')) + '</span>';
  }
  return '<span class="hot20-trend hot20-hint new" data-tip="' + escapeHtml(T('aune.trend_new_tip' + sfx)) + '">' + escapeHtml(T('homepage.trend_new_label')) + '</span>';
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
  // Sans fenêtre explicite : celle de la vue et de la période choisie (fin incluse, pas « maintenant »).
  win = win || auneWindow(range, cfg.offset);
  var start = win[0], now = win[1], acc = {};
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
// Heure d'ÉDITION d'un bloc, en heure de Montréal : une édition (0h, 4h, 8h, 12h, 16h, 20h
// l'été) publie le bloc de 4h qui s'est terminé une heure plus tôt, donc début du bloc + 5h.
// C'est l'heure que la Vitrine affiche ; les blocs eux-mêmes (clés UTC) ne sont jamais montrés.
function auneEditionTime(key) { return periodStartUtc(key) + AUNE_BLOCK_MS + 3600e3; }
function auneHourMtl(t) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', hour: 'numeric', hour12: false }).format(new Date(t)).replace(/^24$/, '0').replace(/^0(\d)$/, '$1') + 'h';
}
// Moment d'une édition, en court : « 16h » si c'est aujourd'hui, « mardi 16h » dans les six
// derniers jours, « 27 oct. 16h » avant.
function auneWhen(key, lang) {
  if (!key) return '';
  var t = auneEditionTime(key), d = new Date(t), now = new Date(), loc = lang === 'en' ? 'en-CA' : 'fr-CA';
  var hour = auneHourMtl(t);
  var a = mtlParts(d), b = mtlParts(now);
  if (a.y === b.y && a.m === b.m && a.d === b.d) return hour;
  if (now.getTime() - t < 6 * 86400e3) return new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', weekday: 'long' }).format(d) + ' ' + hour;
  return new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', day: 'numeric', month: 'short' }).format(d) + ' ' + hour;
}
// Moment complet d'une édition pour les info-bulles : « édition de 16h, 31 oct. »
function auneBlockLabel(key, lang) {
  var t = auneEditionTime(key), loc = lang === 'en' ? 'en-CA' : 'fr-CA';
  var day = new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', day: 'numeric', month: 'short' }).format(new Date(t));
  return (lang === 'en' ? auneHourMtl(t) + ' edition, ' : 'édition de ' + auneHourMtl(t) + ', ') + day;
}
// Filtre de recherche (page Classement) : sans accents ni casse.
// Libellé de la période affichée : « édition de 16h, 31 oct. », « samedi 31 octobre 2026 »,
// « Semaine 44 · 26 oct. – 1 nov. 2026 », « octobre 2026 », « 2026 ».
function auneIsoWeek(t) {
  var q = mtlParts(new Date(t)), d = new Date(Date.UTC(q.y, q.m - 1, q.d));
  var day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  var y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d - y0) / 86400e3 + 1) / 7);
}
function auneNavLabel(range, offset, lang, T) {
  var loc = lang === 'en' ? 'en-CA' : 'fr-CA', w = auneWindow(range, offset);
  var fmt = function(t, o) { return new Intl.DateTimeFormat(loc, Object.assign({ timeZone: 'America/Montreal' }, o)).format(new Date(t)); };
  if (range === '24h') { var t0 = auneEditionStart(offset); return t0 === null ? '' : auneBlockLabel(auneKeyAt(t0), lang); }
  if (range === 'today') return fmt(w[0] + 12 * 3600e3, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (range === 'week') {
    var a = w[0] + 12 * 3600e3, b = w[1] - 12 * 3600e3;
    return T('aune.week_label', { n: auneIsoWeek(a) }) + ' · ' + fmt(a, { day: 'numeric', month: 'short' }) + ' – ' + fmt(b, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (range === 'month') return fmt(w[0] + 12 * 3600e3, { month: 'long', year: 'numeric' });
  if (range === 'year') return fmt(w[0] + 12 * 3600e3, { year: 'numeric' });
  return '';
}
// Deuxième ligne du navigateur : « Saillance cumulée depuis le 26 octobre 2026 » ou, pour
// Dernières heures, « Indice 24h à cette édition ».
function auneNavSub(range, offset, lang, T) {
  if (range === '24h') return T('classement.nav_sub_24h');
  var w = auneWindow(range, offset), loc = lang === 'en' ? 'en-CA' : 'fr-CA';
  var date = new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(w[0] + 12 * 3600e3));
  return T('classement.nav_sub_cumul', { date: date });
}
// Au-dessus de la date : une période close est un classement FINAL ; la période courante est
// encore mise à jour à chaque édition.
function auneNavStatus(cfg, T) {
  var el = document.getElementById(cfg.navId + '-status'); if (!el) return;
  var final = cfg.offset < 0;
  el.textContent = T(final ? 'classement.status_final' : 'classement.status_live');
  el.className = 'cl-nav-status ' + (final ? 'final' : 'live');
}
function auneNorm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function auneQuery() { var el = cfg.searchId ? document.getElementById(cfg.searchId) : null; return el ? auneNorm(el.value.trim()) : ''; }
function auneFicheUrl(c, region) { return './statistiques.html?evenement=' + encodeURIComponent(c.storyline || '') + '&region=' + encodeURIComponent(region || 'QC'); }
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
function auneArtHtml(c, rnd, urls, T, latest) {
  if (!c.storyline) return '';
  // L'adresse porte la clé de la dernière édition : une image absente à une édition (404 gardé
  // en cache par le navigateur ou Cloudflare) est redemandée à l'édition suivante.
  var v = auneLatestKey(latest) ? '?v=' + encodeURIComponent(auneLatestKey(latest)) : '';
  return '<figure class="aune-row-art' + (urls.length ? ' aune-clickable' : '') + '"' + rnd + '>' +
    '<img src="' + escapeHtml(window.radarData.base + '/events/art/' + encodeURIComponent(c.storyline) + '.webp' + v) + '" alt=""' +
    ' onload="this.closest(\'.aune-row\').classList.add(\'has-art\')" onerror="this.parentNode.remove()">' +
    '<figcaption>' + escapeHtml(T('aune.art_credit')) + '</figcaption></figure>';
}
// Un rang, à l'image du Hot 20 : rang, mouvement, [illustration], badge de saillance
// puis titre puis détails, et à droite la mesure de la vue avec sa variation et sa barre.
function auneRowHtml(c, i, region, lang, T, byStory, prevRanks, prevStart, dense, latest) {
  var issue = auneIssue(c, lang);
  var ev = byStory && byStory[c.storyline];
  var urls = auneUrls(c, ev), rnd = auneRandomAttr(urls, T);
  // Le titre mène à la fiche de l'événement (Statistiques) ; les puces, aux articles.
  var titleHtml = '<h3 class="aune-row-title"><a href="' + auneFicheUrl(c, region) + '">' + escapeHtml(c.title) + '</a></h3>';
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
      '<span class="hot20-hint" data-tip="' + escapeHtml(T('aune.peak_tip') + titleTip) + '">' + escapeHtml(T('aune.peak_label', { when: auneWhen(c.peakKey, lang), points: (c.peak || 0).toFixed(1) })) + '</span>' +
      (c.is24h ? '' : '<span class="hot20-hint" data-tip="' + escapeHtml(T('aune.score_tip')) + '">' + escapeHtml(T('aune.total_label', { points: (c.total || 0).toFixed(1) })) + '</span>') +
      auneChipsHtml(arts) +
    '</div>';
  // La mesure de la vue (l'en-tête la nomme : indice 24h ou points) et, à côté, la part
  // de l'événement dans l'actualité de la période (indice relatif), que la barre dessine.
  var shareHtml = '<span class="unit hot20-hint" data-tip="' + escapeHtml(T('aune.share_tip')) + '">' + escapeHtml(T('aune.share_label', { pct: Math.round(c.sharePct || 0) })) + '</span>';
  var scoreHtml = c.is24h
    // Dernières heures : indice 24h de la Vitrine + variation depuis l'édition précédente
    ? '<span class="num hot20-hint" data-tip="' + escapeHtml(T('aune.index24h_tip')) + '">' + c.points.toFixed(1) + '</span>' + auneDeltaHtml(c, T)
    // Cumuls : points gagnés dans la fenêtre (la mesure qui classe) ; total depuis la
    // première Une dans les détails.
    : '<span class="num hot20-hint" data-tip="' + escapeHtml(T('aune.gain_tip.' + cfg.range)) + '">' + c.points.toFixed(1) + '</span>';
  var art = (i === 0 && !dense) ? auneArtHtml(c, rnd, urls, T, latest) : '';
  var rank = c.rank || (i + 1);
  var cls = 'aune-row rank-' + rank + ' band-' + escapeHtml(band) + (c.size ? ' size-' + c.size : '');
  var style = c.grow ? ' style="--grow:' + c.grow + '"' : '';
  return '<li class="' + cls + ' aune-go" data-href="' + auneFicheUrl(c, region) + '"' + style + '>' +
    '<span class="aune-row-rank">' + rank + '</span>' +
    '<span class="aune-row-trend">' + auneTrendHtml(c, rank - 1, region, cfg.range, prevRanks || {}, prevStart, T) + '</span>' +
    art +
    '<div class="aune-row-main">' +
      '<div class="aune-row-top">' + tagHtml + (issue ? '<span class="aune-issue">' + escapeHtml(issue) + '</span>' : '') + '</div>' +
      titleHtml + metaHtml +
    '</div>' +
    '<div class="aune-row-score">' + scoreHtml +
      '<div class="hot20-bar-track"><div class="hot20-bar" style="width:' + (c.barPct || 2) + '%"></div></div>' + shareHtml +
    '</div>' +
  '</li>';
}
// Table large de la page Classement : toutes les colonnes, défilable sur téléphone.
// Unité des périodes de la vue (« 13 semaines ») et nombre avec unité (« 669.1 points »).
function auneUnitPeriod(range, n, T) { return T((n === 1 ? 'aune.unit_one.' : 'aune.unit_many.') + range); }
function auneNumUnit(v, unit) { return '<span class="val">' + v + '</span> <span class="unit">' + escapeHtml(unit) + '</span>'; }
function auneTableHtml(items, region, lang, T, byStory, prevRanks, prevStart, is24h) {
  var esc = escapeHtml;
  var th = function(k, cls) { return '<th class="' + (cls || '') + '">' + esc(T(k)) + '</th>'; };
  var per = T('aune.unit_many.' + cfg.range);
  var thTxt = function(txt, cls) { return '<th class="' + (cls || '') + '">' + esc(txt) + '</th>'; };
  var head = '<tr>' + th('hot20.header_rank') + th('hot20.header_movement', 'center') + th('aune.header_subject') +
    th(is24h ? 'aune.index24h_label' : 'csv.points', 'num') + (is24h ? th('csv.delta4h', 'num') : th('csv.total', 'num')) +
    th('csv.share', 'num') + th('csv.peak_points', 'num') + th('csv.since') +
    thTxt(T('csv.consec_of', { per: per }), 'num') + thTxt(T('csv.on_chart_of', { per: per }), 'num') + '</tr>';
  var rows = items.map(function(c, i) {
    var ev = byStory && byStory[c.storyline], urls = auneUrls(c, ev), rnd = auneRandomAttr(urls, T);
    var band = is24h ? (c.band || 'aucune') : (c.peakBand || 'aucune');
    var bandLabel = (!is24h && band !== 'aucune') ? T('aune.peak_prefix') + ' ' + T('aune.band.' + band) : T('aune.band.' + band);
    var arts = auneHeadlines(c, ev, 12);
    var stats = auneChartFor(region, cfg.range, cfg.offset, c.storyline);
    var delta = is24h ? c.points - (c.prev24h || 0) : null;
    var rank = c.rank || (i + 1);
    return '<tr class="rank-' + rank + ' band-' + esc(band) + ' aune-go" data-href="' + auneFicheUrl(c, region) + '">' +
      '<td class="rank">' + rank + '</td>' +
      '<td class="center">' + auneTrendHtml(c, rank - 1, region, cfg.range, prevRanks || {}, prevStart, T) + '</td>' +
      '<td class="subject"><span class="aune-band band-' + esc(band) + '">' + esc(bandLabel) + '</span>' +
        '<span class="aune-row-title"><a href="' + auneFicheUrl(c, region) + '">' + esc(c.title) + '</a></span>' +
        '<span class="sub">' + esc(auneIssue(c, lang) || '') + '</span>' + auneChipsHtml(arts) + '</td>' +
      '<td class="num strong">' + auneNumUnit(c.points.toFixed(1), is24h ? T('aune.index24h_label') : T('aune.points')) + '</td>' +
      (is24h ? '<td class="num ' + (delta >= 0.05 ? 'up' : delta <= -0.05 ? 'down' : '') + '">' + auneNumUnit((delta > 0 ? '+' : '') + delta.toFixed(1), T('aune.points')) + '</td>'
             : '<td class="num">' + auneNumUnit((c.total || 0).toFixed(1), T('aune.points')) + '</td>') +
      '<td class="num">' + auneNumUnit(Math.round(c.sharePct || 0), '%') + '</td>' +
      '<td class="num">' + auneNumUnit((c.peak || 0).toFixed(1), T('aune.points')) + '<span class="sub">' + esc(auneWhen(c.peakKey, lang)) + '</span></td>' +
      '<td>' + esc(c.firstKey ? auneWhen(c.firstKey, lang) : '') + '</td>' +
      '<td class="num">' + auneNumUnit(stats.consec, auneUnitPeriod(cfg.range, stats.consec, T)) + '</td>' +
      '<td class="num">' + auneNumUnit(stats.total, auneUnitPeriod(cfg.range, stats.total, T)) + '</td>' +
    '</tr>';
  }).join('');
  return auneTableWrap('<table class="aune-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>', T);
}
// Enveloppe défilable avec, à droite, un voile et un repère « défiler → » tant que tout n'est pas visible.
function auneTableWrap(tableHtml, T) {
  return '<div class="aune-table-outer"><button type="button" class="aune-table-arrow" aria-label="' + escapeHtml(T('classement.scroll_hint')) + '" title="' + escapeHtml(T('classement.scroll_hint')) + '">&#8250;</button><div class="aune-table-wrap">' + tableHtml + '</div></div>';
}
function auneTableScrollCue() {
  document.querySelectorAll('.aune-table-outer').forEach(function(outer) {
    var wrap = outer.querySelector('.aune-table-wrap'); if (!wrap) return;
    var update = function() { outer.classList.toggle('has-more', wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft > 8); };
    var arrow = outer.querySelector('.aune-table-arrow');
    if (arrow) arrow.addEventListener('click', function() { wrap.scrollBy({ left: Math.max(300, wrap.clientWidth * 0.6), behavior: 'smooth' }); });
    wrap.addEventListener('scroll', update); window.addEventListener('resize', update); update();
  });
}
function renderALaUne() {
  if (cfg.type === 'objets' && window.RadarObjets) { window.RadarObjets.render(); return; }
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
  if (foot) foot.textContent = '';
  if (!auneReady(region, cfg.range)) {
    grid.innerHTML = '<div class="aune-empty">' + escapeHtml(T('common.loading')) + '</div>';
    var r = cfg.range, c = region;
    auneLoad(c, r).then(function() { if (cfg.range === r && cfg.country === c) renderALaUne(); });
    return;
  }
  var is24h = auneIs24h(cfg.range), limit = AUNE_LIMIT[cfg.range] || 10, proportional = limit <= cfg.proportionalMax;
  // Navigateur de période (page Classement) : libellé et bouton « suivant » bloqué sur la période courante.
  if (cfg.navId) {
    var lbl = document.getElementById(cfg.navId + '-label'), nxt = document.getElementById(cfg.navId + '-next');
    if (lbl) lbl.textContent = auneNavLabel(cfg.range, cfg.offset, lang, T);
    var subEl = document.getElementById(cfg.navId + '-sub'); if (subEl) subEl.textContent = auneNavSub(cfg.range, cfg.offset, lang, T);
    auneNavStatus(cfg, T);
    if (nxt) nxt.disabled = cfg.offset >= 0;
  }
  var past24h = is24h && cfg.offset < 0;
  var items = past24h ? auneRanking24hAt(region, auneEditionStart(cfg.offset), 1e9)
            : is24h ? auneRanking24h(latest, 1e9) : auneRanking(region, cfg.range, 1e9);
  items.forEach(function(it, i) { it.rank = i + 1; }); // rang réel, gardé même quand un filtre réduit la liste
  // Filtre de recherche (page Classement) : titre ou thème, sans accents ni casse.
  var q = auneQuery();
  if (q) items = items.filter(function(it) { return auneNorm(it.title + ' ' + auneIssue(it, lang)).indexOf(q) !== -1; });
  var countEl = cfg.countId ? document.getElementById(cfg.countId) : null;
  var full = items, nAll = full.length; // liste complète filtrée : affichage coupé à `limit`, export CSV entier
  items = full.slice(0, limit);
  if (countEl) countEl.textContent = nAll > items.length ? T('aune.count_shown', { shown: items.length, n: nAll }) : T(nAll === 1 ? 'aune.count_one' : 'aune.count_many', { n: nAll });
  var sums = auneSums(region, cfg.range);
  full.forEach(function(it) {
    var o = sums[it.storyline] || { total: 0, gain: 0, peak: 0 };
    it.total = o.total; it.gain = o.gain; it.peak = o.peak; it.peakKey = o.peakKey; it.peakBand = auneBand(region, o.peak);
    it.firstKey = it.first_key || auneFirstKey(region, it.storyline);
  });
  // Barre et libellé = part de l'événement dans la saillance totale de TOUS les
  // événements de la période (indice relatif, méthodologie § 5.3 ; Adrien, 31 oct. 2026) :
  // une barre pleine au rang 1 = seul dans l'actualité ; à moitié = d'autres compétitionnent.
  var all = past24h ? Object.keys(auneSum24hAt(region, auneEditionStart(cfg.offset))).map(function(sid) { return auneSum24hAt(region, auneEditionStart(cfg.offset))[sid]; })
          : is24h ? ((latest && latest.current) || []).map(function(c) { return Number(c.sum24h) || 0; })
                  : auneRanking(region, cfg.range, 1e9).map(function(it) { return it.points; });
  var total = all.reduce(function(m, v) { return m + v; }, 0) || 1;
  full.forEach(function(it) { it.sharePct = 100 * it.points / total; it.barPct = Math.max(1, Math.round(it.sharePct)); });
  if (!items.length) {
    grid.innerHTML = '<div class="aune-empty">' + escapeHtml(T('aune.empty')) + '</div>';
    return;
  }
  var prevStart = is24h ? aunePrevEditionStart() : aunePrevWindow(cfg.range)[0];
  if (proportional) {
    // Hauteur de chaque rang proportionnelle à sa mesure (flex-grow), avec un plancher
    // (CSS) qui garde toujours les trois lignes : badge, titre, détails et médias.
    items.forEach(function(it) { it.grow = Math.max(it.points, 0.01).toFixed(3); });
  }
  if (is24h) {
    var prev24h = aunePrevEdition24h(region);
    full.forEach(function(it) { it.prev24h = typeof prev24h[it.storyline] === 'number' ? prev24h[it.storyline] : 0; });
  }
  // Manchettes : les blocs des 24 dernières heures (fichiers du jour), sinon le dernier bloc.
  var byStory = auneArticlesByStory(region);
  ((latest && latest.events) || []).forEach(function(e) { if (e && e.storyline && !byStory[e.storyline]) byStory[e.storyline] = e; });
  var prevRanks = aunePrevRanks(region, cfg.range);
  lastExport = { rows: full, prevRanks: prevRanks, byStory: byStory, is24h: is24h, region: region, lang: lang };
  var header = '<li class="aune-list-header">' +
    '<span>' + escapeHtml(T('hot20.header_rank')) + '</span>' +
    '<span class="center">' + escapeHtml(T('hot20.header_movement')) + '</span>' +
    '<span>' + escapeHtml(T('aune.header_subject')) + '</span>' +
    '<span class="right">' + escapeHtml(T(is24h ? 'aune.header_score24h' : 'aune.header_points')) + '</span>' +
  '</li>';
  if (cfg.table) { grid.innerHTML = auneTableHtml(items, region, lang, T, byStory, prevRanks, prevStart, is24h); auneTableScrollCue(); return; }
  grid.innerHTML = '<ol class="aune-list' + (proportional ? ' proportional' : ' dense') + '">' + header +
    items.map(function(it, i) { return auneRowHtml(it, i, region, lang, T, byStory, prevRanks, prevStart, !proportional, latest); }).join('') + '</ol>';
}
var lastExport = null;
var chartCache = {};
// Statistiques d'archive, comme le Hot 20 : pour chaque histoire du classement, nombre de
// périodes CONSÉCUTIVES (en remontant depuis la période affichée) où elle est dans le top 20,
// et nombre TOTAL de périodes où elle y a été, depuis le début des données. Une période =
// la vue (édition, jour, semaine, mois, année). Mémorisé par vue et région.
function auneTopIds(region, range, offset) {
  var list = auneIs24h(range) ? auneRanking24hAt(region, auneEditionStart(offset), CHART_N)
                              : auneRanking(region, range, CHART_N, auneWindow(range, offset));
  var ids = {}; list.forEach(function(it) { ids[it.storyline] = true; }); return ids;
}
function auneChartStats(region, range) {
  var key = region + '|' + range + '|' + (auneLatestKey(eventsLatestData && eventsLatestData.by_region ? eventsLatestData.by_region[region] : null) || '');
  if (chartCache[key]) return chartCache[key];
  var tops = [], offset = 0, guard = 0;
  while (guard++ < 2000) {
    var w = auneWindow(range, offset);
    if (w[1] <= AUNE_FIRST_DATE) break;
    tops.push(auneTopIds(region, range, offset));
    offset -= 1;
  }
  var stats = {};
  tops.forEach(function(ids) { Object.keys(ids).forEach(function(sid) { var s = stats[sid] || (stats[sid] = { total: 0 }); s.total++; }); });
  chartCache[key] = { stats: stats, tops: tops };
  return chartCache[key];
}
// Statistiques d'archive pour la période AFFICHÉE (offset courant), lues dans le cache :
// consécutives = périodes d'affilée au top 20 en remontant depuis celle-ci ; total = depuis le début.
function auneChartFor(region, range, offset, sid) {
  var all = auneChartStats(region, range), i = -offset, n = 0;
  while (i < all.tops.length && all.tops[i][sid]) { n++; i++; }
  return { consec: n, total: all.stats[sid] ? all.stats[sid].total : 0 };
}
// ── Export CSV du classement affiché (filtres compris, liste entière) ──────────
// Français : point-virgule et virgule décimale (Excel FR) ; anglais : virgule et point.
function csvFile(headers, rows, filename, lang, T) {
  var sep = lang === 'en' ? ',' : ';';
  var cell = function(v) {
    if (typeof v === 'number') { var n = Number.isInteger(v) ? String(v) : v.toFixed(1); return lang === 'en' ? n : n.replace('.', ','); }
    var s = v == null ? '' : String(v);
    return /[";,\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  var lines = [headers.map(cell).join(sep)].concat(rows.map(function(r) { return r.map(cell).join(sep); }));
  var date = new Intl.DateTimeFormat(lang === 'en' ? 'en-CA' : 'fr-CA', { timeZone: 'America/Montreal', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  lines.push(cell(T('csv.footer', { date: date, url: 'https://radarplus.org/methodologie.html' })));
  var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
}
// Morceau de nom de fichier pour la période affichée : edition-2026-10-31-16h, jour-2026-10-31,
// semaine-44-2026, mois-2026-10, annee-2026.
function periodSlug(range, offset) {
  var w = auneWindow(range, offset), q = mtlParts(new Date(w[0] + 12 * 3600e3));
  var p = function(n) { return (n < 10 ? '0' : '') + n; };
  if (range === '24h') { var t = auneEditionStart(offset); if (t === null) return 'edition'; var e = auneEditionTime(auneKeyAt(t)), d = mtlParts(new Date(e)); return 'edition-' + d.y + '-' + p(d.m) + '-' + p(d.d) + '-' + auneHourMtl(e); }
  if (range === 'today') return 'jour-' + q.y + '-' + p(q.m) + '-' + p(q.d);
  if (range === 'week') return 'semaine-' + p(auneIsoWeek(w[0] + 12 * 3600e3)) + '-' + mtlParts(new Date(w[1] - 12 * 3600e3)).y;
  if (range === 'month') return 'mois-' + q.y + '-' + p(q.m);
  return 'annee-' + q.y;
}
// Événement d'une histoire à un bloc donné, dans les fichiers du jour chargés (sinon null).
function auneEventAt(region, sid, key) {
  if (!key) return null;
  var f = auneStore.storylines['day:' + region + ':' + key.slice(0, 10)];
  var evs = f && f.periods && f.periods[key]; if (!evs) return null;
  for (var i = 0; i < evs.length; i++) if (evs[i] && evs[i].storyline === sid) return evs[i];
  return null;
}
function auneEventUrl(ev) { return ev ? ((ev.articles && ev.articles[0] && ev.articles[0].url) || ev.url || '') : ''; }
function downloadCsv() {
  if (cfg.type === 'objets') { if (window.RadarObjets) window.RadarObjets.download(); return; }
  if (!lastExport) return;
  var T = window.t || function(k) { return k; }, x = lastExport, lang = x.lang;
  var period = auneNavLabel(cfg.range, cfg.offset, lang, T);
  var headers = [T('csv.rank'), T('csv.title'), T('csv.theme'), x.is24h ? T('csv.index24h') : T('csv.points')]
    .concat(x.is24h ? [T('csv.delta4h')] : [T('csv.total')])
    .concat([T('csv.share'), T('csv.prev_rank'), T('csv.since'), T('csv.peak_points'), T('csv.peak_when'), T('csv.consec'), T('csv.on_chart'), T('csv.media'), T('csv.url_first'), T('csv.url_peak'), T('csv.url_last'), T('csv.media_urls'), T('csv.region'), T('csv.period')]);
  var rows = x.rows.map(function(c, i) {
    var artList = auneHeadlines(c, x.byStory && x.byStory[c.storyline], 50);
    var arts = artList.map(function(a) { return a.media_id || ''; }).filter(Boolean).join(' ');
    // Liens, jamais les textes : première Une, sommet et dernière Une de l'histoire, puis le
    // dernier article de chaque média (« LAP: https://… | TVA: https://… »).
    var urlFirst = auneEventUrl(auneEventAt(x.region, c.storyline, c.firstKey));
    var urlPeak = auneEventUrl(auneEventAt(x.region, c.storyline, c.peakKey));
    var urlLast = c.url || auneEventUrl(auneEventAt(x.region, c.storyline, c.lastKey));
    var mediaUrls = artList.filter(function(a) { return a.url; }).map(function(a) { return (a.media_id || '?') + ': ' + a.url; }).join(' | ');
    var prev = x.prevRanks[c.storyline] || '', st = auneChartFor(x.region, cfg.range, cfg.offset, c.storyline);
    return [c.rank || (i + 1), c.title, auneIssue(c, lang), c.points]
      .concat(x.is24h ? [c.points - (c.prev24h || 0)] : [c.total || 0])
      .concat([c.sharePct || 0, prev, c.firstKey ? auneBlockLabel(c.firstKey, lang) : '', c.peak || 0, c.peakKey ? auneBlockLabel(c.peakKey, lang) : '', st.consec, st.total, arts, urlFirst, urlPeak, urlLast, mediaUrls, x.region, period]);
  });
  csvFile(headers, rows, 'radarplus_evenements_' + x.region + '_' + periodSlug(cfg.range, cfg.offset) + '.csv', lang, T);
}
function init(opts) {
  Object.keys(opts || {}).forEach(function(k) { cfg[k] = opts[k]; });
  AUNE_LIMIT = cfg.limits;
  var grid = document.getElementById(cfg.gridId);
  if (grid) grid.addEventListener('click', function(e) {
    if (e.target.closest('a, button')) return; // manchettes, puces, boutons : liens normaux
    var el = e.target.closest('.aune-clickable');
    if (!el) { var row = e.target.closest('.aune-go'); if (row && row.dataset.href) { window.location.href = row.dataset.href; } return; }
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
    cfg.range = btn.dataset.range; cfg.offset = 0;
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
  if (cfg.navId) {
    var prevBtn = document.getElementById(cfg.navId + '-prev'), nextBtn = document.getElementById(cfg.navId + '-next');
    if (prevBtn) prevBtn.addEventListener('click', function() { cfg.offset -= 1; renderALaUne(); });
    if (nextBtn) nextBtn.addEventListener('click', function() { if (cfg.offset < 0) { cfg.offset += 1; renderALaUne(); } });
  }
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
window.RadarAune = { init: init, render: renderALaUne, download: downloadCsv, cfg: cfg,
  // Boîte à outils partagée avec le classement des objets (assets/js/objets.js)
  util: { window: auneWindow, navLabel: auneNavLabel, navSub: auneNavSub, navStatus: auneNavStatus, when: auneWhen, blockLabel: auneBlockLabel, editionTime: auneEditionTime, hourMtl: auneHourMtl, mtlParts: mtlParts, csvFile: csvFile, periodSlug: periodSlug, tableWrap: auneTableWrap, scrollCue: auneTableScrollCue, numUnit: auneNumUnit, unitPeriod: auneUnitPeriod, firstDate: AUNE_FIRST_DATE, chartN: CHART_N, editionStart: auneEditionStart, keyAt: auneKeyAt, periodStartUtc: periodStartUtc, escapeHtml: escapeHtml, norm: auneNorm, query: auneQuery, isoWeek: auneIsoWeek } };
})();
