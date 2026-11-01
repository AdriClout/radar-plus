/* Fiche d'un événement saillant — page Statistiques, ?evenement=<storyline>&region=QC|CAN.
   Sources : v2/events/storylines/{région}/{année}.json (fiche : indice par édition, indice 24h,
   sommet, titres), v2/events/index.json (seuils), v2/events/{région}/{date}.json (manchettes
   et liens des médias aux éditions de la première Une, du sommet et de la dernière Une).
   On ne reproduit jamais le texte des articles : seulement leurs liens. */
(function() {
'use strict';
var params = new URLSearchParams(window.location.search);
var sid = params.get('evenement') || null;
var region = (params.get('region') || '').toUpperCase(); if (region !== 'CAN') region = 'QC';
var FIRST_YEAR = 2026, BLOCK_MS = 4 * 3600e3, BANDS = ['faible', 'moderee', 'elevee', 'tres_elevee', 'extreme'];

function T(k, v) { var t = window.t ? window.t(k, v) : null; return (t && t !== k) ? t : (FALLBACK[k] || k).replace(/\{(\w+)\}/g, function(m, n) { return v && v[n] != null ? v[n] : m; }); }
var FALLBACK = {
  'fiche.title': "Fiche d'événement", 'fiche.lead': "Une histoire telle que les Unes l'ont portée, édition par édition.",
  'fiche.index24h': "indice 24h", 'fiche.peak': "sommet", 'fiche.since': "dans le radar depuis", 'fiche.last': "dernière Une",
  'fiche.total': "total", 'fiche.editions': "éditions en Une", 'fiche.media': "médias", 'fiche.points': "points",
  'fiche.chart': "Indice par édition et indice 24h", 'fiche.chart_tip': "Barres : indice de chaque édition de 4h. Ligne : indice 24h (moyenne des 6 dernières éditions, les plus récentes comptant davantage).",
  'fiche.links': "Les Unes, par les liens", 'fiche.links_first': "Première Une", 'fiche.links_peak': "Au sommet", 'fiche.links_last': "Dernière Une",
  'fiche.editions_list': "Toutes les éditions", 'fiche.col_edition': "Édition", 'fiche.col_index': "Indice", 'fiche.col_index24h': "Indice 24h", 'fiche.col_title': "Titre à cette édition",
  'fiche.title_peak': "Titre au sommet", 'fiche.in_ranking': "Voir dans le classement →", 'fiche.not_found': "Événement introuvable dans les données publiées.",
  'fiche.band_aucune': "Sous le radar", 'fiche.band_faible': "Saillance faible", 'fiche.band_moderee': "Saillance modérée", 'fiche.band_elevee': "Saillance élevée", 'fiche.band_tres_elevee': "Saillance très élevée", 'fiche.band_extreme': "Saillance extrême",
  'fiche.region_QC': "Québec", 'fiche.region_CAN': "Canada", 'fiche.loading': "Chargement…",
  'fiche.type_objects': "Objets", 'fiche.type_events': "Événements", 'fiche.search_placeholder': "Rechercher un événement (un mot du titre ou du thème)…",
  'fiche.search_empty': "Recherchez un événement pour afficher sa fiche.", 'fiche.search_none': "Aucun événement ne correspond.", 'fiche.search_hint': "Exemples : cycliste, Carney, budget, grève.",
  'fiche.page_title_events': "Statistiques par événement", 'fiche.page_lead_events': "Recherchez un événement pour afficher sa fiche : indice par édition, sommet, Unes et médias.",
  'fiche.no_usa': "Pas d'événements pour les États-Unis : le panel américain ne compte que deux médias. Québec ou Canada."
};
var u = window.RadarAune && window.RadarAune.util;
function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function lang() { return (document.documentElement.lang || 'fr').slice(0, 2); }
function band(th, v) { var b = 'aucune'; if (!th) return b; BANDS.forEach(function(x) { if (typeof th[x] === 'number' && v >= th[x]) b = x; }); return b; }
function years() { var out = [], y1 = new Date().getUTCFullYear(); for (var y = FIRST_YEAR; y <= y1; y++) out.push(y); return out; }
function fmt1(v) { return (Number(v) || 0).toFixed(1); }

var storyCache = {}, ficheSec = null, mode = 'objets', pageTitle = null, pageLead = null;
function mainEl() { return document.querySelector('main.wrap'); }
function ficheSection() {
  if (ficheSec) return ficheSec;
  var main = mainEl(); if (!main) return null;
  ficheSec = document.createElement('section'); ficheSec.id = 'evenement-fiche'; ficheSec.className = 'ev-fiche'; ficheSec.style.display = 'none';
  var panel = main.querySelector('section.panel');
  main.insertBefore(ficheSec, panel ? panel.nextSibling : null);
  return ficheSec;
}
// Objets ou événements : le panneau de recherche reste, le reste de la page suit le mode.
function setMode(m) {
  mode = m;
  var main = mainEl(); if (!main) return;
  Array.from(main.children).forEach(function(el) {
    if (el.tagName === 'HEADER' || el.classList.contains('panel')) return;
    if (el.id === 'evenement-fiche') el.style.display = m === 'evenements' ? '' : 'none';
    else el.style.display = m === 'evenements' ? 'none' : '';
  });
  var box = main.querySelector('.search-box'), res = document.getElementById('search-results'), status = document.getElementById('status'), hint = main.querySelector('p.hint');
  [box, res, status, hint].forEach(function(el) { if (el) el.style.display = m === 'evenements' ? 'none' : ''; });
  var evBox = document.getElementById('ev-search-box'); if (evBox) evBox.style.display = m === 'evenements' ? '' : 'none';
  document.querySelectorAll('.ev-type button').forEach(function(b) { b.classList.toggle('active', b.dataset.type === m); });
  var h1 = main.querySelector('h1.title'), lead = main.querySelector('p.lead');
  if (h1) { if (pageTitle === null) pageTitle = h1.textContent; h1.textContent = m === 'evenements' ? T('fiche.page_title_events') : pageTitle; }
  if (lead) { if (pageLead === null) pageLead = lead.textContent; lead.textContent = m === 'evenements' ? T('fiche.page_lead_events') : pageLead; }
  if (m === 'evenements') { var sec = ficheSection(); if (sec && !sec.innerHTML) sec.innerHTML = '<div class="ev-empty">' + esc(T('fiche.search_empty')) + '</div>'; }
}
function pageRegion() {
  var t = document.querySelector('#country-tabs .country-tab.active');
  var c = t ? t.textContent.trim().toUpperCase() : 'QC';
  return c === 'CAN' ? 'CAN' : (c === 'QC' ? 'QC' : null); // USA : pas d'événements
}
function mountSearch() {
  var main = mainEl(); if (!main) return;
  var title = main.querySelector('section.panel .panel-title');
  if (title && !document.querySelector('.ev-type')) {
    var tog = document.createElement('div'); tog.className = 'ev-type';
    tog.innerHTML = '<button type="button" data-type="objets" class="active">' + esc(T('fiche.type_objects')) + '</button><button type="button" data-type="evenements">' + esc(T('fiche.type_events')) + '</button>';
    title.appendChild(tog);
    tog.addEventListener('click', function(e) { var b = e.target.closest('button'); if (b) setMode(b.dataset.type); });
  }
  var stack = main.querySelector('.search-stack > div');
  if (stack && !document.getElementById('ev-search-box')) {
    var box = document.createElement('div'); box.id = 'ev-search-box'; box.style.display = 'none';
    box.innerHTML = '<div class="search-box"><input id="ev-search" class="search-input" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(T('fiche.search_placeholder')) + '"></div><div id="ev-results" class="ev-results"></div><p class="hint">' + esc(T('fiche.search_hint')) + '</p>';
    stack.appendChild(box);
    document.getElementById('ev-search').addEventListener('input', function() { suggest(this.value); });
  }
  var tabs = document.getElementById('country-tabs');
  if (tabs) tabs.addEventListener('click', function() { if (mode === 'evenements') { var q = document.getElementById('ev-search'); setTimeout(function() { suggest(q ? q.value : ''); }, 0); } });
}
function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function storylines(reg) {
  if (storyCache[reg]) return storyCache[reg];
  storyCache[reg] = Promise.all(years().map(function(y) { return window.radarData.eventsStorylines(reg, y).catch(function() { return null; }); }))
    .then(function(files) { var all = {}; files.forEach(function(f) { if (f && f.storylines) Object.keys(f.storylines).forEach(function(k) { all[k] = f.storylines[k]; }); }); return all; });
  return storyCache[reg];
}
function suggest(q) {
  var out = document.getElementById('ev-results'); if (!out) return;
  var reg = pageRegion();
  if (!reg) { out.innerHTML = '<div class="ev-empty">' + esc(T('fiche.no_usa')) + '</div>'; return; }
  var nq = norm(q.trim()); if (nq.length < 2) { out.innerHTML = ''; return; }
  storylines(reg).then(function(all) {
    var L = lang();
    var hits = Object.keys(all).map(function(id) { var st = all[id]; return { id: id, st: st, text: norm([st.title_last, st.title, st.title_peak, L === 'en' ? st.issue_en : st.issue_fr].join(' ')) }; })
      .filter(function(h) { return h.text.indexOf(nq) !== -1; })
      .sort(function(a, b) { return (b.st.peak || 0) - (a.st.peak || 0); }).slice(0, 12);
    if (!hits.length) { out.innerHTML = '<div class="ev-empty">' + esc(T('fiche.search_none')) + '</div>'; return; }
    out.innerHTML = hits.map(function(h) {
      return '<button type="button" class="ev-result" data-id="' + esc(h.id) + '"><span class="ev-result-title">' + esc(h.st.title_last || h.st.title || h.id) + '</span><span class="ev-result-meta">' + esc(T('fiche.peak')) + ' ' + fmt1(h.st.peak) + ' · ' + esc(h.st.first_key ? u.when(h.st.first_key, L) : '') + '</span></button>';
    }).join('');
    out.querySelectorAll('.ev-result').forEach(function(b) { b.addEventListener('click', function() { select(b.dataset.id, reg); }); });
  });
}
function select(id, reg) {
  sid = id; region = reg;
  var sec = ficheSection(); if (!sec) return;
  setMode('evenements');
  sec.innerHTML = '<div class="ev-loading">' + esc(T('fiche.loading')) + '</div>';
  try { var url = new URL(window.location.href); url.searchParams.set('evenement', id); url.searchParams.set('region', reg); url.searchParams.delete('objet'); history.replaceState(null, '', url.toString()); } catch (e) { /* ignore */ }
  load().then(function(data) { render(sec, data); lastData = data; }).catch(function(e) { console.warn('Fiche événement', e); sec.innerHTML = '<div class="ev-empty">' + esc(T('fiche.not_found')) + '</div>'; });
  sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
var lastData = null;
function load() {
  var rd = window.radarData;
  return Promise.all([rd.eventsIndex().catch(function() { return null; })].concat(years().map(function(y) { return rd.eventsStorylines(region, y).catch(function() { return null; }); })))
    .then(function(res) {
      var idx = res[0], st = null;
      res.slice(1).forEach(function(f) { if (f && f.storylines && f.storylines[sid]) st = f.storylines[sid]; });
      if (!st) return { idx: idx, st: null };
      var dates = {}; [st.first_key, st.peak_key, st.last_key].forEach(function(k) { if (k) dates[k.slice(0, 10)] = true; });
      return Promise.all(Object.keys(dates).map(function(d) { return rd.eventsDay(region, d).then(function(f) { return [d, f]; }).catch(function() { return [d, null]; }); }))
        .then(function(days) { var byDate = {}; days.forEach(function(p) { byDate[p[0]] = p[1]; }); return { idx: idx, st: st, days: byDate }; });
    });
}
function eventAt(days, key) {
  var f = key && days[key.slice(0, 10)]; var evs = f && f.periods && f.periods[key]; if (!evs) return null;
  for (var i = 0; i < evs.length; i++) if (evs[i] && evs[i].storyline === sid) return evs[i];
  return null;
}
function linksHtml(label, ev) {
  if (!ev) return '';
  var arts = (ev.articles || []).filter(function(a) { return a && a.url; });
  var seen = {}; arts = arts.filter(function(a) { if (seen[a.media_id]) return false; seen[a.media_id] = true; return true; });
  if (!arts.length && ev.url) arts = [{ media_id: ev.media || '', url: ev.url, title: ev.title }];
  return '<div class="ev-links-group"><h4>' + esc(label) + ' <span class="ev-when">' + esc(u.blockLabel(ev.period_key || ev.key || '', lang())) + '</span></h4><ul>' +
    arts.map(function(a) { return '<li><span class="ev-media">' + esc(a.media_id || '') + '</span><a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title || a.url) + '</a></li>'; }).join('') + '</ul></div>';
}
function chartSvg(keys, series, cum) {
  var W = 760, H = 220, padL = 36, padR = 10, padT = 10, padB = 28, n = keys.length;
  var maxV = Math.max.apply(null, keys.map(function(k) { return Math.max(series[k] || 0, cum[k] || 0); }).concat([1]));
  var x = function(i) { return padL + (i + 0.5) * (W - padL - padR) / n; }, y = function(v) { return padT + (H - padT - padB) * (1 - v / maxV); };
  var bw = Math.max(2, (W - padL - padR) / n - 2);
  var bars = keys.map(function(k, i) { var v = series[k] || 0; return '<rect x="' + (x(i) - bw / 2) + '" y="' + y(v) + '" width="' + bw + '" height="' + (y(0) - y(v)) + '" rx="1"/>'; }).join('');
  var line = keys.map(function(k, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(cum[k] || 0).toFixed(1); }).join(' ');
  var ticks = [0, 0.5, 1].map(function(f) { var v = maxV * f; return '<text x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text><line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>'; }).join('');
  var step = Math.max(1, Math.ceil(n / 8)), labels = '';
  keys.forEach(function(k, i) { if (i % step === 0 || i === n - 1) labels += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(u.when(k, lang())) + '</text>'; });
  return '<svg class="ev-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img"><g class="grid">' + ticks + '</g><g class="bars">' + bars + '</g><path class="line" d="' + line + '"/><g class="labels">' + labels + '</g></svg>';
}
function render(sec, data) {
  var L = lang(), st = data.st;
  if (!st) { sec.innerHTML = '<div class="ev-empty">' + esc(T('fiche.not_found')) + '</div>'; return; }
  var series = st.series || {}, cum = st.sum24h || {};
  var keys = Object.keys(series).sort(), cumKeys = Object.keys(cum).sort();
  var allKeys = keys.slice(); cumKeys.forEach(function(k) { if (allKeys.indexOf(k) === -1) allKeys.push(k); }); allKeys.sort();
  var lastCumKey = cumKeys[cumKeys.length - 1], cur = lastCumKey ? cum[lastCumKey] : 0;
  var th = data.idx && data.idx.thresholds && data.idx.thresholds[region];
  var b = band(th && th.sum24h, cur), total = keys.reduce(function(m, k) { return m + (Number(series[k]) || 0); }, 0);
  var issue = L === 'en' ? (st.issue_en || st.issue_fr) : (st.issue_fr || st.issue_en);
  var evFirst = eventAt(data.days, st.first_key), evPeak = eventAt(data.days, st.peak_key), evLast = eventAt(data.days, st.last_key);
  if (evFirst) evFirst.period_key = st.first_key; if (evPeak) evPeak.period_key = st.peak_key; if (evLast) evLast.period_key = st.last_key;
  var medias = {}; [evFirst, evPeak, evLast].forEach(function(ev) { (ev && ev.articles || []).forEach(function(a) { if (a && a.media_id) medias[a.media_id] = true; }); }); if (st.media) medias[st.media] = true;
  var tile = function(label, val, sub) { return '<div class="ev-tile"><span class="ev-tile-label">' + esc(label) + '</span><span class="ev-tile-val">' + val + '</span>' + (sub ? '<span class="ev-tile-sub">' + esc(sub) + '</span>' : '') + '</div>'; };
  var html = '<div class="ev-head">' +
      '<div class="ev-top"><span class="ev-band band-' + b + '">' + esc(T('fiche.band_' + b)) + '</span>' + (issue ? '<span class="ev-issue">' + esc(issue) + '</span>' : '') + '<span class="ev-region">' + esc(T('fiche.region_' + region)) + '</span></div>' +
      '<h2 class="ev-title">' + esc(st.title_last || st.title || sid) + '</h2>' +
      (st.title_peak && st.title_peak !== (st.title_last || st.title) ? '<p class="ev-alt">' + esc(T('fiche.title_peak')) + ' : ' + esc(st.title_peak) + '</p>' : '') +
    '</div>' +
    '<div class="ev-tiles">' +
      tile(T('fiche.index24h'), fmt1(cur), lastCumKey ? u.blockLabel(lastCumKey, L) : '') +
      tile(T('fiche.peak'), fmt1(st.peak) + ' <small>' + esc(T('fiche.points')) + '</small>', st.peak_key ? u.blockLabel(st.peak_key, L) : '') +
      tile(T('fiche.since'), esc(st.first_key ? u.when(st.first_key, L) : ''), st.first_key ? u.blockLabel(st.first_key, L) : '') +
      tile(T('fiche.last'), esc(st.last_key ? u.when(st.last_key, L) : ''), st.last_key ? u.blockLabel(st.last_key, L) : '') +
      tile(T('fiche.total'), fmt1(total) + ' <small>' + esc(T('fiche.points')) + '</small>', '') +
      tile(T('fiche.editions'), String(keys.length), '') +
      tile(T('fiche.media'), String(Object.keys(medias).length), Object.keys(medias).sort().join(' ')) +
    '</div>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.chart')) + '</h3><p class="ev-note">' + esc(T('fiche.chart_tip')) + '</p>' + chartSvg(allKeys, series, cum) + '</section>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.links')) + '</h3>' + linksHtml(T('fiche.links_first'), evFirst) + (st.peak_key !== st.first_key ? linksHtml(T('fiche.links_peak'), evPeak) : '') + (st.last_key !== st.peak_key && st.last_key !== st.first_key ? linksHtml(T('fiche.links_last'), evLast) : '') + '</section>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.editions_list')) + '</h3><div class="ev-table-wrap"><table class="ev-table"><thead><tr><th>' + esc(T('fiche.col_edition')) + '</th><th class="num">' + esc(T('fiche.col_index')) + '</th><th class="num">' + esc(T('fiche.col_index24h')) + '</th><th>' + esc(T('fiche.col_title')) + '</th></tr></thead><tbody>' +
      allKeys.slice().reverse().map(function(k) { var ev = eventAt(data.days, k); return '<tr' + (k === st.peak_key ? ' class="peak"' : '') + '><td>' + esc(u.blockLabel(k, L)) + '</td><td class="num">' + (series[k] != null ? fmt1(series[k]) : '—') + '</td><td class="num">' + (cum[k] != null ? fmt1(cum[k]) : '—') + '</td><td>' + (ev ? esc(ev.title || '') : '') + '</td></tr>'; }).join('') +
    '</tbody></table></div></section>' +
    '<p class="ev-foot"><a href="./classement.html?range=24h&country=' + region + '">' + esc(T('fiche.in_ranking')) + '</a></p>';
  sec.innerHTML = html;
}
document.addEventListener('DOMContentLoaded', function() {
  if (!u) return;
  mountSearch();
  ficheSection();
  if (sid) {
    setMode('evenements');
    var sec = ficheSection(); sec.innerHTML = '<div class="ev-loading">' + esc(T('fiche.loading')) + '</div>';
    load().then(function(data) { render(sec, data); lastData = data; }).catch(function(e) { console.warn('Fiche événement', e); sec.innerHTML = '<div class="ev-empty">' + esc(T('fiche.not_found')) + '</div>'; });
  }
  document.addEventListener('i18n:applied', function() { if (lastData && mode === 'evenements') render(ficheSection(), lastData); });
});
})();
