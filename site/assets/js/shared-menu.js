(function(window, document) {
  'use strict';

  /* ================================================================
     GOOGLE ANALYTICS 4 (gtag.js)
     Property "Radar+" sur le compte personnel Adrien Cloutier.
     Inject ASAP pour ne perdre aucun pageview. Les événements custom
     sont envoyés ailleurs dans le code via window.gtag('event', ...).
  ================================================================ */
  var GA_MEASUREMENT_ID = 'G-Y2X19DCWGZ';
  (function loadGtag() {
    if (window.gtag || !GA_MEASUREMENT_ID) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      // Anonymize IP par défaut, plus respectueux et conforme RGPD
      anonymize_ip: true
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    (document.head || document.documentElement).appendChild(s);
  })();

  // Helper exposé pour les pages: window.radarTrack('event_name', { ... })
  window.radarTrack = function(eventName, params) {
    if (typeof window.gtag !== 'function') return;
    try { window.gtag('event', eventName, params || {}); } catch (_) { /* noop */ }
  };

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
    a.setAttribute('data-i18n-aria-label', 'nav.home_logo_aria');
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
    navToggle.setAttribute('data-i18n-aria-label', 'nav.menu_open_aria');
    navToggle.setAttribute('aria-label', 'Ouvrir le menu');
    navToggle.innerHTML = '<span></span><span></span><span></span>';

    var menuHint = document.createElement('a');
    menuHint.href = '#';
    menuHint.className = 'menu-discover-hint';
    menuHint.id = 'menuDiscoverHint';
    menuHint.setAttribute('data-i18n-aria-label', 'nav.menu_open_aria');
    menuHint.setAttribute('aria-label', 'Ouvrir le menu');
    menuHint.innerHTML = '<span data-i18n="nav.menu_open_hint">Ouvrir menu</span> <span class="menu-discover-arrow"></span>';

    var sideNav = document.createElement('nav');
    sideNav.className = 'side-nav';
    sideNav.id = 'sideNav';
    sideNav.setAttribute('data-i18n-aria-label', 'nav.main_nav_aria');
    sideNav.setAttribute('aria-label', 'Navigation principale');
    sideNav.innerHTML = [
      '<div class="lang-switch" id="lang-switch" role="group" aria-label="Language">',
      '  <button type="button" class="lang-btn" data-lang="fr" aria-label="Français">FR</button>',
      '  <button type="button" class="lang-btn" data-lang="en" aria-label="English">EN</button>',
      '</div>',
      '<h3 data-i18n="nav.section_navigation">Navigation</h3>',
      '<a href="./index.html" data-page="index.html" data-i18n="nav.home">Accueil</a>',
      '<a href="./constellation.html" data-page="constellation.html"><span data-i18n="nav.constellation">Constellation</span> <span class="nav-badge" data-i18n="nav.badge_live">LIVE</span></a>',
      '<a href="./evolution.html" data-page="evolution.html"><span data-i18n="nav.evolution">Évolution</span> <span class="nav-badge" data-i18n="nav.badge_timeline">TIMELINE</span></a>',
      '<a href="./alertes.html" data-page="alertes.html"><span data-i18n="nav.alertes">Alertes</span> <span class="nav-badge nav-badge-alert" id="nav-alert-badge" data-i18n="nav.alert_marker">!</span></a>',
      '<a href="./statistiques.html" data-page="statistiques.html"><span data-i18n="nav.statistiques">Statistiques</span> <span class="nav-badge" data-i18n="nav.badge_object">OBJET</span></a>',
      '<a href="./sonar.html" data-page="sonar.html"><span data-i18n="nav.sonar">Sonar</span> <span class="nav-badge" data-i18n="nav.badge_monitoring">MONITORING</span></a>',
      '<a href="./index.html#hot20" data-i18n="nav.hot20">Hot 20</a>',
      '<a href="./unes.html" data-page="unes.html" data-i18n="nav.unes">Dans le radar</a>',
      '<a href="https://www.clessn.com/radar/index.html" target="_blank" rel="noopener" data-i18n="nav.analyses">Analyses</a>',
      '<h3 style="margin-top: 30px;" data-i18n="nav.section_about">À propos</h3>',
      '<a href="./radarplus.html" data-page="radarplus.html" data-i18n="nav.radarplus">Radar+</a>',
      '<a href="./methodologie.html" data-page="methodologie.html" data-i18n="nav.methodologie">Méthodologie</a>',
      '<a href="./partenaires.html" data-page="partenaires.html" data-i18n="nav.partenaires">Partenaires &amp; contributeurs</a>',
      '<a href="./acces-donnees.html" data-page="acces-donnees.html" data-i18n="nav.acces_donnees">Accès aux données</a>',
      '<a href="https://github.com/adriclout/radar-plus" target="_blank" rel="noopener" class="nav-github" data-i18n-aria-label="nav.github" aria-label="GitHub">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">' +
          '<path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39s1.97.13 2.89.39c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z"/>' +
        '</svg>' +
      '</a>'
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

    // Toggle FR/EN: handler + état actif synchronisé avec __i18n.
    function refreshLangButtons() {
      var lang = (window.__i18n && window.__i18n.currentLang && window.__i18n.currentLang()) || 'fr';
      sideNav.querySelectorAll('.lang-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
    }
    sideNav.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.__i18n && window.__i18n.setLang) {
          window.__i18n.setLang(btn.dataset.lang).then(refreshLangButtons);
        }
      });
    });
    refreshLangButtons();
    document.addEventListener('i18n:applied', refreshLangButtons);
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

  function alertBarLabel(level) {
    if (window.t) {
      var k = 'alertbar.level.' + level;
      var v = window.t(k);
      if (v && v !== k) return v;
    }
    return level;
  }

  function escHtml(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectAlertBar() {
    if (document.getElementById('global-alert-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'global-alert-bar';
    bar.setAttribute('data-i18n-aria-label', 'alertbar.active_aria');
    bar.setAttribute('aria-label', 'Alertes de saillance actives');
    bar.innerHTML =
      '<a class="alert-bar-label" href="./alertes.html" data-i18n-aria-label="alertbar.view_alerts_aria" aria-label="Voir les alertes">' +
        '<span class="alert-bar-dot" aria-hidden="true"></span>' +
        '<span class="alert-bar-label-text" data-i18n="alertbar.label">ALERTE</span>' +
      '</a>' +
      '<div class="alert-bar-track" id="alert-bar-track">' +
        '<div class="alert-bar-strip" id="alert-bar-strip"></div>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-alert-bar');
  }

  function buildBarItems(alerts) {
    return alerts.map(function(a) {
      var lbl = alertBarLabel(a.level);
      var sc  = a.score !== null ? ' \u00b7\u00a0z\u00a0' + a.score.toFixed(1) + '\u00d7' : '';
      var href = './evolution.html?country=' + encodeURIComponent(a.country) +
                 '&node=' + encodeURIComponent(a.id) +
                 '&mode=tracking&gran=week';
      return '<a class="alert-bar-item level-' + escHtml(a.level) + '" href="' + escHtml(href) + '">' +
        '<span class="alert-bar-item-badge">' + escHtml(lbl) + '</span>' +
        '<span class="alert-bar-item-name">'  + escHtml(a.id)  + '</span>' +
        (sc ? '<span class="alert-bar-item-score">' + escHtml(sc) + '</span>' : '') +
        '<span class="alert-bar-item-country">' + escHtml(a.country) + '</span>' +
        '</a>' +
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

    // Toujours partir d'une seule copie de itemsHtml comme référence
    // de mesure. La logique du multiplicateur ci-dessous calcule
    // combien de copies sont nécessaires pour remplir la piste, puis
    // pose le strip final avec un nombre PAIR de copies (pour que
    // translateX(-50%) reste un loop continu).
    //
    // Token de synchro: si populateAlertBar est rappelé rapidement
    // (ex: changement de langue après le fetch initial), seule la
    // dernière rAF s'exécute. Sinon les rAF se chevauchent et
    // multiplient la largeur déjà multipliée → strip 4x/8x trop large
    // → vitesse perçue ultra-lente.
    var itemsHtml = buildBarItems(alerts);
    strip.innerHTML = itemsHtml; // une seule copie initiale, on multipliera dans rAF
    var token = (_alertBarRenderToken = (_alertBarRenderToken || 0) + 1);

    window.requestAnimationFrame(function() {
      if (token !== _alertBarRenderToken) return; // appel obsolète
      var track = document.getElementById('alert-bar-track');
      var trackW = track ? track.clientWidth : 800;
      // Largeur d'UNE copie (la référence stable, pas la version multipliée)
      var oneW = strip.scrollWidth || 1;
      // On veut au moins 2 copies (pour le loop) et assez pour que
      // 1 demi-strip dépasse la piste avec une marge de 40px.
      var copies = Math.max(2, Math.ceil((trackW + 40) / oneW) * 2);
      var multi = '';
      for (var i = 0; i < copies; i++) multi += itemsHtml;
      strip.innerHTML = multi;
      var halfW = strip.scrollWidth / 2 || oneW;

      // Vitesse uniforme ~1.5 px/s (très lent, lecture très posée).
      // Plancher 360s. Indépendant du nombre d'alertes/copies.
      var pxPerSec = 1.5;
      var dur = Math.max(360, Math.round(halfW / pxPerSec));
      strip.style.setProperty('--alert-strip-dur', dur + 's');
      bar.classList.add('ready');
    });
  }
  var _alertBarRenderToken = 0;

  var _lastAlertGraphData = null;
  function initAlertBar() {
    injectAlertBar();
    fetch('./graph.json', { cache: 'no-store' })
      .then(function(res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function(data) {
        _lastAlertGraphData = data;
        populateAlertBar(data);
      })
      .catch(function() {
        var bar = document.getElementById('global-alert-bar');
        if (bar) bar.style.display = 'none';
        document.body.classList.remove('has-alert-bar');
      });
  }
  // À chaque changement de langue, on met à jour UNIQUEMENT le texte
  // des badges de niveau (Alerte/Veille/...) en place. On NE refait
  // PAS populateAlertBar — sinon le strip est réinitialisé à 1 copie,
  // les copies sont recalculées et la durée d'animation change, ce
  // qui produisait l'effet "défilement super lent" après 1-2
  // changements de langue.
  document.addEventListener('i18n:applied', function () {
    var strip = document.getElementById('alert-bar-strip');
    if (!strip) return;
    strip.querySelectorAll('.alert-bar-item').forEach(function (item) {
      var cls = item.className.match(/level-(\w+)/);
      if (!cls) return;
      var badge = item.querySelector('.alert-bar-item-badge');
      if (badge) badge.textContent = alertBarLabel(cls[1]);
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAlertBar, { once: true });
  } else {
    initAlertBar();
  }

})(window, document);
