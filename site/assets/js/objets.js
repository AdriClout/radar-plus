/* Classement des objets (sujets, acteurs, lieux) — page Classement, onglet Objets.
   Même calcul que le Hot 10/20 de l'accueil : pour chaque objet, somme de l'indice (spec v1 × 100)
   des éditions de 4h de la période ; « Dernières heures » = la seule dernière édition.
   Données : radarData.timeseries() (130 jours). Se branche sur RadarAune (réglages, fenêtres,
   navigateur de période, filtre) et rend dans la même grille, avec le même style de rangs. */
(function() {
'use strict';
var data = null, loading = null, lastExport = null;
var LEVEL_BAND = { eleve: 'elevee', tres_eleve: 'tres_elevee', extreme: 'extreme' };
var LEVEL_RANK = { none: 0, eleve: 1, tres_eleve: 2, extreme: 3 };

function load() {
  if (!loading) loading = window.radarData.timeseries().then(function(d) { data = d; }).catch(function(e) { console.warn('Classement objets : données indisponibles', e); data = { meta: { periods: [] }, graphs: {} }; });
  return loading;
}
// Clés des éditions d'une fenêtre [début, fin[ ; pour « Dernières heures », la seule édition choisie.
function keysFor(range, offset, u, allKeys) {
  if (range === '24h') {
    var last = allKeys.length ? allKeys[allKeys.length - 1] : null; if (!last) return [];
    var t = u.periodStartUtc(last) + (offset || 0) * 4 * 3600e3, k = u.keyAt(t);
    return allKeys.indexOf(k) === -1 ? [] : [k];
  }
  var w = u.window(range, offset);
  return allKeys.filter(function(k) { var t = u.periodStartUtc(k); return t >= w[0] && t < w[1]; });
}
// Somme de l'indice par objet sur des éditions ; niveau d'alerte le plus haut atteint.
function sums(graphs, keys) {
  var out = {};
  keys.forEach(function(k) {
    var per = graphs[k]; if (!per || !per.nodes) return;
    per.nodes.forEach(function(n) {
      var o = out[n.id] || (out[n.id] = { id: n.id, points: 0, blocks: 0, level: 'none' });
      o.points += Number(n.size) || 0; o.blocks++;
      if ((LEVEL_RANK[n.alert_level] || 0) > (LEVEL_RANK[o.level] || 0)) o.level = n.alert_level;
    });
  });
  return out;
}
function ranked(graphs, keys) {
  var s = sums(graphs, keys);
  return Object.keys(s).map(function(id) { return s[id]; }).filter(function(o) { return o.points > 0; })
    .sort(function(a, b) { return b.points - a.points; });
}
function trendHtml(prevRank, now, limit, T, esc) {
  if (prevRank && prevRank <= limit) {
    var diff = prevRank - now;
    if (diff > 0) return '<span class="hot20-trend hot20-hint up" data-tip="' + esc(T('aune.trend_up_tip', { n: diff, prev: prevRank, now: now })) + '">&#9650;' + diff + '</span>';
    if (diff < 0) return '<span class="hot20-trend hot20-hint down" data-tip="' + esc(T('aune.trend_down_tip', { n: -diff, prev: prevRank, now: now })) + '">&#9660;' + (-diff) + '</span>';
    return '<span class="hot20-trend hot20-hint stable" data-tip="' + esc(T('aune.trend_stable_tip', { now: now })) + '">&mdash;</span>';
  }
  return '<span class="hot20-trend hot20-hint new" data-tip="' + esc(T('aune.trend_new_tip')) + '">' + esc(T('homepage.trend_new_label')) + '</span>';
}
function render() {
  var A = window.RadarAune, cfg = A.cfg, u = A.util, esc = u.escapeHtml;
  var T = window.t || function(k) { return k; };
  var lang = (document.documentElement.lang || 'fr').slice(0, 2);
  var sec = document.getElementById(cfg.sectionId), grid = document.getElementById(cfg.gridId), sub = document.getElementById(cfg.subtitleId);
  if (!sec || !grid) return;
  sec.hidden = false;
  if (sub) sub.textContent = T('classement.obj_sub.' + cfg.range);
  var foot = document.getElementById(cfg.footId); if (foot) foot.textContent = '';
  if (!data) {
    grid.innerHTML = '<div class="aune-empty">' + esc(T('common.loading')) + '</div>';
    load().then(function() { if (cfg.type === 'objets') render(); });
    return;
  }
  var country = cfg.country, graphs = (data.graphs && data.graphs[country]) || {};
  var allKeys = (data.meta.periods || []).map(function(p) { return p.key; }).sort();
  var keys = keysFor(cfg.range, cfg.offset, u, allKeys), prevKeys = keysFor(cfg.range, cfg.offset - 1, u, allKeys);
  if (cfg.navId) {
    var lbl = document.getElementById(cfg.navId + '-label'), nxt = document.getElementById(cfg.navId + '-next');
    if (lbl) lbl.textContent = cfg.range === '24h' && keys.length ? u.navLabel('24h', cfg.offset, lang, T) : u.navLabel(cfg.range, cfg.offset, lang, T);
    if (nxt) nxt.disabled = cfg.offset >= 0;
  }
  var items = ranked(graphs, keys), limit = cfg.limits[cfg.range] || 10;
  var q = u.query();
  if (q) items = items.filter(function(it) { return u.norm(it.id).indexOf(q) !== -1; });
  var total = items.reduce(function(m, it) { return m + it.points; }, 0) || 1;
  var full = items, nAll = full.length; items = full.slice(0, limit);
  var countEl = cfg.countId ? document.getElementById(cfg.countId) : null;
  if (countEl) countEl.textContent = nAll > items.length ? T('classement.obj_count_shown', { shown: items.length, n: nAll }) : T(nAll === 1 ? 'classement.obj_count_one' : 'classement.obj_count_many', { n: nAll });
  if (!items.length) { grid.innerHTML = '<div class="aune-empty">' + esc(T('aune.empty')) + '</div>'; return; }
  var prevRanks = {}; ranked(graphs, prevKeys).forEach(function(it, i) { prevRanks[it.id] = i + 1; });
  lastExport = { rows: full, prevRanks: prevRanks, total: total, country: country, lang: lang };
  var header = '<li class="aune-list-header">' +
    '<span>' + esc(T('hot20.header_rank')) + '</span><span class="center">' + esc(T('hot20.header_movement')) + '</span>' +
    '<span>' + esc(T('classement.header_object')) + '</span><span class="right">' + esc(T('aune.header_points')) + '</span></li>';
  var rows = items.map(function(it, i) {
    var band = LEVEL_BAND[it.level] || 'aucune';
    var bandLabel = band === 'aucune' ? '' : T('alertes.level_short.' + it.level);
    var share = 100 * it.points / total;
    return '<li class="aune-row rank-' + (i + 1) + ' band-' + band + '">' +
      '<span class="aune-row-rank">' + (i + 1) + '</span>' +
      '<span class="aune-row-trend">' + trendHtml(prevRanks[it.id], i + 1, limit, T, esc) + '</span>' +
      '<div class="aune-row-main">' +
        (band === 'aucune' ? '' : '<div class="aune-row-top"><span class="aune-band band-' + band + ' hot20-hint" data-tip="' + esc(T('classement.obj_band_tip')) + '">' + esc(bandLabel) + '</span></div>') +
        '<h3 class="aune-row-title obj"><a href="./statistiques.html?objet=' + encodeURIComponent(it.id) + '">' + esc(it.id) + '</a></h3>' +
        '<div class="aune-row-meta"><span>' + esc(T(it.blocks === 1 ? 'classement.obj_editions_one' : 'classement.obj_editions_many', { n: it.blocks })) + '</span></div>' +
      '</div>' +
      '<div class="aune-row-score"><span class="num hot20-hint" data-tip="' + esc(T('classement.obj_points_tip')) + '">' + it.points.toFixed(1) + '</span>' +
        '<div class="hot20-bar-track"><div class="hot20-bar" style="width:' + Math.max(1, Math.round(share)) + '%"></div></div>' +
        '<span class="unit hot20-hint" data-tip="' + esc(T('aune.share_tip')) + '">' + esc(T('aune.share_label', { pct: Math.round(share) })) + '</span></div>' +
    '</li>';
  }).join('');
  grid.innerHTML = '<ol class="aune-list dense">' + header + rows + '</ol>';
}
function download() {
  if (!lastExport) return;
  var A = window.RadarAune, cfg = A.cfg, u = A.util, T = window.t || function(k) { return k; }, x = lastExport, lang = x.lang;
  var period = u.navLabel(cfg.range, cfg.offset, lang, T);
  var headers = [T('csv.rank'), T('csv.object'), T('csv.points'), T('csv.share'), T('csv.editions'), T('csv.level'), T('csv.prev_rank'), T('csv.region'), T('csv.period')];
  var rows = x.rows.map(function(it, i) {
    return [i + 1, it.id, it.points, 100 * it.points / x.total, it.blocks, it.level === 'none' ? '' : T('alertes.level_short.' + it.level), x.prevRanks[it.id] || '', x.country, period];
  });
  u.csvFile(headers, rows, 'radarplus_objets_' + x.country + '_' + u.periodSlug(cfg.range, cfg.offset) + '.csv', lang, T);
}
window.RadarObjets = { render: render, load: load, download: download };
})();
