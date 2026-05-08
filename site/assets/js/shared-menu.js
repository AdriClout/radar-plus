(function(window, document) {
  'use strict';

  var HOME_LOGO_SVG =
    '<svg viewBox="0 0 700 700" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g transform="translate(0,700) scale(0.1,-0.1)" stroke="none">' +
        '<path class="rp-r" d="M262 3666 l3 -2051 338 0 c292 0 340 2 346 15 4 8 6 385 6 838 -1 821 -1 823 20 827 11 2 274 3 585 2 505 -3 572 -5 630 -21 94 -25 178 -70 235 -124 65 -60 98 -111 126 -192 24 -70 23 -50 33 -715 3 -265 5 -285 30 -380 15 -55 43 -134 63 -175 l36 -75 356 2 c196 0 366 1 379 2 22 1 22 3 -17 73 -59 108 -110 232 -136 333 -23 86 -24 105 -25 460 -1 204 -3 381 -5 395 -15 113 -25 159 -51 239 -62 187 -206 360 -361 436 -46 22 -83 43 -83 47 0 3 17 16 38 29 57 35 171 128 231 188 186 192 291 453 286 716 -4 164 -43 323 -120 481 -122 251 -309 434 -580 566 -127 62 -251 99 -420 124 -27 4 -476 8 -998 9 l-947 1 2 -2050z m1682 1463 c123 -1 174 -5 228 -20 271 -75 448 -306 451 -589 1 -101 -7 -159 -32 -231 -63 -182 -198 -310 -401 -381 -64 -22 -73 -22 -651 -26 l-585 -3 0 623 c-1 343 3 625 7 628 6 4 471 4 983 -1z"/>' +
        '<path class="rp-plus" d="M5000 4840 l-55 -5 1 -590 c0 -324 -1 -595 -3 -600 -2 -7 -214 -10 -618 -10 -405 0 -616 -3 -618 -10 -3 -9 -1 -493 2 -505 0 -3 279 -5 619 -5 l617 0 1 -590 c1 -325 2 -597 3 -605 1 -14 39 -16 294 -16 l293 0 -1 599 c0 389 4 601 10 605 6 4 287 7 625 7 l615 0 0 257 c1 171 -3 259 -10 261 -5 2 -286 3 -622 3 -401 -1 -614 2 -616 9 -1 5 -2 275 -2 599 1 405 -2 589 -9 592 -17 6 -464 10 -526 4z"/>' +
      '</g>' +
    '</svg>';

  function injectHomeLogo() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    // Skip sur l'accueil (où le logo serait redondant) et sur les pages
    // qui ont déjà leur propre logo intégré dans un panneau gauche
    // (evolution.html: #evo-logo, constellation.html: #cst-logo).
    if (page === 'index.html' || page === '') return;
    if (document.getElementById('evo-logo') || document.getElementById('cst-logo')) return;
    if (document.getElementById('home-logo')) return;
    var a = document.createElement('a');
    a.id = 'home-logo';
    a.className = 'home-logo';
    a.href = './';
    a.setAttribute('aria-label', 'Retour à l’accueil Radar+');
    a.innerHTML = HOME_LOGO_SVG;
    document.body.insertBefore(a, document.body.firstChild);
  }

  function setupSharedMenu() {
    if (document.querySelector('.side-nav')) return;

    injectHomeLogo();
    document.body.classList.add('has-shared-menu');

    var navToggle = document.createElement('button');
    navToggle.className = 'nav-toggle';
    navToggle.id = 'navToggle';
    navToggle.setAttribute('aria-label', 'Ouvrir le menu');
    navToggle.innerHTML = '<span></span><span></span><span></span>';

    var menuHint = document.createElement('a');
    menuHint.href = '#';
    menuHint.className = 'menu-discover-hint';
    menuHint.id = 'menuDiscoverHint';
    menuHint.setAttribute('aria-label', 'Ouvrir le menu');
    menuHint.innerHTML = 'Ouvrir menu <span class="menu-discover-arrow"></span>';

    var sideNav = document.createElement('nav');
    sideNav.className = 'side-nav';
    sideNav.id = 'sideNav';
    sideNav.setAttribute('aria-label', 'Navigation principale');
    sideNav.innerHTML = [
      '<h3>Navigation</h3>',
      '<a href="./index.html" data-page="index.html">Accueil</a>',
      '<a href="./constellation.html" data-page="constellation.html">Constellation <span class="nav-badge">LIVE</span></a>',
      '<a href="./evolution.html" data-page="evolution.html">Évolution <span class="nav-badge">TIMELINE</span></a>',
      '<a href="./alertes.html" data-page="alertes.html">Alertes <span class="nav-badge nav-badge-alert" id="nav-alert-badge">!</span></a>',
      '<a href="./statistiques.html" data-page="statistiques.html">Statistiques <span class="nav-badge">OBJET</span></a>',
      '<a href="./sonar.html" data-page="sonar.html">Sonar <span class="nav-badge">MONITORING</span></a>',
      '<a href="./index.html#hot20">Hot 20</a>',
      '<a href="./unes.html" data-page="unes.html">Dans le radar</a>',
      '<a href="https://github.com/adriclout/radar-plus/tree/main/analyses" target="_blank" rel="noopener">Analyses</a>',
      '<h3 style="margin-top: 30px;">À propos</h3>',
      '<a href="./radarplus.html" data-page="radarplus.html">Radar+</a>',
      '<a href="./methodologie.html" data-page="methodologie.html">Méthodologie</a>',
      '<a href="./partenaires.html" data-page="partenaires.html">Partenaires &amp; contributeurs</a>',
      '<a href="./acces-donnees.html" data-page="acces-donnees.html">Accès aux données</a>',
      '<a href="https://github.com/adriclout/radar-plus" target="_blank" rel="noopener">GitHub</a>'
    ].join('');

    document.body.insertBefore(sideNav, document.body.firstChild);
    document.body.insertBefore(menuHint, sideNav);
    document.body.insertBefore(navToggle, menuHint);

    var current = window.location.pathname.split('/').pop() || 'index.html';
    var currentLink = sideNav.querySelector('a[data-page="' + current + '"]');
    if (currentLink) currentLink.classList.add('current');

    function setNavOpen(open) {
      navToggle.classList.toggle('open', open);
      sideNav.classList.toggle('open', open);
      navToggle.setAttribute('aria-expanded', String(open));
    }

    navToggle.addEventListener('click', function() {
      var willOpen = !sideNav.classList.contains('open');
      setNavOpen(willOpen);
    });

    menuHint.addEventListener('click', function(event) {
      event.preventDefault();
      setNavOpen(true);
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && sideNav.classList.contains('open')) {
        setNavOpen(false);
      }
    });

    document.addEventListener('click', function(event) {
      if (!sideNav.classList.contains('open')) return;
      if (
        sideNav.contains(event.target) ||
        navToggle.contains(event.target) ||
        menuHint.contains(event.target)
      ) {
        return;
      }
      setNavOpen(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSharedMenu, { once: true });
  } else {
    setupSharedMenu();
  }

  /* ================================================================
     BANDEAU D'ALERTE GLOBAL
     Barre fixe en haut de toutes les pages, affiche les alertes
     fortes et alertes de la période la plus récente.
  ================================================================ */

  var ALERT_BAR_LEVELS = ['strong', 'alert'];
  var ALERT_BAR_LABELS = { strong: 'Alerte forte', alert: 'Alerte' };

  function escHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectAlertBar() {
    if (document.getElementById('global-alert-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'global-alert-bar';
    bar.setAttribute('aria-label', 'Alertes de saillance actives');
    bar.innerHTML =
      '<a class="alert-bar-label" href="./alertes.html" aria-label="Voir les alertes">' +
        '<span class="alert-bar-dot" aria-hidden="true"></span>' +
        '<span class="alert-bar-label-text">ALERTE</span>' +
      '</a>' +
      '<div class="alert-bar-track" id="alert-bar-track">' +
        '<div class="alert-bar-strip" id="alert-bar-strip"></div>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-alert-bar');
  }

  function buildBarItems(alerts) {
    return alerts.map(function(a) {
      var lbl = ALERT_BAR_LABELS[a.level] || a.level;
      var sc  = a.score !== null ? ' \u00b7\u00a0z\u00a0' + a.score.toFixed(1) + '\u00d7' : '';
      return '<span class="alert-bar-item level-' + escHtml(a.level) + '">' +
        '<span class="alert-bar-item-badge">' + escHtml(lbl) + '</span>' +
        '<span class="alert-bar-item-name">'  + escHtml(a.id)  + '</span>' +
        (sc ? '<span class="alert-bar-item-score">' + escHtml(sc) + '</span>' : '') +
        '<span class="alert-bar-item-country">' + escHtml(a.country) + '</span>' +
        '</span>' +
        '<span class="alert-bar-sep" aria-hidden="true">\u2022</span>';
    }).join('');
  }

  function populateAlertBar(graphData) {
    var strip    = document.getElementById('alert-bar-strip');
    var bar      = document.getElementById('global-alert-bar');
    var navBadge = document.getElementById('nav-alert-badge');
    if (!strip || !bar) return;

    var periods   = (graphData.meta && graphData.meta.periods) ? graphData.meta.periods : [];
    var countries = Object.keys(graphData.graphs || {});
    var alerts    = [];
    var seen      = {};

    // Uniquement la période la plus récente: évite d'afficher des alertes déjà terminées.
    var latestPeriod = periods.length ? periods[periods.length - 1] : null;
    var pKey = latestPeriod && latestPeriod.key;
    for (var ci = 0; ci < countries.length; ci++) {
      var country = countries[ci];
      var gd = graphData.graphs[country] && graphData.graphs[country][pKey];
      if (!gd) continue;
      var nodes = gd.nodes || [];
      for (var ni = 0; ni < nodes.length; ni++) {
        var node = nodes[ni];
        if (ALERT_BAR_LEVELS.indexOf(node.alert_level) === -1) continue;
        if (!node.alert_active) continue;
        var key = country + ':' + node.id;
        if (seen[key]) continue;
        seen[key] = true;
        var score = Number(node.alert_score);
        alerts.push({ id: node.id, level: node.alert_level, score: isFinite(score) ? score : null, country: country });
      }
    }

    // Trier: strong > alert, puis score desc
    alerts.sort(function(a, b) {
      var la = a.level === 'strong' ? 0 : 1, lb = b.level === 'strong' ? 0 : 1;
      if (la !== lb) return la - lb;
      return (b.score || 0) - (a.score || 0);
    });

    // Badge compteur dans le menu
    if (navBadge) {
      if (alerts.length) { navBadge.textContent = String(alerts.length); navBadge.classList.add('active'); }
      else { navBadge.style.display = 'none'; }
    }

    if (!alerts.length) {
      bar.style.display = 'none';
      document.body.classList.remove('has-alert-bar');
      return;
    }

    bar.classList.remove('bar-strong', 'bar-alert');
    bar.classList.add('bar-' + alerts[0].level);

    var itemsHtml = buildBarItems(alerts);
    strip.innerHTML = itemsHtml + itemsHtml; // doublon initial pour défilement infini

    window.requestAnimationFrame(function() {
      // L'animation translateX(-50%) suppose 2 moitiés identiques. Si le
      // strip est plus étroit que la zone visible, on voit du vide à
      // droite — on rajoute des copies (paire) jusqu'à dépasser la piste.
      var track = document.getElementById('alert-bar-track');
      var trackW = track ? track.clientWidth : 800;
      var halfW  = strip.scrollWidth / 2 || 1;
      if (halfW < trackW + 40) {
        var copies = Math.max(2, Math.ceil((trackW + 40) / halfW) * 2);
        var multi = '';
        for (var i = 0; i < copies; i++) multi += itemsHtml;
        strip.innerHTML = multi;
        halfW = strip.scrollWidth / 2 || halfW;
      }
      // Vitesse uniforme ~1.5 px/s (très lent, lecture très posée).
      // Plancher 360s. Vitesse en px/s identique quel que soit le
      // nombre d'alertes: halfW et dur grandissent proportionnellement.
      var pxPerSec = 1.5;
      var dur = Math.max(360, Math.round(halfW / pxPerSec));
      strip.style.setProperty('--alert-strip-dur', dur + 's');
      bar.classList.add('ready');
    });
  }

  function initAlertBar() {
    injectAlertBar();
    fetch('./graph.json', { cache: 'no-store' })
      .then(function(res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function(data) { populateAlertBar(data); })
      .catch(function() {
        var bar = document.getElementById('global-alert-bar');
        if (bar) bar.style.display = 'none';
        document.body.classList.remove('has-alert-bar');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAlertBar, { once: true });
  } else {
    initAlertBar();
  }

})(window, document);
