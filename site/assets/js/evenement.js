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
  'fiche.type_label': "Je cherche", 'fiche.type_objects': "un objet (sujet, acteur, lieu)", 'fiche.type_events': "un événement (une histoire)", 'fiche.search_placeholder': "Rechercher un événement (un mot du titre ou du thème)…",
  'fiche.search_empty': "Recherchez un événement pour afficher sa fiche.", 'fiche.search_none': "Aucun événement ne correspond.", 'fiche.search_hint': "Exemples : cycliste, Carney, budget, grève.",
  'fiche.page_title_events': "Statistiques", 'fiche.page_lead_events': "Un événement : son parcours dans les Unes, édition par édition.",
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
  var panel = main.querySelector('section.panel');
  if (panel && !document.querySelector('.ev-type')) {
    // Le choix vient en premier, en grand : « Je cherche : [un objet] [un événement] »
    var tog = document.createElement('div'); tog.className = 'ev-type-row';
    tog.innerHTML = '<span class="ev-type-label">' + esc(T('fiche.type_label')) + '</span><div class="ev-type"><button type="button" data-type="objets" class="active">' + esc(T('fiche.type_objects')) + '</button><button type="button" data-type="evenements">' + esc(T('fiche.type_events')) + '</button></div>';
    panel.insertBefore(tog, panel.firstChild);
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
  return Promise.all([rd.eventsIndex().catch(function() { return null; }), storylines(region)])
    .then(function(res) {
      var idx = res[0], all = res[1] || {}, st = all[sid] || null;
      if (!st) return { idx: idx, st: null };
      // Journées à charger : celles de chaque édition de l'histoire (titres et médias à chaque édition),
      // au plus 45 (les plus récentes, plus la première Une et le sommet) pour les très longues histoires.
      var dates = {}; Object.keys(st.series || {}).forEach(function(k) { dates[k.slice(0, 10)] = true; });
      var must = [st.first_key, st.peak_key, st.last_key].filter(Boolean).map(function(k) { return k.slice(0, 10); });
      var list = Object.keys(dates).sort(); if (list.length > 45) list = list.slice(-42);
      must.forEach(function(d) { if (list.indexOf(d) === -1) list.push(d); });
      return Promise.all(list.map(function(d) { return rd.eventsDay(region, d).then(function(f) { return [d, f]; }).catch(function() { return [d, null]; }); }))
        .then(function(days) { var byDate = {}; days.forEach(function(p) { byDate[p[0]] = p[1]; }); return { idx: idx, st: st, days: byDate, all: all }; });
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
var BAND_COL = { aucune: '#55658a', faible: '#7f93b8', moderee: '#5fa8ff', elevee: '#f2c94c', tres_elevee: '#ff9f43', extreme: '#ff4d4d' };
function eventsAt(days, key) {
  var f = key && days[key.slice(0, 10)]; var evs = f && f.periods && f.periods[key]; if (!evs) return [];
  return evs.filter(function(e) { return e && e.storyline === sid; });
}
function mediaOf(evs) {
  var m = {}; evs.forEach(function(e) { (e.media_ids || []).forEach(function(x) { m[x] = 1; }); (e.articles || []).forEach(function(a) { if (a && a.media_id) m[a.media_id] = 1; }); });
  // Pas e.media ni st.media : ce « média principal » peut venir d'une autre région (CBC sur une histoire québécoise).
  return Object.keys(m).sort();
}
function mtlDay(key) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(u.editionTime(key))); }
function dayNum(ymd) { return Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400e3; }
// Axe continu d'éditions de 4 h, de la première à la dernière : les éditions sans l'histoire valent 0.
function axisKeys(k0, k1) { var out = [], t1 = u.periodStartUtc(k1); for (var t = u.periodStartUtc(k0); t <= t1 && out.length < 2400; t += BLOCK_MS) out.push(u.keyAt(t)); return out; }
function ordinal(n, L) { if (L === 'en') { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); } return n === 1 ? '1re' : n + 'e'; }
function plural(n, one, many) { return T(n === 1 ? one : many, { n: n }); }

