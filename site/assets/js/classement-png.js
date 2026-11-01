// Image officielle du classement affiché (« Télécharger (PNG) », page Classement ; Adrien, 31 oct. 2026) :
// le Hot 20 (ou le classement) de la période, prêt à reprendre dans une infolettre ou un média.
// Logo, titre et période, 20 rangs avec étiquette, mouvement, points et part du radar, quelques
// statistiques, la mention de l'indice et de sa méthode, un code QR vers le classement en ligne.
// Dessiné dans un canvas (2× pour la netteté), sans serveur ; données = RadarAune.exportData().
(function () {
  var W = 1200, PAD = 56, SCALE = 2;
  var BAND = { aucune: '#55658a', faible: '#7f93b8', moderee: '#5fa8ff', elevee: '#f2c94c', tres_elevee: '#ff9f43', extreme: '#ff4d4d' };
  var SITE = 'https://radarplus.org';
  function T(k, p) { return (window.t ? window.t(k, p) : k) || k; }
  function esc(s) { return s == null ? '' : String(s); }
  function fmt1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function fmtInt(v, lang) { return new Intl.NumberFormat(lang === 'en' ? 'en-CA' : 'fr-CA').format(Math.round(v)); }
  function loadImage(src) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; }); }
  function truncate(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    var t = text; while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t.replace(/\s+$/, '') + '…';
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function url(d) { return SITE + '/classement?type=' + d.type + '&range=' + d.range + '&country=' + d.region + (d.offset < 0 ? '&offset=' + d.offset : '') + (d.range === 'custom' && d.from && d.to ? '&from=' + d.from + '&to=' + d.to : ''); }
  function stats(d) {
    var lang = d.lang, out = [];
    var top3 = d.rows.slice(0, 3).reduce(function (m, r) { return m + (r.sharePct || 0); }, 0);
    if (d.type === 'evenements') {
      var byIssue = {}; d.rows.forEach(function (r) { if (r.issue) byIssue[r.issue] = (byIssue[r.issue] || 0) + (r.points || 0); });
      var issues = Object.keys(byIssue).sort(function (a, b) { return byIssue[b] - byIssue[a]; });
      var sumTop = d.rows.reduce(function (m, r) { return m + (r.points || 0); }, 0) || 1;
      var media = {}; d.rows.forEach(function (r) { (r.media || []).forEach(function (m) { media[m] = 1; }); });
      out.push({ v: fmtInt(d.nAll, lang), l: T('classement.png.stat_stories') });
      if (issues.length) out.push({ v: issues[0], l: T('classement.png.stat_theme', { pct: Math.round(100 * byIssue[issues[0]] / sumTop) }), small: true });
      out.push({ v: fmtInt(Object.keys(media).length, lang), l: T('classement.png.stat_media') });
      out.push({ v: Math.round(top3) + ' %', l: T('classement.png.stat_top3') });
    } else {
      out.push({ v: fmtInt(d.nAll, lang), l: T('classement.png.stat_objects') });
      out.push({ v: fmtInt(d.totalPoints, lang), l: T('classement.png.stat_points') });
      out.push({ v: Math.round(top3) + ' %', l: T('classement.png.stat_top3_obj') });
    }
    return out;
  }
  function drawQr(ctx, text, x, y, size) {
    if (typeof qrcode !== 'function') return false;
    var qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), cell = size / n;
    ctx.fillStyle = '#ffffff'; roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 8); ctx.fill();
    ctx.fillStyle = '#050a1e';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell + 0.3, cell + 0.3);
    return true;
  }
  async function render(d) {
    var lang = d.lang || 'fr', loc = lang === 'en' ? 'en-CA' : 'fr-CA';
    await Promise.all(['700 40px "Space Grotesk"', '600 17px "Space Grotesk"', '400 14px "Space Grotesk"', '700 20px "Space Mono"', '400 12px "Space Mono"'].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
    var robot = await loadImage('./assets/img/robot.png');
    var ROW = 46, rows = d.rows.slice(0, 20), st = stats(d);
    var yRows = 286, yStats = yRows + rows.length * ROW + 30, yFoot = yStats + 96 + 40, H = yFoot + 176;
    var canvas = document.createElement('canvas'); canvas.width = W * SCALE; canvas.height = H * SCALE;
    var ctx = canvas.getContext('2d'); ctx.scale(SCALE, SCALE);
    // fond et ciel
    ctx.fillStyle = '#050a1e'; ctx.fillRect(0, 0, W, H);
    var seed = 7; var rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (var i = 0; i < 260; i++) { ctx.fillStyle = 'rgba(180,205,255,' + (0.12 + rnd() * 0.4).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 0.5 + rnd() * 1.1, 0, Math.PI * 2); ctx.fill(); }
    // en-tête : logo, marque, statut
    if (robot) ctx.drawImage(robot, PAD, 30, 60, 60);
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 34px "Space Grotesk"'; ctx.fillStyle = '#f1f5ff'; ctx.fillText('RADAR', PAD + 74, 68);
    var wR = ctx.measureText('RADAR').width; ctx.fillStyle = '#5b8cff'; ctx.fillText('+', PAD + 74 + wR + 2, 68);
    ctx.font = '400 13px "Space Mono"'; ctx.fillStyle = 'rgba(150,178,225,0.9)'; ctx.fillText('radarplus.org', PAD + 76, 90);
    ctx.textAlign = 'right';
    ctx.font = '700 12px "Space Mono"'; ctx.fillStyle = d.final ? '#ffd98a' : '#9dd8ff';
    var statusTxt = d.status.toUpperCase(); var sw = ctx.measureText(statusTxt).width;
    ctx.strokeStyle = d.final ? 'rgba(255,200,87,0.6)' : 'rgba(95,168,255,0.6)'; ctx.lineWidth = 1; roundRect(ctx, W - PAD - sw - 20, 40, sw + 20, 26, 5); ctx.stroke();
    ctx.fillText(statusTxt, W - PAD - 10, 58);
    ctx.font = '400 12px "Space Mono"'; ctx.fillStyle = 'rgba(150,178,225,0.9)';
    ctx.fillText(T('classement.png.generated', { date: new Intl.DateTimeFormat(loc, { timeZone: 'America/Montreal', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date()) }), W - PAD, 90);
    ctx.textAlign = 'left';
    // titre, période
    var title = T('classement.png.' + (d.type === 'objets' ? (d.hot ? 'title_objects_hot' : 'title_objects') : (d.hot ? 'title_events_hot' : 'title_events'))) + (d.range === 'elecqc2026' ? ' · ' + T('aune.range.elecqc2026') : '');
    ctx.font = '700 40px "Space Grotesk"'; ctx.fillStyle = '#f1f5ff'; ctx.fillText(title, PAD, 170);
    ctx.font = '600 20px "Space Grotesk"'; ctx.fillStyle = '#dbe6ff'; ctx.fillText(d.period + ' · ' + T('country.' + d.region), PAD, 206);
    ctx.font = '400 14px "Space Grotesk"'; ctx.fillStyle = 'rgba(150,178,225,0.95)'; ctx.fillText(d.sub, PAD, 230);
    // en-tête de colonnes
    ctx.font = '400 10px "Space Mono"'; ctx.fillStyle = 'rgba(150,178,225,0.8)';
    var colTitle = PAD + 128, colPts = W - PAD - 190, colBar = W - PAD - 150;
    ctx.fillText(T('hot20.header_rank').toUpperCase(), PAD, yRows - 14);
    ctx.fillText(T('hot20.header_movement').toUpperCase(), PAD + 44, yRows - 14);
    ctx.fillText(T(d.type === 'objets' ? 'classement.header_object' : 'aune.header_subject').toUpperCase(), colTitle, yRows - 14);
    ctx.textAlign = 'right'; ctx.fillText((d.is24h && d.type === 'evenements' ? T('aune.header_index24h') : T('csv.points')).toUpperCase() + ' · ' + T('csv.share').toUpperCase(), W - PAD, yRows - 14); ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(95,140,255,0.35)'; ctx.beginPath(); ctx.moveTo(PAD, yRows - 6); ctx.lineTo(W - PAD, yRows - 6); ctx.stroke();
    // rangs
    rows.forEach(function (r, i) {
      var y = yRows + i * ROW, mid = y + ROW / 2 + 6;
      if (i < 3) { ctx.fillStyle = 'rgba(40,70,160,0.14)'; ctx.fillRect(PAD - 10, y + 2, W - 2 * PAD + 20, ROW - 4); }
      ctx.font = '700 20px "Space Mono"'; ctx.fillStyle = i === 0 ? '#ffc857' : i === 1 ? '#d9e2f5' : i === 2 ? '#d9a86c' : 'rgba(120,165,255,0.75)';
      ctx.fillText(String(r.rank), PAD, mid);
      ctx.font = '700 13px "Space Mono"';
      var tr = r.trend || '', col = /^▲/.test(tr) ? '#4ade80' : /^▼/.test(tr) ? '#f87171' : /^[—-]/.test(tr) ? 'rgba(150,178,225,0.7)' : '#fbbf24';
      if (/retour|back/i.test(tr)) col = '#c084fc';
      ctx.fillStyle = col; ctx.fillText(tr, PAD + 44, mid);
      var x = colTitle;
      if (r.bandLabel) {
        ctx.font = '700 9px "Space Grotesk"'; var lab = r.bandLabel.toUpperCase(); var lw = ctx.measureText(lab).width + 14;
        ctx.fillStyle = BAND[r.band] || BAND.aucune; roundRect(ctx, x, mid - 12, lw, 16, 4); ctx.fill();
        ctx.fillStyle = r.band === 'extreme' ? '#ffffff' : '#060d22'; ctx.fillText(lab, x + 7, mid - 1);
        x += lw + 10;
      }
      ctx.font = '600 16px "Space Grotesk"'; ctx.fillStyle = '#f1f5ff'; ctx.fillText(truncate(ctx, r.title, colPts - 70 - x), x, mid);
      ctx.textAlign = 'right'; ctx.font = '700 18px "Space Mono"'; ctx.fillStyle = '#ffffff'; ctx.fillText(fmt1(r.points), colPts + 12, mid);
      ctx.font = '400 10px "Space Mono"'; ctx.fillStyle = 'rgba(150,178,225,0.8)'; ctx.fillText(T('classement.png.pts'), colPts + 40, mid);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(60,100,200,0.25)'; ctx.fillRect(colBar, mid - 7, 110, 4);
      var g = ctx.createLinearGradient(colBar, 0, colBar + 110, 0); g.addColorStop(0, '#5b8cff'); g.addColorStop(1, 'rgba(120,80,255,0.85)');
      ctx.fillStyle = g; ctx.fillRect(colBar, mid - 7, Math.max(2, 110 * Math.min(100, r.sharePct) / 100), 4);
      ctx.textAlign = 'right'; ctx.font = '400 11px "Space Mono"'; ctx.fillStyle = 'rgba(150,178,225,0.9)'; ctx.fillText(Math.round(r.sharePct) + ' %', W - PAD, mid + 1); ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(95,140,255,0.18)'; ctx.beginPath(); ctx.moveTo(PAD, y + ROW); ctx.lineTo(W - PAD, y + ROW); ctx.stroke();
    });
    // statistiques
    var tw = (W - 2 * PAD - 14 * (st.length - 1)) / st.length;
    st.forEach(function (s, i) {
      var x = PAD + i * (tw + 14);
      ctx.fillStyle = 'rgba(8,16,46,0.8)'; ctx.strokeStyle = 'rgba(95,140,255,0.3)'; roundRect(ctx, x, yStats, tw, 96, 10); ctx.fill(); ctx.stroke();
      ctx.font = (s.small ? '700 18px "Space Grotesk"' : '700 28px "Space Mono"'); ctx.fillStyle = '#f1f5ff'; ctx.fillText(truncate(ctx, s.v, tw - 32), x + 16, yStats + 48);
      ctx.font = '400 12px "Space Grotesk"'; ctx.fillStyle = 'rgba(150,178,225,0.95)'; ctx.fillText(truncate(ctx, s.l, tw - 32), x + 16, yStats + 74);
    });
    // pied : méthode, reprise, source, QR
    ctx.strokeStyle = 'rgba(95,140,255,0.35)'; ctx.beginPath(); ctx.moveTo(PAD, yFoot); ctx.lineTo(W - PAD, yFoot); ctx.stroke();
    var qrSize = 112, qrX = W - PAD - qrSize, qrY = yFoot + 24;
    var hasQr = drawQr(ctx, url(d), qrX, qrY, qrSize);
    var textW = (hasQr ? qrX - 40 : W - PAD) - PAD;
    ctx.font = '600 15px "Space Grotesk"'; ctx.fillStyle = '#f1f5ff'; ctx.fillText(truncate(ctx, T('classement.png.foot_method'), textW), PAD, yFoot + 40);
    ctx.font = '400 13px "Space Grotesk"'; ctx.fillStyle = 'rgba(200,216,255,0.9)';
    ctx.fillText(truncate(ctx, T('classement.png.foot_reuse'), textW), PAD, yFoot + 66);
    ctx.fillText(truncate(ctx, T('classement.png.foot_data'), textW), PAD, yFoot + 88);
    ctx.font = '400 12px "Space Mono"'; ctx.fillStyle = 'rgba(150,178,225,0.9)'; ctx.fillText(T('classement.png.foot_source'), PAD, yFoot + 124);
    if (hasQr) { ctx.textAlign = 'center'; ctx.font = '400 11px "Space Grotesk"'; ctx.fillStyle = 'rgba(200,216,255,0.9)'; ctx.fillText(T('classement.png.foot_scan'), qrX + qrSize / 2, qrY + qrSize + 26); ctx.textAlign = 'left'; }
    return canvas;
  }
  async function download() {
    var d = window.RadarAune && window.RadarAune.exportData ? window.RadarAune.exportData(20) : null;
    if (!d || !d.rows.length) return;
    var canvas = await render(d);
    var name = 'radarplus_' + (d.hot ? 'hot20' : 'classement') + '_' + d.type + '_' + d.region + '_' + d.slug + '.png';
    canvas.toBlob(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }, 'image/png');
  }
  window.RadarClassementPng = { render: render, download: download };
})();
