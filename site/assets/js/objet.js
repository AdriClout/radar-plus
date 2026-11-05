/* Fiche d'un objet (sujet, acteur, lieu) — page Statistiques, ?objet=<id>&pays=QC|CAN|USA.
   Même fiche que celle des événements (evenement.js, evenement.css) : un chiffre-vedette et une phrase,
   les niveaux, les meilleures positions dans chaque classement, le parcours édition par édition, les
   Unes par les liens, toutes les éditions et les boutons vers les outils (Adrien, 1er nov. 2026 : « on a
   beaucoup amélioré les pages de stats d'événement, je pensais qu'on avait fait pareil pour les objets »).
   Sources : la série publiée (radarData.timeseries() : indice de l'objet à chaque édition, rang dans
   l'édition, nombre de manchettes, paliers du pays) et articles/{pays}/{date}.json (liens et médias).
   On ne reproduit jamais le texte des articles : seulement leurs titres et leurs liens.
   statistiques.html appelle window.RadarObjet.show(pays, objet, série) à la sélection. */
(function() {
'use strict';
var BLOCK_MS = 4 * 3600e3, MAX_DAYS = 40, RECENT_DAYS = 30;
var BANDS = ['faible', 'moderee', 'elevee', 'tres_elevee', 'extreme'];
var BAND_COL = { faible: '#7f93b8', moderee: '#5fa8ff', elevee: '#f2c94c', tres_elevee: '#ff9f43', extreme: '#ff4d4d' };
var FALLBACK = {
  'obj.points_cumul': 'points cumulés', 'obj.rank_line': '<b>{rank}</b> au classement {year} · {region}<br>sur {n} objets',
  'obj.story_first': "Première Une à l'{when} : {editions} en Une sur {days}", 'obj.story_media': ', dans {media}',
  'obj.story_peak': "Sommet à l'{when}, avec {pts} en une seule édition.",
  'obj.story_now': 'Toujours en Une à la dernière édition, avec {pts}.', 'obj.story_out': "Absent des Unes depuis l'{when}.",
  'obj.m_now': 'Actuellement', 'obj.m_now_sub': 'à la dernière édition · {rank} sur {n}', 'obj.m_out': 'Hors des Unes', 'obj.m_out_sub': "depuis l'{when}",
  'obj.m_best': 'Meilleure édition', 'obj.m_best_sub': '{when} · {rank} sur {n}', 'obj.m_streak': 'Plus longue présence',
  'obj.m_streak_val': '{n} éditions d’affilée', 'obj.m_streak_sub': 'jusqu’à l’{when}',
  'obj.m_media': 'Médias qui l’ont mis en Une', 'obj.m_media_recent': 'Médias, {n} derniers jours en Une',
  'obj.records_note': 'Le meilleur rang tenu dans chaque classement des objets, et quand. Cliquez pour ouvrir ce classement.',
  'obj.rec_h24': 'Édition', 'obj.chart': 'Son parcours dans les Unes',
  'obj.chart_tip': "Chaque barre : l'indice de l'objet à une édition de 4 heures, coloré selon son palier dans le pays. Survolez pour lire une édition.",
  'obj.legend_bars': "indice de l'édition", 'obj.tip_rank': '{rank} sur {n} objets', 'obj.tip_heads': '{n} manchettes',
  'obj.tip_absent': 'Pas en Une à cette édition', 'obj.col_rank': 'Rang', 'obj.col_heads': 'Manchettes',
  'obj.links_first': 'Première Une', 'obj.links_peak': 'À sa meilleure édition', 'obj.links_last': 'Dernière Une',
  'obj.links_none': 'Liens indisponibles pour cette édition.', 'obj.not_found': 'Objet introuvable dans les données publiées.',
  'obj.editions_more': 'Voir les {n} éditions', 'obj.region_USA': 'États-Unis',
  'obj.band_below': 'Sous le palier modéré', 'obj.legend_below': 'sous modéré'
};
function T(k, v) {
  var t = window.t ? window.t(k, v) : null;
  if (t && t !== k) return t;
  var f = FALLBACK[k]; if (f == null && window.t) { var e = window.t(k.replace(/^obj\./, 'fiche.'), v); if (e && e.indexOf('fiche.') !== 0) return e; }
  return String(f == null ? k : f).replace(/\{(\w+)\}/g, function(m, n) { return v && v[n] != null ? v[n] : m; });
}
var u = null, sec = null, last = null;
function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
function lang() { return (document.documentElement.lang || 'fr').slice(0, 2); }
function fmt1(v) { return (Number(v) || 0).toFixed(1); }
function nameOf(id) { return String(id || '').replace(/(^|\s)\S/g, function(c) { return c.toUpperCase(); }); }
function ordinal(n, L) { if (L === 'en') { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); } return n === 1 ? '1er' : n + 'e'; }
function plural(n, one, many) { return T(n === 1 ? one : many, { n: n }); }
function regionName(c) { return c === 'USA' ? T('obj.region_USA') : T('fiche.region_' + c); }
// Paliers des objets (méthodologie § 11) : modéré p50, élevé p80, très élevé p95, extrême p99 des pics 4 h du pays.
function band(tiers, v) {
  if (!tiers || !(v > 0)) return 'faible';
  if (v >= tiers.extreme) return 'extreme'; if (v >= tiers.very_high) return 'tres_elevee';
  if (v >= tiers.high) return 'elevee'; if (v >= tiers.moderate) return 'moderee'; return 'faible';
}
// Sous p50, les paliers des objets n'ont pas de nom (méthodologie § 11) : « Sous le palier modéré », pas « faible ».
function bandLabel(b) { return b === 'faible' ? T('obj.band_below') : T('fiche.band_' + b); }
function when(k, now) { return u.editionWhen ? u.editionWhen(k, lang(), now) : u.blockLabel(k, lang()); }
function mtlDay(k) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(u.editionTime(k))); }
function dayNum(ymd) { return Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86400e3; }
// Axe continu d'éditions de 4 h, de la première à la dernière. Il suit les éditions réellement publiées
// (`known`) : au changement d'heure, la grille des blocs glisse d'une heure, et un pas fixe de 4 h
// perdait les éditions d'après (vu le 1er nov. 2026). Entre deux éditions connues : pas de 4 h, valeur 0.
function axisKeys(k0, k1, known) {
  var ks = (known || []).filter(function(k, i, a) { return a.indexOf(k) === i; }).sort(), out = [], j = 0, H = 3600e3;
  var t = u.periodStartUtc(k0), t1 = u.periodStartUtc(k1);
  while (t <= t1 + 2 * H && out.length < 4000) {
    while (j < ks.length && u.periodStartUtc(ks[j]) < t - 2 * H) j++;
    if (j < ks.length && u.periodStartUtc(ks[j]) < t + 3 * H) { out.push(ks[j]); t = u.periodStartUtc(ks[j]) + BLOCK_MS; j++; }
    else if (t <= t1) { out.push(u.keyAt(t)); t += BLOCK_MS; }
    else break;
  }
  return out;
}