// Graphique : barres = points de l'histoire à chaque édition (couleur = niveau de l'édition), ligne = indice 24h.
function chartHtml(axis, series, cum, th, best, liveKey, L) {
  var W = 1000, H = 300, pl = 44, pr = 18, pt = 30, pb = 44, n = axis.length, step = (W - pl - pr) / n;
  var maxV = Math.max(1, Math.max.apply(null, axis.map(function(k) { return Math.max(series[k] || 0, cum[k] || 0); })));
  maxV = Math.ceil(maxV / 10) * 10;
  var x = function(i) { return pl + (i + 0.5) * step; }, y = function(v) { return pt + (H - pt - pb) * (1 - v / maxV); };
  var bw = Math.max(1, Math.min(22, step - (step > 6 ? 2 : 0.5)));
  var grid = [0, 0.25, 0.5, 0.75, 1].map(function(f) { var v = maxV * f; return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text x="' + (pl - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>'; }).join('');
  var bars = axis.map(function(k, i) {
    var v = series[k] || 0; if (!v) return '';
    var b = band(th.block, v), d = Math.min(i * 12, 700);
    return '<rect data-i="' + i + '" x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (y(0) - y(v)).toFixed(1) + '" rx="' + Math.min(3, bw / 3).toFixed(1) + '" fill="' + BAND_COL[b] + '" style="animation-delay:' + d + 'ms"/>';
  }).join('');
  var path = '', area = '', open = false, firstX = null, lastX = null;
  axis.forEach(function(k, i) {
    var v = cum[k];
    if (typeof v !== 'number') { if (open) { area += 'L' + lastX + ' ' + y(0).toFixed(1) + 'Z'; open = false; } return; }
    var px = x(i).toFixed(1), py = y(v).toFixed(1);
    if (!open) { path += 'M' + px + ' ' + py; area += 'M' + px + ' ' + y(0).toFixed(1) + 'L' + px + ' ' + py; open = true; } else { path += 'L' + px + ' ' + py; area += 'L' + px + ' ' + py; }
    lastX = px;
  });
  if (open) area += 'L' + lastX + ' ' + y(0).toFixed(1) + 'Z';
  // Jours : séparateur et étiquette à chaque changement de date (heure de Montréal)
  var days = [], prev = null;
  axis.forEach(function(k, i) { var d = mtlDay(k); if (d !== prev) { days.push({ i: i, d: d }); prev = d; } });
  var every = Math.max(1, Math.ceil(days.length / 10)), loc = L === 'en' ? 'en-CA' : 'fr-CA';
  var dayMarks = days.map(function(o, j) {
    var xx = (pl + o.i * step).toFixed(1), lab = j % every === 0 ? new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(dayNum(o.d) * 86400e3)) : '';
    return (o.i ? '<line class="day" x1="' + xx + '" x2="' + xx + '" y1="' + pt + '" y2="' + (H - pb) + '"/>' : '') + (lab ? '<text x="' + (pl + (o.i + 0.2) * step).toFixed(1) + '" y="' + (H - pb + 18) + '">' + esc(lab) + '</text>' : '');
  }).join('');
  var notes = '';
  var bi = axis.indexOf(best.key);
  if (bi >= 0) { var bx = Math.min(W - pr - 60, Math.max(pl + 60, x(bi))); notes += '<text class="note" x="' + bx.toFixed(1) + '" y="' + (y(best.v) - 9).toFixed(1) + '" text-anchor="middle">' + esc(T('fiche.chart_best')) + '</text>'; }
  var li = liveKey ? axis.indexOf(liveKey) : -1;
  if (li >= 0 && typeof cum[liveKey] === 'number') notes += '<circle class="now" cx="' + x(li).toFixed(1) + '" cy="' + y(cum[liveKey]).toFixed(1) + '" r="5"/><text class="note now-t" x="' + Math.min(W - pr - 4, x(li)).toFixed(1) + '" y="' + (y(cum[liveKey]) - 12).toFixed(1) + '" text-anchor="end">' + esc(T('fiche.chart_now')) + '</text>';
  var svg = '<svg class="ev-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(T('fiche.chart')) + '">' +
    '<defs><linearGradient id="ev-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>' +
    '<g class="grid">' + grid + '</g><g class="days">' + dayMarks + '</g>' +
    '<g class="bars">' + bars + '</g>' +
    '<path class="area" d="' + area + '" fill="url(#ev-area)"/><path class="line" d="' + path + '" pathLength="1"/>' +
    notes + '<line class="cross" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '"/>' +
    '<text class="axis-unit" x="' + (pl - 8) + '" y="' + (pt - 14) + '" text-anchor="end">' + esc(T('fiche.points')) + '</text>' +
    '<rect class="hover" x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (H - pt - pb) + '"/></svg>';
  var legend = '<div class="ev-legend"><span><i class="sw bars"></i>' + esc(T('fiche.legend_bars')) + '</span><span><i class="sw line"></i>' + esc(T('fiche.legend_line')) + '</span>' +
    ['faible', 'moderee', 'elevee', 'tres_elevee', 'extreme'].map(function(b) { return '<span class="lv"><i style="background:' + BAND_COL[b] + '"></i>' + esc(T('fiche.band_' + b).replace(/^Saillance /, '')) + '</span>'; }).join('') + '</div>';
  return '<div class="ev-chart-wrap" data-n="' + n + '" data-pl="' + pl + '" data-pr="' + pr + '" data-w="' + W + '">' + svg + '<div class="ev-tip" hidden></div></div>' + legend;
}
function bindChart(sec, axis, series, cum, th, data, L) {
  var wrap = sec.querySelector('.ev-chart-wrap'); if (!wrap) return;
  var svg = wrap.querySelector('svg'), tip = wrap.querySelector('.ev-tip'), cross = svg.querySelector('.cross'), hover = svg.querySelector('.hover');
  var W = +wrap.dataset.w, pl = +wrap.dataset.pl, pr = +wrap.dataset.pr, n = axis.length, step = (W - pl - pr) / n, last = null;
  function show(e) {
    var r = svg.getBoundingClientRect(), xv = (e.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(n - 1, Math.floor((xv - pl) / step)));
    if (i === last) return place(e, r); last = i;
    var k = axis[i], v = series[k] || 0, c = cum[k], evs = eventsAt(data.days, k), title = evs.length ? (evs[0].title || '') : '', med = mediaOf(evs);
    var cx = (pl + (i + 0.5) * step).toFixed(1); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.classList.add('on');
    svg.querySelectorAll('.bars rect').forEach(function(b) { b.classList.toggle('hl', +b.dataset.i === i); });
    tip.innerHTML = '<div class="t-when">' + esc(u.blockLabel(k, L)) + '</div>' +
      (v ? '<div class="t-row"><span class="ev-band band-' + band(th.block, v) + '">' + esc(T('fiche.band_' + band(th.block, v))) + '</span><b>' + fmt1(v) + '</b> ' + esc(T('fiche.points')) + ' <span class="t-dim">' + esc(T('fiche.tip_edition')) + '</span></div>' : '<div class="t-row t-dim">' + esc(T('fiche.tip_absent')) + '</div>') +
      (typeof c === 'number' ? '<div class="t-row"><b>' + fmt1(c) + '</b> ' + esc(T('fiche.points')) + ' <span class="t-dim">' + esc(T('fiche.tip_24h')) + '</span></div>' : '') +
      (title ? '<div class="t-title">« ' + esc(title) + ' »</div>' : '') +
      (med.length ? '<div class="t-media">' + med.map(function(m) { return '<span class="ev-media">' + esc(m) + '</span>'; }).join('') + '</div>' : '');
    tip.hidden = false; place(e, r);
  }
  function place(e, r) {
    var w = tip.offsetWidth, h = tip.offsetHeight, left = e.clientX - r.left + 16, top = e.clientY - r.top - h - 12;
    if (left + w > r.width) left = e.clientX - r.left - w - 16;
    if (top < 0) top = e.clientY - r.top + 18;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = top + 'px';
  }
  function hide() { tip.hidden = true; cross.classList.remove('on'); last = null; svg.querySelectorAll('.bars rect.hl').forEach(function(b) { b.classList.remove('hl'); }); }
  hover.addEventListener('mousemove', show); hover.addEventListener('mouseleave', hide);
  hover.addEventListener('touchstart', function(e) { if (e.touches[0]) show(e.touches[0]); }, { passive: true });
}
function render(sec, data) {
  var L = lang(), st = data.st;
  if (!st) { sec.innerHTML = '<div class="ev-empty">' + esc(T('fiche.not_found')) + '</div>'; return; }
  var series = st.series || {}, cum = st.sum24h || {};
  var sKeys = Object.keys(series).sort(), cKeys = Object.keys(cum).sort();
  var known = sKeys.concat(cKeys).sort(), axis = known.length ? axisKeys(known[0], known[known.length - 1]) : [];
  var th = (data.idx && data.idx.thresholds && data.idx.thresholds[region]) || {};
  var latestKey = data.idx && data.idx.latest_period && data.idx.latest_period[region];
  var lastCumKey = cKeys[cKeys.length - 1], live = !!(lastCumKey && latestKey && lastCumKey === latestKey);
  var cur = live ? cum[lastCumKey] : 0;
  var peak24 = { v: 0, key: null }; cKeys.forEach(function(k) { if (cum[k] > peak24.v) peak24 = { v: cum[k], key: k }; });
  var best = { v: 0, key: null }; sKeys.forEach(function(k) { if (series[k] > best.v) best = { v: series[k], key: k }; });
  var total = sKeys.reduce(function(m, k) { return m + (Number(series[k]) || 0); }, 0);
  var medias = {}; sKeys.forEach(function(k) { mediaOf(eventsAt(data.days, k)).forEach(function(m) { medias[m] = 1; }); });
  var mediaList = Object.keys(medias).sort();
  var firstKey = st.first_key || sKeys[0], lastKey = st.last_key || sKeys[sKeys.length - 1];
  var nDays = (firstKey && lastKey) ? dayNum(mtlDay(lastKey)) - dayNum(mtlDay(firstKey)) + 1 : 0;
  // Rang au classement de l'année (points cumulés dans l'année, comme la page Classement)
  var year = (lastKey || '').slice(0, 4), totals = [];
  Object.keys(data.all || {}).forEach(function(id) { var s = data.all[id].series || {}, t = 0; Object.keys(s).forEach(function(k) { if (k.slice(0, 4) === year) t += Number(s[k]) || 0; }); if (t > 0) totals.push({ id: id, t: t }); });
  var myYear = 0; Object.keys(series).forEach(function(k) { if (k.slice(0, 4) === year) myYear += Number(series[k]) || 0; });
  var rank = 1 + totals.filter(function(o) { return o.t > myYear + 1e-9; }).length;
  var issue = L === 'en' ? (st.issue_en || st.issue_fr) : (st.issue_fr || st.issue_en);
  var evFirst = eventAt(data.days, st.first_key), evPeak = eventAt(data.days, st.peak_key), evLast = eventAt(data.days, st.last_key);
  if (evFirst) evFirst.period_key = st.first_key; if (evPeak) evPeak.period_key = st.peak_key; if (evLast) evLast.period_key = st.last_key;
  var when = function(k, now) { return u.editionWhen ? u.editionWhen(k, L, now) : u.when(k, L); };
  // Titre en tête : celui de la meilleure édition (Adrien, 1er nov. 2026) ; le dernier titre en sous-ligne.
  var evBest = eventsAt(data.days, best.key);
  var bestTitle = (evBest.length ? evBest.slice().sort(function(a, b) { return (b.index || 0) - (a.index || 0); })[0].title : '') || st.title_peak || st.title_last || st.title || sid;
  var lastTitle = st.title_last || st.title || '';
  var b24 = live ? band(th.sum24h, cur) : 'aucune', bPeak = band(th.sum24h, peak24.v), bBest = band(th.block, best.v);
  var B = function(v) { return '<b>' + esc(v) + '</b>'; };
  var story = T('fiche.story_since', { since: esc(when(firstKey)), editions: B(plural(sKeys.length, 'fiche.n_edition', 'fiche.n_editions')), days: B(plural(nDays, 'fiche.n_day', 'fiche.n_days')), media: B(plural(mediaList.length, 'fiche.n_medium', 'fiche.n_media')) }) + ' ' +
    T('fiche.story_peak', { when: esc(when(best.key)), pts: B(fmt1(best.v) + ' ' + T('fiche.points')) }) + ' ' +
    (live ? T('fiche.story_now', { pts: B(fmt1(cur) + ' ' + T('fiche.points')) }) : T('fiche.story_out', { when: esc(when(lastKey)) }));
  var metric = function(label, tagBand, tagText, val, sub) {
    return '<div class="ev-metric"><span class="ev-m-label">' + esc(label) + '</span><span class="ev-band band-' + tagBand + '">' + esc(tagText) + '</span>' +
      (val ? '<span class="ev-m-val">' + val + '</span>' : '') + (sub ? '<span class="ev-m-sub">' + esc(sub) + '</span>' : '') + '</div>';
  };
  var artUrl = u.artUrl ? u.artUrl(sid) : '';
  var artHtml = artUrl ? '<figure class="ev-art"><img src="' + esc(artUrl) + '" alt="" onload="this.parentNode.classList.add(\'ok\')" onerror="this.parentNode.remove()"><span class="aune-art-i" tabindex="0" aria-label="' + esc(T('aune.art_info')) + '">i</span><figcaption>' + esc(T('aune.art_credit')) + '</figcaption></figure>' : '';
  var html = '<div class="ev-head">' + artHtml +
      '<div class="ev-top">' + (issue ? '<span class="ev-issue">' + esc(issue) + '</span>' : '') + '<span class="ev-region">' + esc(T('fiche.region_' + region)) + '</span></div>' +
      '<h2 class="ev-title">' + esc(bestTitle) + '</h2>' +
      (lastTitle && lastTitle !== bestTitle ? '<p class="ev-alt">' + esc(T('fiche.title_last')) + ' : ' + esc(lastTitle) + '</p>' : '') +
    '</div>' +
    '<div class="ev-hero">' +
      '<a class="ev-hero-num" href="./classement.html?range=year&country=' + region + '">' +
        '<span class="ev-big">' + fmt1(total) + '</span><span class="ev-big-unit">' + esc(T('fiche.points_cumul')) + '</span>' +
        '<span class="ev-rank">' + T('fiche.rank_line', { rank: esc(ordinal(rank, L)), year: esc(year), region: esc(T('fiche.region_' + region)), n: esc(String(totals.length)) }) + '</span>' +
      '</a>' +
      '<p class="ev-story">' + story + '</p>' +
    '</div>' +
    '<div class="ev-metrics">' +
      (live ? metric(T('fiche.m_now'), b24, T('fiche.band_' + b24), '<b>' + fmt1(cur) + '</b> ' + esc(T('fiche.points')), T('fiche.m_now_sub'))
            : metric(T('fiche.m_now'), 'aucune', T('fiche.m_out'), '', T('fiche.m_out_sub', { when: when(lastKey) }))) +
      metric(T('fiche.m_peak'), bPeak, T('fiche.band_' + bPeak), '<b>' + fmt1(peak24.v) + '</b> ' + esc(T('fiche.points')), T('fiche.m_peak_sub', { when: when(peak24.key, live && peak24.key === lastCumKey) })) +
      metric(T('fiche.m_best'), bBest, T('fiche.band_' + bBest), '<b>' + fmt1(best.v) + '</b> ' + esc(T('fiche.points')), when(best.key)) +
      '<div class="ev-metric ev-metric-media"><span class="ev-m-label">' + esc(T('fiche.m_media')) + '</span><span class="ev-chips">' + mediaList.map(function(m) { return '<span class="ev-media">' + esc(m) + '</span>'; }).join('') + '</span></div>' +
    '</div>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.chart')) + '</h3><p class="ev-note">' + esc(T('fiche.chart_tip')) + '</p>' + chartHtml(axis, series, cum, th, best, live ? lastCumKey : null, L) + '</section>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.links')) + '</h3>' + linksHtml(T('fiche.links_first'), evFirst) + (st.peak_key !== st.first_key ? linksHtml(T('fiche.links_peak'), evPeak) : '') + (st.last_key !== st.peak_key && st.last_key !== st.first_key ? linksHtml(T('fiche.links_last'), evLast) : '') + '</section>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.editions_list')) + '</h3><div class="ev-table-wrap"><table class="ev-table"><thead><tr><th>' + esc(T('fiche.col_edition')) + '</th><th class="num">' + esc(T('fiche.col_index')) + '</th><th class="num">' + esc(T('fiche.col_index24h')) + '</th><th>' + esc(T('fiche.col_title')) + '</th></tr></thead><tbody>' +
      known.filter(function(k, i) { return known.indexOf(k) === i; }).reverse().map(function(k) { var ev = eventAt(data.days, k); return '<tr' + (k === best.key ? ' class="peak"' : '') + '><td>' + esc(u.blockLabel(k, L)) + '</td><td class="num">' + (series[k] != null ? fmt1(series[k]) : '—') + '</td><td class="num">' + (cum[k] != null ? fmt1(cum[k]) : '—') + '</td><td>' + (ev ? esc(ev.title || '') : '') + '</td></tr>'; }).join('') +
    '</tbody></table></div></section>' +
    '<p class="ev-foot"><a href="./classement.html?range=24h&country=' + region + '">' + esc(T('fiche.in_ranking')) + '</a></p>';
  sec.innerHTML = html;
  bindChart(sec, axis, series, cum, th, data, L);
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
