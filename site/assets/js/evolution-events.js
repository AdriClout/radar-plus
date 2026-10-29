/* Évolution — mode Événements (chantier 2, #49).
 *
 * Dessine, sur le canevas de la page Évolution, les courbes de l'indice 24h des
 * grandes histoires (storylines) de la fenêtre choisie : top 10 par cumul des
 * blocs (même classement que La Une des Unes), sommets numérotés, seuils de
 * saillance de la Vitrine en lignes horizontales, légende dans le panneau de
 * gauche. Données : v2/events/index.json (seuils) et
 * v2/events/storylines/{région}/{année}.json (séries par bloc : `series` =
 * indice du bloc, `sum24h` = indice 24h).
 *
 * La page appelle window.radarEvents.render(state) avec :
 *   { canvas, country, gran, periods: [{key, future, blockStart}], slotLabel,
 *     layout: {PAD, chartW, chartH}, stars }
 * puis hover(clientX, clientY) / click(clientX, clientY) ; resize = render.
 */
(function () {
  'use strict';

  var COLORS = ['#ffd93d', '#ff6b6b', '#48dbfb', '#ff9ff3', '#54a0ff', '#00d2d3', '#ff9f43', '#10ac84', '#c7b9ff', '#f368e0'];
  var BANDS = ['faible', 'moderee', 'elevee', 'tres_elevee', 'extreme'];
  var BAND_STYLE = {
    faible:      { line: 'rgba(130,150,190,0.45)', text: 'rgba(170,185,215,0.9)' },
    moderee:     { line: 'rgba(120,170,255,0.55)', text: 'rgba(170,200,255,0.92)' },
    elevee:      { line: 'rgba(212,188,88,0.65)',  text: 'rgba(255,224,140,0.95)' },
    tres_elevee: { line: 'rgba(255,143,92,0.70)',  text: 'rgba(255,200,160,0.98)' },
    extreme:     { line: 'rgba(255,90,90,0.80)',   text: 'rgba(255,180,180,1)' }
  };
  var FIRST_YEAR = 2026;
  var TOP_N = 10;

  var store = { index: null, storylines: {}, loading: {} };
  var state = null;      // dernier état reçu de la page
  var hoverIdx = null;   // index de période survolé
  var focused = null;    // storyline mise en évidence (clic)
  var last = null;       // dernier rendu : { items, n, xOf, yOf, PAD, chartW, chartH, periods }

  function T(k, vars) { return window.t ? window.t(k, vars) : k; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function years() { var y1 = new Date().getUTCFullYear(), out = []; for (var y = FIRST_YEAR; y <= y1; y++) out.push(y); return out; }
  function periodStartUtc(key) {
    return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), parseInt(key.slice(11, 13), 10) || 0);
  }
  function mtlOffsetHours(d) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Montreal', timeZoneName: 'longOffset' }).formatToParts(d);
      var tz = (parts.find(function (x) { return x.type === 'timeZoneName'; }) || {}).value || 'GMT-04:00';
      var m = tz.match(/GMT([+-])(\d{1,2})/);
      return m ? (m[1] === '-' ? 1 : -1) * Number(m[2]) : 4;
    } catch (e) { return 4; }
  }
  function hourLabel(h) { return h === 0 ? 'Minuit' : h === 12 ? 'Midi' : h + 'h'; }
  function localHourOfKey(key) {
    var t = periodStartUtc(key);
    return (new Date(t).getUTCHours() - mtlOffsetHours(new Date(t)) + 24) % 24;
  }
  function dayLabel(key, lang, withWeekday) {
    var t = periodStartUtc(key);
    var opt = withWeekday ? { timeZone: 'America/Montreal', weekday: 'short', day: 'numeric' } : { timeZone: 'America/Montreal', day: 'numeric', month: 'short' };
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-CA' : 'fr-CA', opt).format(new Date(t));
  }
  function monthLabel(key, lang, withYear) {
    var t = periodStartUtc(key);
    var opt = withYear ? { timeZone: 'America/Montreal', month: 'short', year: 'numeric' } : { timeZone: 'America/Montreal', month: 'short' };
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-CA' : 'fr-CA', opt).format(new Date(t));
  }
  function whenLabel(key, lang) {
    var t = periodStartUtc(key);
    var d = new Intl.DateTimeFormat(lang === 'en' ? 'en-CA' : 'fr-CA', { timeZone: 'America/Montreal', day: 'numeric', month: 'short' }).format(new Date(t));
    return d + ' ' + hourLabel(localHourOfKey(key));
  }
  function fmt(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  // ── Données ─────────────────────────────────────────────────────────────
  function ready(country) {
    if (!store.index) return false;
    return years().every(function (y) { return !!store.storylines[country + '/' + y]; });
  }
  function load(country) {
    var jobs = [];
    if (!store.index) {
      if (!store.loading.index) store.loading.index = window.radarData.eventsIndex().then(function (i) { store.index = i; });
      jobs.push(store.loading.index);
    }
    years().forEach(function (y) {
      var k = country + '/' + y;
      if (!store.storylines[k] && !store.loading[k]) {
        store.loading[k] = window.radarData.eventsStorylines(country, y)
          .then(function (f) { store.storylines[k] = f; })
          .catch(function () { store.storylines[k] = { storylines: {} }; });
      }
      if (store.loading[k]) jobs.push(store.loading[k]);
    });
    return Promise.all(jobs);
  }
  function thresholds(country) {
    var th = store.index && store.index.thresholds && store.index.thresholds[country];
    return th && th.sum24h ? th.sum24h : null;
  }

  // Top 10 des histoires de la fenêtre : classement par cumul de l'indice des blocs,
  // courbe = indice 24h par bloc (0 quand l'histoire est absente).
  function computeItems(country, periods) {
    var keys = periods.map(function (p) { return p.key; });
    var acc = {};
    years().forEach(function (y) {
      var f = store.storylines[country + '/' + y]; if (!f || !f.storylines) return;
      Object.keys(f.storylines).forEach(function (sid) {
        var st = f.storylines[sid], ser = st.series || {}, cum = st.sum24h || {};
        var gain = 0, any = false;
        keys.forEach(function (k) { var v = Number(ser[k]); if (v) { gain += v; any = true; } });
        if (!any) return;
        var vals = periods.map(function (p) { return p.future ? null : (Number(cum[p.key]) || 0); });
        var peak = 0, peakI = -1;
        vals.forEach(function (v, i) { if (v !== null && v > peak) { peak = v; peakI = i; } });
        var cur = acc[sid];
        if (!cur) acc[sid] = { sid: sid, title: st.title_peak || st.title || sid, url: st.url || null, gain: gain, vals: vals, peak: peak, peakI: peakI, firstKey: st.first_key };
        else { cur.gain += gain; }
      });
    });
    var items = Object.keys(acc).map(function (k) { return acc[k]; });
    items.sort(function (a, b) { return b.gain - a.gain; });
    items = items.slice(0, TOP_N);
    items.forEach(function (it, i) { it.rank = i + 1; it.color = COLORS[i % COLORS.length]; });
    return items;
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  function drawBackground(ctx, W, H, stars) {
    ctx.fillStyle = '#00000f'; ctx.fillRect(0, 0, W, H);
    (stars || []).forEach(function (s) {
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180,205,255,' + (s.a * 0.35).toFixed(2) + ')'; ctx.fill();
    });
  }
  function drawMessage(ctx, W, H, msg) {
    ctx.font = '12px "Space Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(140,170,220,0.75)';
    ctx.fillText(msg, W / 2, H / 2);
  }
  function hexToRgb(hex) {
    var h = hex.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(hex, a) { var c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function tickIndices(periods, gran, lang) {
    var n = periods.length, out = [];
    if (!n) return out;
    if (gran === 'day') { for (var i = 0; i < n; i++) out.push({ i: i, label: hourLabel(periods[i].blockStart != null ? periods[i].blockStart : localHourOfKey(periods[i].key)) }); return out; }
    var bucketOf = function (p) {
      var t = periodStartUtc(p.key), d = new Date(t);
      var local = new Date(t - mtlOffsetHours(d) * 3600e3);
      if (gran === 'week' || gran === 'month') return local.toISOString().slice(0, 10);
      return local.toISOString().slice(0, 7);
    };
    var prev = null, cands = [];
    for (var j = 0; j < n; j++) { var b = bucketOf(periods[j]); if (b !== prev) { cands.push(j); prev = b; } }
    var maxTicks = 8, step = Math.max(1, Math.ceil(cands.length / maxTicks));
    cands.filter(function (_, k) { return k % step === 0; }).forEach(function (i) {
      var p = periods[i];
      out.push({ i: i, label: gran === 'week' ? dayLabel(p.key, lang, true) : gran === 'month' ? dayLabel(p.key, lang, false) : monthLabel(p.key, lang, gran === 'total') });
    });
    return out;
  }

  function render(s) {
    if (s) state = s;
    if (!state || !state.canvas) return;
    var canvas = state.canvas, rect = canvas.getBoundingClientRect();
    canvas.width = rect.width; canvas.height = rect.height;
    var W = canvas.width, H = canvas.height; if (!W || !H) return;
    var ctx = canvas.getContext('2d');
    var lang = (document.documentElement.lang || 'fr').slice(0, 2);
    drawBackground(ctx, W, H, state.stars);
    var lb = document.getElementById('live-badge'); if (lb) lb.style.display = 'none';

    var country = state.country;
    if (country !== 'QC' && country !== 'CAN') { drawMessage(ctx, W, H, T('evolution.events_usa')); renderLegend([], lang); last = null; return; }
    if (!ready(country)) {
      drawMessage(ctx, W, H, T('common.loading'));
      load(country).then(function () { if (state && state.country === country) render(); });
      return;
    }
    var periods = state.periods || [];
    var items = computeItems(country, periods);
    renderLegend(items, lang);
    if (!items.length || !periods.length) { drawMessage(ctx, W, H, T('evolution.events_empty')); last = null; return; }

    var L = state.layout, PAD = L.PAD, chartW = L.chartW, chartH = L.chartH, n = periods.length;
    var xOf = function (i) { return PAD.left + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2); };
    var th = thresholds(country) || {};
    var maxVal = 0.1;
    items.forEach(function (it) { if (it.peak > maxVal) maxVal = it.peak; });
    var thMax = th.elevee || 0; if (thMax > maxVal) maxVal = thMax; // au moins le seuil « élevée » visible
    maxVal *= 1.08;
    var yOf = function (v) { return PAD.top + chartH - (v / maxVal) * chartH; };

    // Grille horizontale + valeurs
    ctx.font = '9px "Space Mono", monospace';
    for (var gi = 0; gi <= 5; gi++) {
      var gv = (gi / 5) * maxVal, gy = yOf(gv);
      ctx.strokeStyle = 'rgba(55,85,175,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(PAD.left, gy); ctx.lineTo(PAD.left + chartW, gy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(110,150,215,0.55)'; ctx.textAlign = 'left';
      ctx.fillText(gv >= 100 ? gv.toFixed(0) : gv.toFixed(1), PAD.left + chartW + 5, gy + 3);
    }
    // Seuils de saillance (indice 24h, Vitrine)
    ctx.font = '9px "Orbitron", "Space Mono", monospace';
    BANDS.forEach(function (b) {
      var v = Number(th[b]); if (!Number.isFinite(v) || v <= 0 || v > maxVal) return;
      var y = yOf(v), st = BAND_STYLE[b];
      ctx.strokeStyle = st.line; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + chartW, y); ctx.stroke(); ctx.setLineDash([]);
      var label = String(T('aune.band.' + b)).toUpperCase() + '  ' + fmt(v);
      ctx.textAlign = 'right';
      var tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(0,2,18,0.78)'; ctx.fillRect(PAD.left + chartW - tw - 2, y - 8, tw, 14);
      ctx.fillStyle = st.text; ctx.fillText(label, PAD.left + chartW - 4, y + 3);
    });
    // Axes
    ctx.strokeStyle = 'rgba(75,115,195,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + chartH); ctx.lineTo(PAD.left + chartW, PAD.top + chartH); ctx.stroke();
    // Ticks X
    ctx.font = '11px "Space Mono", monospace'; ctx.textAlign = 'center';
    tickIndices(periods, state.gran, lang).forEach(function (tk) {
      var x = xOf(tk.i);
      ctx.strokeStyle = 'rgba(55,85,175,0.22)'; ctx.beginPath(); ctx.moveTo(x, PAD.top + chartH); ctx.lineTo(x, PAD.top + chartH + 5); ctx.stroke();
      ctx.fillStyle = 'rgba(138,176,235,0.85)'; ctx.fillText(tk.label, x, PAD.top + chartH + 18);
    });
    // Zone future (vue Jour) : voile
    var firstFuture = -1;
    periods.forEach(function (p, i) { if (p.future && firstFuture < 0) firstFuture = i; });
    if (firstFuture > 0) {
      ctx.fillStyle = 'rgba(0,0,15,0.55)';
      ctx.fillRect(xOf(firstFuture - 1), PAD.top, PAD.left + chartW - xOf(firstFuture - 1), chartH);
    }

    // Courbes (de la 10e à la 1re pour que la 1re passe dessus)
    var active = focused || (hoverIdx === null ? null : null);
    items.slice().reverse().forEach(function (it) {
      var dim = focused && focused !== it.sid;
      ctx.strokeStyle = rgba(it.color, dim ? 0.18 : 0.9); ctx.lineWidth = dim ? 1 : (it.rank <= 3 ? 2.2 : 1.6);
      ctx.beginPath(); var started = false;
      it.vals.forEach(function (v, i) {
        if (v === null) return;
        var x = xOf(i), y = yOf(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      });
      ctx.stroke();
      if (!dim) {
        ctx.fillStyle = rgba(it.color, 0.08);
        ctx.lineTo(xOf(lastIndex(it.vals)), PAD.top + chartH); ctx.lineTo(xOf(firstIndex(it.vals)), PAD.top + chartH); ctx.closePath(); ctx.fill();
      }
    });
    // Sommets numérotés
    items.slice().reverse().forEach(function (it) {
      if (it.peakI < 0) return;
      var dim = focused && focused !== it.sid;
      var x = xOf(it.peakI), y = yOf(it.peak);
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fillStyle = dim ? rgba(it.color, 0.25) : it.color; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,15,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = 'bold 10px "Space Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = dim ? 'rgba(0,0,15,0.5)' : '#00000f'; ctx.fillText(String(it.rank), x, y + 3.5);
    });
    // Survol : ligne verticale + points + infobulle
    var tip = document.getElementById('evo-tooltip');
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n && !periods[hoverIdx].future) {
      var hx = xOf(hoverIdx);
      ctx.strokeStyle = 'rgba(150,200,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(hx, PAD.top); ctx.lineTo(hx, PAD.top + chartH); ctx.stroke(); ctx.setLineDash([]);
      var rows = [];
      items.forEach(function (it) {
        var v = it.vals[hoverIdx]; if (v === null || v <= 0) return;
        ctx.beginPath(); ctx.arc(hx, yOf(v), 3.5, 0, Math.PI * 2); ctx.fillStyle = it.color; ctx.fill();
        rows.push({ it: it, v: v });
      });
      rows.sort(function (a, b) { return b.v - a.v; });
      if (tip) {
        var per = document.getElementById('evo-tooltip-period'), box = document.getElementById('evo-tooltip-items');
        if (per) per.textContent = whenLabel(periods[hoverIdx].key, lang) + ' · ' + T('aune.index24h_label');
        if (box) box.innerHTML = rows.slice(0, 8).map(function (r) {
          return '<div class="evo-tt-row"><span class="evo-tt-dot" style="background:' + r.it.color + '"></span>' +
            '<span class="evo-tt-name">' + r.it.rank + '. ' + esc(r.it.title) + '</span><span class="evo-tt-val">' + fmt(r.v) + '</span></div>';
        }).join('') || '<div class="evo-tt-row"><span class="evo-tt-name">—</span></div>';
        tip.style.display = 'block';
        var tx = state.lastMouse ? state.lastMouse.x + 14 : rect.left + hx + 14, ty = state.lastMouse ? state.lastMouse.y + 14 : rect.top + PAD.top;
        if (tx + 260 > window.innerWidth) tx -= 280;
        tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
      }
    } else if (tip) tip.style.display = 'none';

    last = { items: items, n: n, xOf: xOf, yOf: yOf, PAD: PAD, chartW: chartW, chartH: chartH, periods: periods, rect: rect };
    highlightLegend();
  }
  function firstIndex(vals) { for (var i = 0; i < vals.length; i++) if (vals[i] !== null) return i; return 0; }
  function lastIndex(vals) { for (var i = vals.length - 1; i >= 0; i--) if (vals[i] !== null) return i; return 0; }

  // ── Légende (panneau de gauche) ──────────────────────────────────────────
  function renderLegend(items, lang) {
    var head = document.getElementById('events-legend-head'), list = document.getElementById('events-legend-list');
    if (head) head.textContent = T('evolution.events_head', { label: state && state.slotLabel ? state.slotLabel : '' });
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="evt-empty">' + esc(state && state.country !== 'QC' && state.country !== 'CAN' ? T('evolution.events_usa') : T('evolution.events_empty')) + '</div>';
      return;
    }
    list.innerHTML = items.map(function (it) {
      var peakKey = it.peakI >= 0 ? state.periods[it.peakI].key : null;
      var meta = (peakKey ? T('evolution.events_peak', { v: fmt(it.peak), when: whenLabel(peakKey, lang) }) + ' · ' : '') + T('evolution.events_cumul', { v: fmt(it.gain) });
      return '<div class="evt-row" data-sid="' + esc(it.sid) + '">' +
        '<span class="evt-rank" style="background:' + it.color + '">' + it.rank + '</span>' +
        '<div class="evt-main"><div class="evt-title">' + esc(it.title) + '</div><div class="evt-meta">' + esc(meta) + '</div></div>' +
        (it.url ? '<a class="evt-link" href="' + esc(it.url) + '" target="_blank" rel="noopener" title="' + esc(T('evolution.events_open')) + '">↗</a>' : '') +
      '</div>';
    }).join('');
    list.querySelectorAll('.evt-row').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        var sid = row.dataset.sid; focused = focused === sid ? null : sid; render();
      });
      row.addEventListener('mouseenter', function () { if (!focused) { row.classList.add('hover'); } });
      row.addEventListener('mouseleave', function () { row.classList.remove('hover'); });
    });
  }
  function highlightLegend() {
    var list = document.getElementById('events-legend-list'); if (!list) return;
    list.querySelectorAll('.evt-row').forEach(function (row) {
      row.classList.toggle('focused', !!focused && row.dataset.sid === focused);
      row.classList.toggle('dimmed', !!focused && row.dataset.sid !== focused);
    });
  }

  // ── Interactions ─────────────────────────────────────────────────────────
  function indexAt(clientX) {
    if (!last) return null;
    var x = clientX - last.rect.left;
    if (x < last.PAD.left - 10 || x > last.PAD.left + last.chartW + 10) return null;
    var best = null, bd = Infinity;
    for (var i = 0; i < last.n; i++) { var d = Math.abs(last.xOf(i) - x); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function hover(clientX, clientY) {
    if (clientX == null) { hoverIdx = null; if (state) state.lastMouse = null; render(); return; }
    var i = indexAt(clientX);
    if (state) state.lastMouse = { x: clientX, y: clientY };
    if (i !== hoverIdx || true) { hoverIdx = i; render(); }
  }
  function click(clientX, clientY) {
    if (!last) return;
    var i = indexAt(clientX); if (i === null) { focused = null; render(); return; }
    var y = clientY - last.rect.top, best = null, bd = 14;
    last.items.forEach(function (it) { var v = it.vals[i]; if (v === null) return; var d = Math.abs(last.yOf(v) - y); if (d < bd) { bd = d; best = it.sid; } });
    focused = best && best !== focused ? best : null;
    render();
  }

  window.radarEvents = { render: render, hover: hover, click: click, reset: function () { focused = null; hoverIdx = null; } };
})();