function section() {
  if (sec) return sec;
  var main = document.querySelector('main.wrap'); if (!main) return null;
  sec = document.createElement('section'); sec.id = 'objet-fiche'; sec.className = 'ev-fiche';
  var panel = main.querySelector('section.panel');
  main.insertBefore(sec, panel ? panel.nextSibling : null);
  return sec;
}

// ── Lecture de la série : l'objet à chaque édition (indice, rang, manchettes) ──
function collect(ts, country, id) {
  var graphs = (ts && ts.graphs && ts.graphs[country]) || {};
  var keys = ((ts && ts.meta && ts.meta.periods) || []).map(function(p) { return p.key; }).sort();
  var at = {};
  keys.forEach(function(k) {
    var nodes = (graphs[k] && graphs[k].nodes) || [];
    for (var i = 0; i < nodes.length; i++) if (nodes[i].id === id) { at[k] = { v: Number(nodes[i].size) || 0, rank: i + 1, of: nodes.length, n: nodes[i].n }; break; }
  });
  return { keys: keys, at: at, graphs: graphs, latestKey: keys[keys.length - 1] || null, tiers: ts && ts.meta && ts.meta.salience_tiers && ts.meta.salience_tiers[country] };
}

// ── Meilleures positions : mêmes vues que le Classement des objets (une édition, jour, semaine, mois, année).
// Jour = éditions sorties ce jour-là (début du bloc + 5 h, heure de Montréal) ; semaine ISO, lundi.
var REC_LAG = 5 * 3600e3, REC_DAY = 864e5;
var recDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit' });
function recDay(k) { return recDayFmt.format(new Date(u.periodStartUtc(k) + REC_LAG)); }
function recDayNum(d) { return Math.round(Date.parse(d + 'T12:00:00Z') / REC_DAY); }
function recMonday(d) { var t = Date.parse(d + 'T12:00:00Z'), wd = (new Date(t).getUTCDay() + 6) % 7; return new Date(t - wd * REC_DAY).toISOString().slice(0, 10); }
function rankings(col, id) {
  var sums = { day: {}, week: {}, month: {}, year: {} }, out = { h24: null }, mine = {};
  col.keys.forEach(function(k) {
    var nodes = (col.graphs[k] && col.graphs[k].nodes) || []; if (!nodes.length) return;
    var d = recDay(k), b = { day: d, week: recMonday(d), month: d.slice(0, 7), year: d.slice(0, 4) };
    nodes.forEach(function(n) { var v = Number(n.size) || 0; if (!v) return; Object.keys(b).forEach(function(g) { var m = sums[g][b[g]] || (sums[g][b[g]] = {}); m[n.id] = (m[n.id] || 0) + v; }); });
    var a = col.at[k];
    if (a && (!out.h24 || a.rank < out.h24.rank)) out.h24 = { rank: a.rank, n: nodes.length, bucket: k, times: 1 };
    else if (a && out.h24 && a.rank === out.h24.rank) { out.h24.times++; out.h24.bucket = k; out.h24.n = nodes.length; }
  });
  Object.keys(sums).forEach(function(g) {
    var best = null;
    Object.keys(sums[g]).sort().forEach(function(b) {
      var m = sums[g][b], v = m[id]; if (!v) return;
      var r = 1, n = 0; Object.keys(m).forEach(function(x) { n++; if (m[x] > v + 1e-9) r++; });
      if (g === 'year') mine[b] = { rank: r, n: n };
      if (!best || r < best.rank) best = { rank: r, n: n, bucket: b, times: 1 };
      else if (r === best.rank) { best.times++; best.bucket = b; best.n = n; }
    });
    out[g] = best;
  });
  out.yearRanks = mine;
  return out;
}
function recordsHtml(rec, col, country, L) {
  var loc = L === 'en' ? 'en-CA' : 'fr-CA', today = recDayFmt.format(new Date());
  var fmt = function(d, o) { return new Intl.DateTimeFormat(loc, Object.assign({ timeZone: 'UTC' }, o)).format(new Date(d + 'T12:00:00Z')); };
  var latestT = col.latestKey ? u.periodStartUtc(col.latestKey) : null;
  var defs = [
    { g: 'h24', range: '24h', label: function(b) { return when(b); }, off: function(b) { return latestT === null ? 0 : Math.round((u.periodStartUtc(b) - latestT) / BLOCK_MS); } },
    { g: 'day', range: 'today', label: function(b) { return fmt(b, { weekday: 'long', day: 'numeric', month: 'long' }); }, off: function(b) { return recDayNum(b) - recDayNum(today); } },
    { g: 'week', range: 'week', label: function(b) { var e = new Date(Date.parse(b + 'T12:00:00Z') + 6 * REC_DAY).toISOString().slice(0, 10); return fmt(b, { day: 'numeric', month: 'short' }) + ' – ' + fmt(e, { day: 'numeric', month: 'short' }); }, off: function(b) { return Math.round((recDayNum(b) - recDayNum(recMonday(today))) / 7); } },
    { g: 'month', range: 'month', label: function(b) { return fmt(b + '-15', { month: 'long', year: 'numeric' }); }, off: function(b) { return (+b.slice(0, 4) * 12 + +b.slice(5, 7)) - (+today.slice(0, 4) * 12 + +today.slice(5, 7)); } },
    { g: 'year', range: 'year', label: function(b) { return b; }, off: function(b) { return +b - +today.slice(0, 4); } }
  ];
  return '<div class="ev-records">' + defs.map(function(d) {
    var r = rec[d.g]; if (!r) return '';
    var off = Math.min(0, d.off(r.bucket));
    var href = './classement.html?type=objets&range=' + d.range + '&country=' + country + (off ? '&offset=' + off : '');
    var lab = d.label(r.bucket); if (u.fr1er) lab = u.fr1er(lab, L);
    return '<a class="ev-rec' + (r.rank === 1 ? ' gold' : r.rank <= 3 ? ' podium' : '') + '" href="' + href + '">' +
      '<span class="ev-rec-label">' + esc(d.g === 'h24' ? T('obj.rec_h24') : T('fiche.rec_' + d.g)) + '</span>' +
      '<span class="ev-rec-rank">' + esc(ordinal(r.rank, L)) + '<span class="ev-rec-of">' + esc(T('fiche.rec_of', { n: r.n })) + '</span></span>' +
      '<span class="ev-rec-when">' + esc(lab) + (r.times > 1 ? ' · ' + esc(T('fiche.rec_times', { n: r.times })) : '') + '</span>' +
    '</a>';
  }).join('') + '</div>';
}

