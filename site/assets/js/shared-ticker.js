(function(window, document) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function formatTickerGeneratedAt(ms) {
    var dt = new Date(ms);
    if (isNaN(dt.getTime())) return 'Les Unes indisponibles';

    var hhmm = new Intl.DateTimeFormat('fr-CA', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(dt);

    return 'Les Unes de ' + hhmm;
  }

  function initSharedTicker() {
    var section = document.getElementById('ticker-section');
    var track = document.getElementById('ticker-track');
    var updated = document.getElementById('ticker-updated');

    if (!section || !track) return;
    if (section.dataset.tickerInitialized === '1') return;
    section.dataset.tickerInitialized = '1';

    var tickerGeneratedAtMs = null;
    var tickerLabelTimerStarted = false;

    function refreshTickerGeneratedAtLabel() {
      if (!updated) return;
      if (!tickerGeneratedAtMs) {
        updated.textContent = 'Les Unes indisponibles';
        return;
      }
      updated.textContent = formatTickerGeneratedAt(tickerGeneratedAtMs);
    }

    function setTickerGeneratedAt(isoTs) {
      var ms = isoTs ? Date.parse(isoTs) : NaN;
      tickerGeneratedAtMs = isNaN(ms) ? null : ms;
      refreshTickerGeneratedAtLabel();
      if (!tickerLabelTimerStarted) {
        tickerLabelTimerStarted = true;
        window.setInterval(refreshTickerGeneratedAtLabel, 60000);
      }
    }

    function renderTicker(items) {
      if (!Array.isArray(items) || !items.length) {
        track.innerHTML = '<span class="ticker-empty">Aucune manchette récente.</span>';
        section.classList.add('ready');
        return;
      }

      var payload = items.map(function(item) {
        var media = escapeHtml(item.media_id || '');
        var title = escapeHtml(item.title || 'Article');
        var url = escapeHtml(item.url || '#');
        return '<a class="ticker-item" href="' + url + '" target="_blank" rel="noopener"><span class="ticker-media">' + media + '</span>' + title + '</a>';
      }).join('<span class="ticker-sep">&bull;</span>');

      track.innerHTML = '<div class="ticker-strip">' + payload + '</div><div class="ticker-strip" aria-hidden="true">' + payload + '</div>';

      window.requestAnimationFrame(function() {
        var firstStrip = track.querySelector('.ticker-strip');
        var px = firstStrip ? firstStrip.scrollWidth : 1600;
        var duration = Math.max(35, Math.round(px / 70));
        track.style.setProperty('--ticker-duration', duration + 's');
        section.classList.add('ready');
      });
    }

    async function loadTicker() {
      try {
        var res = await fetch('./ticker.json?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('fetch failed');
        var data = await res.json();
        setTickerGeneratedAt(data && data.meta ? data.meta.generated_at : null);
        renderTicker(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        setTickerGeneratedAt(null);
        track.innerHTML = '<span class="ticker-empty">Erreur de chargement du ticker.</span>';
        section.classList.add('ready');
      }
    }

    loadTicker();
    window.setInterval(loadTicker, 120000);
  }

  window.initSharedTicker = initSharedTicker;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSharedTicker, { once: true });
  } else {
    initSharedTicker();
  }
})(window, document);