// ── Graphique : une barre par édition de 4 h, de la première à la dernière apparition (0 sans l'objet) ──
function chartHtml(axis, col, best, live, L) {
  var W = 1000, H = 300, pl = 44, pr = 18, pt = 30, pb = 44, n = axis.length, step = (W - pl - pr) / Math.max(1, n);
  var maxV = Math.max(1, best.v); maxV = Math.ceil(maxV / 10) * 10;
  var x = function(i) { return pl + (i + 0.5) * step; }, y = function(v) { return pt + (H - pt - pb) * (1 - v / maxV); };
  var bw = Math.max(0.8, Math.min(22, step - (step > 6 ? 2 : 0.3)));
  var grid = [0, 0.25, 0.5, 0.75, 1].map(function(f) { var v = maxV * f; return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text x="' + (pl - 8) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>'; }).join('');
  var bars = axis.map(function(k, i) {
    var a = col.at[k]; if (!a || !a.v) return '';
    var d = Math.min(Math.round(i * 700 / Math.max(1, n)), 700);
    return '<rect data-i="' + i + '" x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + y(a.v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (y(0) - y(a.v)).toFixed(1) + '" rx="' + Math.min(3, bw / 3).toFixed(1) + '" fill="' + BAND_COL[band(col.tiers, a.v)] + '" style="animation-delay:' + d + 'ms"/>';
  }).join('');
  // Repères de jours : séparateurs sur les courtes périodes, étiquettes espacées sur les longues.
  var days = [], prev = null;
  axis.forEach(function(k, i) { var dd = mtlDay(k); if (dd !== prev) { days.push({ i: i, d: dd }); prev = dd; } });
  var every = Math.max(1, Math.ceil(days.length / 10)), loc = L === 'en' ? 'en-CA' : 'fr-CA';
  var fmtO = days.length > 14 ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric' };
  var marks = days.map(function(o, j) {
    var xx = (pl + o.i * step).toFixed(1), lab = j % every === 0 ? new Intl.DateTimeFormat(loc, Object.assign({ timeZone: 'UTC' }, fmtO)).format(new Date(dayNum(o.d) * 86400e3)) : '';
    return (o.i && days.length <= 31 ? '<line class="day" x1="' + xx + '" x2="' + xx + '" y1="' + pt + '" y2="' + (H - pb) + '"/>' : '') + (lab ? '<text x="' + (pl + (o.i + 0.2) * step).toFixed(1) + '" y="' + (H - pb + 18) + '">' + esc(lab) + '</text>' : '');
  }).join('');
  var notes = '', bi = axis.indexOf(best.key);
  if (bi >= 0) { var bx = Math.min(W - pr - 60, Math.max(pl + 60, x(bi))); notes += '<text class="note" x="' + bx.toFixed(1) + '" y="' + (y(best.v) - 9).toFixed(1) + '" text-anchor="middle">' + esc(T('fiche.chart_best')) + '</text>'; }
  if (live) { var li = axis.indexOf(col.latestKey), lv = col.at[col.latestKey].v; notes += '<circle class="now" cx="' + x(li).toFixed(1) + '" cy="' + y(lv).toFixed(1) + '" r="5"/><text class="note now-t" x="' + Math.min(W - pr - 4, x(li)).toFixed(1) + '" y="' + (y(lv) - 12).toFixed(1) + '" text-anchor="end">' + esc(T('fiche.chart_now')) + '</text>'; }
  var svg = '<svg class="ev-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(T('obj.chart')) + '">' +
    '<g class="grid">' + grid + '</g><g class="days">' + marks + '</g><g class="bars">' + bars + '</g>' + notes +
    '<line class="cross" x1="0" x2="0" y1="' + pt + '" y2="' + (H - pb) + '"/>' +
    '<text class="axis-unit" x="' + (pl - 8) + '" y="' + (pt - 14) + '" text-anchor="end">' + esc(T('fiche.points')) + '</text>' +
    '<rect class="hover" x="' + pl + '" y="' + pt + '" width="' + (W - pl - pr) + '" height="' + (H - pt - pb) + '"/></svg>';
  var legend = '<div class="ev-legend"><span><i class="sw bars"></i>' + esc(T('obj.legend_bars')) + '</span>' +
    BANDS.map(function(b) { return '<span class="lv"><i style="background:' + BAND_COL[b] + '"></i>' + esc(b === 'faible' ? T('obj.legend_below') : T('fiche.band_' + b).replace(/^Saillance | salience$/i, '')) + '</span>'; }).join('') + '</div>';
  return '<div class="ev-chart-wrap" data-pl="' + pl + '" data-pr="' + pr + '" data-w="' + W + '">' + svg + '<div class="ev-tip" hidden></div></div>' + legend;
}
function bindChart(root, axis, col, L) {
  var wrap = root.querySelector('.ev-chart-wrap'); if (!wrap) return;
  var svg = wrap.querySelector('svg'), tip = wrap.querySelector('.ev-tip'), cross = svg.querySelector('.cross'), hover = svg.querySelector('.hover');
  var W = +wrap.dataset.w, pl = +wrap.dataset.pl, pr = +wrap.dataset.pr, n = axis.length, step = (W - pl - pr) / Math.max(1, n), lastI = null;
  function place(e, r) {
    var w = tip.offsetWidth, h = tip.offsetHeight, left = e.clientX - r.left + 16, top = e.clientY - r.top - h - 12;
    if (left + w > r.width) left = e.clientX - r.left - w - 16;
    if (top < 0) top = e.clientY - r.top + 18;
    tip.style.left = Math.max(0, left) + 'px'; tip.style.top = top + 'px';
  }
  function show(e) {
    var r = svg.getBoundingClientRect(), xv = (e.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(n - 1, Math.floor((xv - pl) / step)));
    if (i === lastI) return place(e, r); lastI = i;
    var k = axis[i], a = col.at[k];
    var cx = (pl + (i + 0.5) * step).toFixed(1); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.classList.add('on');
    svg.querySelectorAll('.bars rect').forEach(function(b) { b.classList.toggle('hl', +b.dataset.i === i); });
    var b = a ? band(col.tiers, a.v) : null;
    tip.innerHTML = '<div class="t-when">' + esc(u.blockLabel(k, L)) + '</div>' +
      (a ? '<div class="t-row"><span class="ev-band band-' + b + '">' + esc(bandLabel(b)) + '</span><b>' + fmt1(a.v) + '</b> ' + esc(T('fiche.points')) + '</div>' +
           '<div class="t-row t-dim">' + esc(T('obj.tip_rank', { rank: ordinal(a.rank, L), n: a.of })) + (a.n ? ' · ' + esc(T('obj.tip_heads', { n: a.n })) : '') + '</div>'
         : '<div class="t-row t-dim">' + esc(T('obj.tip_absent')) + '</div>');
    tip.hidden = false; place(e, r);
  }
  function hide() { tip.hidden = true; cross.classList.remove('on'); lastI = null; svg.querySelectorAll('.bars rect.hl').forEach(function(x) { x.classList.remove('hl'); }); }
  hover.addEventListener('mousemove', show); hover.addEventListener('mouseleave', hide);
  hover.addEventListener('touchstart', function(e) { if (e.touches[0]) show(e.touches[0]); }, { passive: true });
}

// ── Liens et médias : fichiers d'articles des jours où l'objet est en Une (tous jusqu'à 40 jours ; au-delà,
// les 30 derniers, plus ceux de la première Une et de la meilleure édition).
function loadArticles(country, id, col, keysIn, mustKeys) {
  var byDay = {}; keysIn.forEach(function(k) { (byDay[k.slice(0, 10)] = byDay[k.slice(0, 10)] || []).push(k); });
  var days = Object.keys(byDay).sort(), complete = days.length <= MAX_DAYS;
  var list = complete ? days : days.slice(-RECENT_DAYS);
  mustKeys.forEach(function(k) { var d = k && k.slice(0, 10); if (d && list.indexOf(d) === -1) list.push(d); });
  return Promise.all(list.map(function(d) { return window.radarData.articlesDay(country, d).then(function(f) { return [d, f]; }).catch(function() { return [d, null]; }); }))
    .then(function(res) {
      var at = {}, media = {}, recent = {};
      res.forEach(function(p) {
        var f = p[1], per = f && f.periods; if (!per) return;
        Object.keys(per).forEach(function(k) { var arr = per[k] && per[k][id]; if (Array.isArray(arr) && arr.length) at[k] = arr; });
      });
      var counted = complete ? days : days.slice(-RECENT_DAYS);
      counted.forEach(function(d) { (byDay[d] || []).forEach(function(k) { (at[k] || []).forEach(function(a) { if (a && a.media_id) media[a.media_id] = 1; }); }); });
      return { at: at, media: Object.keys(media).sort(), complete: complete, nRecent: counted.length };
    });
}
function linksHtml(label, key, arts, L) {
  if (!key) return '';
  var seen = {}, list = (arts || []).filter(function(a) { if (!a || !a.url || seen[a.url]) return false; seen[a.url] = 1; return true; });
  return '<div class="ev-links-group"><h4>' + esc(label) + ' <span class="ev-when">' + esc(u.blockLabel(key, L)) + '</span></h4>' +
    (list.length ? '<ul>' + list.map(function(a) { return '<li><span class="ev-media">' + esc(a.media_id || '') + '</span><a href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.title || a.url) + '</a></li>'; }).join('') + '</ul>'
                 : '<p class="ev-note">' + esc(T('obj.links_none')) + '</p>') + '</div>';
}
function toolsHtml(country, id) {
  var sym = function(p) { return window.radarSymbol ? window.radarSymbol(p) : ''; };
  var c = encodeURIComponent(country), o = encodeURIComponent(id), usa = country === 'USA';
  // Au Québec et au Canada, les alertes portent sur les histoires ; aux États-Unis, sur les objets.
  var tools = [
    { p: 'constellation', href: './constellation.html?country=' + c + '&node=' + o, sub: T('fiche.tool_constellation_sub_obj') },
    { p: 'evolution', href: './evolution.html?country=' + c + '&node=' + o, sub: T('fiche.tool_evolution_sub_obj') },
    { p: 'alertes', href: './alertes.html?region=' + c + (usa ? '&objet=' + o : ''), sub: T(usa ? 'fiche.tool_alertes_sub_obj' : 'fiche.tool_alertes_sub_region') },
    { p: 'classement', href: './classement.html?type=objets&range=year&country=' + c, sub: T('fiche.tool_classement_sub_obj') }
  ];
  return '<section class="ev-section"><h3>' + esc(T('fiche.tools_obj')) + '</h3><div class="tool-btns">' + tools.map(function(t) {
    return '<a class="tool-btn" href="' + t.href + '"><span class="tool-btn-sym">' + sym(t.p) + '</span><span class="tool-btn-txt"><span class="tool-btn-name">' + esc(T('fiche.tool_' + t.p)) + '</span><span class="tool-btn-sub">' + esc(t.sub) + '</span></span><span class="tool-btn-go">→</span></a>';
  }).join('') + '</div></section>';
}

function render(d) {
  var L = lang(), col = d.col, id = d.id, country = d.country, root = section(); if (!root) return;
  var keysIn = col.keys.filter(function(k) { return col.at[k] && col.at[k].v > 0; });
  if (!keysIn.length) { root.innerHTML = '<div class="ev-empty">' + esc(T('obj.not_found')) + '</div>'; return; }
  var firstKey = keysIn[0], lastKey = keysIn[keysIn.length - 1];
  var best = { v: 0, key: null }; keysIn.forEach(function(k) { if (col.at[k].v > best.v) best = { v: col.at[k].v, key: k }; });
  var total = keysIn.reduce(function(m, k) { return m + col.at[k].v; }, 0);
  var live = !!(col.latestKey && col.at[col.latestKey]);
  var nDays = dayNum(mtlDay(lastKey)) - dayNum(mtlDay(firstKey)) + 1;
  // Plus longue présence : éditions consécutives dans la grille publiée.
  var streak = { n: 0, end: null }, run = 0; col.keys.forEach(function(k) { if (col.at[k]) { run++; if (run > streak.n) streak = { n: run, end: k }; } else run = 0; });
  var rec = rankings(col, id), year = recDay(col.latestKey || lastKey).slice(0, 4), yr = rec.yearRanks[year] || rec.yearRanks[recDay(lastKey).slice(0, 4)] || null;
  var art = d.art || { at: {}, media: [], complete: false, nRecent: 0 };
  var B = function(v) { return '<b>' + esc(v) + '</b>'; };
  var story = T('obj.story_first', { when: esc(when(firstKey)), editions: B(plural(keysIn.length, 'fiche.n_edition', 'fiche.n_editions')), days: B(plural(nDays, 'fiche.n_day', 'fiche.n_days')) }) +
    (art.complete && art.media.length ? T('obj.story_media', { media: B(plural(art.media.length, 'fiche.n_medium', 'fiche.n_media')) }) : '') + '. ' +
    T('obj.story_peak', { when: esc(when(best.key)), pts: B(fmt1(best.v) + ' ' + T('fiche.points')) }) + ' ' +
    (live ? T('obj.story_now', { pts: B(fmt1(col.at[col.latestKey].v) + ' ' + T('fiche.points')) }) : T('obj.story_out', { when: esc(when(lastKey)) }));
  var metric = function(label, tagBand, tagText, val, sub) {
    return '<div class="ev-metric"><span class="ev-m-label">' + esc(label) + '</span>' + (tagText ? '<span class="ev-band band-' + tagBand + '">' + esc(tagText) + '</span>' : '') +
      (val ? '<span class="ev-m-val">' + val + '</span>' : '') + (sub ? '<span class="ev-m-sub">' + esc(sub) + '</span>' : '') + '</div>';
  };
  var now = live ? col.at[col.latestKey] : null, bNow = now ? band(col.tiers, now.v) : 'aucune', bBest = band(col.tiers, best.v), bestA = col.at[best.key];
  var editions = keysIn.slice().reverse(), SHOW = 60;
  var rowHtml = function(k) { var a = col.at[k]; return '<tr' + (k === best.key ? ' class="peak"' : '') + '><td>' + esc(u.blockLabel(k, L)) + '</td><td class="num">' + fmt1(a.v) + '</td><td class="num">' + esc(ordinal(a.rank, L)) + ' / ' + a.of + '</td><td class="num">' + (a.n != null ? a.n : '—') + '</td></tr>'; };
  var html = '<div class="ev-head">' +
      '<div class="ev-top"><span class="ev-region">' + esc(regionName(country)) + '</span></div>' +
      '<h2 class="ev-title">' + esc(nameOf(id)) + '</h2>' +
    '</div>' +
    '<div class="ev-hero">' +
      '<a class="ev-hero-num" href="./classement.html?type=objets&range=year&country=' + country + '">' +
        '<span class="ev-big">' + fmt1(total) + '</span><span class="ev-big-unit">' + esc(T('obj.points_cumul')) + '</span>' +
        (yr ? '<span class="ev-rank">' + T('obj.rank_line', { rank: esc(ordinal(yr.rank, L)), year: esc(year), region: esc(regionName(country)), n: esc(String(yr.n)) }) + '</span>' : '') +
      '</a>' +
      '<p class="ev-story">' + story + '</p>' +
    '</div>' +
    '<div class="ev-metrics">' +
      (live ? metric(T('obj.m_now'), bNow, bandLabel(bNow), '<b>' + fmt1(now.v) + '</b> ' + esc(T('fiche.points')), T('obj.m_now_sub', { rank: ordinal(now.rank, L), n: now.of }))
            : metric(T('obj.m_now'), 'aucune', T('obj.m_out'), '', T('obj.m_out_sub', { when: when(lastKey) }))) +
      metric(T('obj.m_best'), bBest, bandLabel(bBest), '<b>' + fmt1(best.v) + '</b> ' + esc(T('fiche.points')), T('obj.m_best_sub', { when: when(best.key, live && best.key === col.latestKey), rank: ordinal(bestA.rank, L), n: bestA.of })) +
      metric(T('obj.m_streak'), '', '', '<b>' + streak.n + '</b> ' + esc(streak.n === 1 ? T('fiche.n_edition', { n: '' }).trim() : T('fiche.n_editions', { n: '' }).trim()), T('obj.m_streak_sub', { when: when(streak.end) })) +
      '<div class="ev-metric ev-metric-media"><span class="ev-m-label">' + esc(art.complete ? T('obj.m_media') : T('obj.m_media_recent', { n: art.nRecent })) + '</span><span class="ev-chips">' +
        (d.art ? art.media.map(function(m) { return '<span class="ev-media">' + esc(m) + '</span>'; }).join('') : '<span class="ev-m-sub">' + esc(T('fiche.loading')) + '</span>') + '</span></div>' +
    '</div>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.records')) + '</h3><p class="ev-note">' + esc(T('obj.records_note')) + '</p>' + recordsHtml(rec, col, country, L) + '</section>' +
    '<section class="ev-section"><h3>' + esc(T('obj.chart')) + '</h3><p class="ev-note">' + esc(T('obj.chart_tip')) + '</p>' + chartHtml(axisKeys(firstKey, lastKey, col.keys), col, best, live, L) + '</section>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.links')) + '</h3>' +
      (d.art ? linksHtml(T('obj.links_first'), firstKey, art.at[firstKey], L) +
               (best.key !== firstKey ? linksHtml(T('obj.links_peak'), best.key, art.at[best.key], L) : '') +
               (lastKey !== best.key && lastKey !== firstKey ? linksHtml(T('obj.links_last'), lastKey, art.at[lastKey], L) : '')
             : '<p class="ev-note">' + esc(T('fiche.loading')) + '</p>') + '</section>' +
    '<section class="ev-section"><h3>' + esc(T('fiche.editions_list')) + '</h3><div class="ev-table-wrap"><table class="ev-table"><thead><tr><th>' + esc(T('fiche.col_edition')) + '</th><th class="num">' + esc(T('fiche.col_index')) + '</th><th class="num">' + esc(T('obj.col_rank')) + '</th><th class="num">' + esc(T('obj.col_heads')) + '</th></tr></thead><tbody>' +
      editions.slice(0, SHOW).map(rowHtml).join('') + '</tbody></table></div>' +
      (editions.length > SHOW ? '<button type="button" class="ob-more">' + esc(T('obj.editions_more', { n: editions.length })) + '</button>' : '') + '</section>' +
    toolsHtml(country, id);
  root.innerHTML = html;
  bindChart(root, axisKeys(firstKey, lastKey, col.keys), col, L);
  var more = root.querySelector('.ob-more');
  if (more) more.addEventListener('click', function() { root.querySelector('.ev-table tbody').innerHTML = editions.map(rowHtml).join(''); more.remove(); });
}

function show(country, id, ts) {
  u = window.RadarAune && window.RadarAune.util; if (!u) return;
  var root = section(); if (!root) return;
  var col = collect(ts, country, id);
  last = { country: country, id: id, col: col, art: null };
  try { var url = new URL(window.location.href); url.searchParams.set('objet', id); url.searchParams.set('pays', country); url.searchParams.delete('evenement'); url.searchParams.delete('region'); history.replaceState(null, '', url.toString()); } catch (e) { /* ignore */ }
  render(last);
  var keysIn = col.keys.filter(function(k) { return col.at[k] && col.at[k].v > 0; });
  if (!keysIn.length) return;
  var best = keysIn.reduce(function(b, k) { return col.at[k].v > col.at[b].v ? k : b; }, keysIn[0]);
  var mine = last;
  loadArticles(country, id, col, keysIn, [keysIn[0], best, keysIn[keysIn.length - 1]]).then(function(art) {
    if (last !== mine) return; mine.art = art; render(mine);
  }).catch(function(e) { console.warn('Fiche objet : articles', e); });
}
function clear() { if (sec) sec.innerHTML = ''; last = null; }
window.RadarObjet = { show: show, clear: clear };
document.addEventListener('i18n:applied', function() { if (last) render(last); });
})();
