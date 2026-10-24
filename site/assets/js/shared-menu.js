(function(window, document) {
  'use strict';

  /* ================================================================
     GOOGLE ANALYTICS 4 (gtag.js)
     Property "Radar+" sur le compte personnel Adrien Cloutier.
     Inject ASAP pour ne perdre aucun pageview. Les événements custom
     sont envoyés ailleurs dans le code via window.gtag('event', ...).
  ================================================================ */
  var GA_MEASUREMENT_ID = 'G-Y2X19DCWGZ';
  var REPORT_REPO = 'AdriClout/radar-plus';
  var REPORT_EVENT_TYPE = 'radar-report-issue';
  var REPORT_TOKEN = (window.RADAR_REPORT_DISPATCH_TOKEN || '__RADAR_REPORT_DISPATCH_TOKEN__').trim();
  if (REPORT_TOKEN === '__RADAR_REPORT_DISPATCH_TOKEN__') REPORT_TOKEN = '';
  var REPORT_ENABLED = REPORT_TOKEN.length > 0;
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
    var page = currentPage();
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

  // Bandeau de menu en haut de page (décision d'Adrien, 24 oct. 2026) : robot +
  // RADAR+ à gauche, pages principales au centre, FR/EN et bouton du tiroir à
  // droite. En flux (sticky), donc il ne recouvre rien. Pas sur les deux outils
  // plein écran (évolution, constellation), qui gardent leur panneau gauche.
  // Page courante : sur Cloudflare Pages, /alertes.html est servi comme /alertes ;
  // on ramène toujours au nom de fichier pour marquer le lien actif.
  function currentPage() {
    var last = window.location.pathname.split('/').pop() || '';
    if (!last) return 'index.html';
    return /\.html$/.test(last) ? last : last + '.html';
  }

  var NO_BAR_PAGES = {}; // bandeau sur toutes les pages (décision du 24 oct. au soir)
  function injectSiteBar() {
    var page = currentPage();
    if (NO_BAR_PAGES[page] || document.getElementById('site-bar')) return null;
    var bar = document.createElement('header');
    bar.id = 'site-bar';
    bar.className = 'site-bar';
    bar.innerHTML =
      '<a class="site-bar-brand" href="./index.html" data-i18n-aria-label="nav.home_logo_aria" aria-label="Retour à l’accueil Radar+">' +
        '<span class="site-bar-robot" aria-hidden="true"></span>' +
        '<span class="site-bar-word">RADAR<span class="site-bar-plus">+</span></span>' +
        '<span class="site-bar-beta" aria-hidden="true">BETA</span>' +
      '</a>' +
      '<nav class="site-bar-nav" data-i18n-aria-label="nav.main_nav_aria" aria-label="Navigation principale">' +
        '<a href="./index.html" data-page="index.html" data-i18n="nav.home">Accueil</a>' +
        '<a href="./constellation.html" data-page="constellation.html" data-i18n="nav.constellation">Constellation</a>' +
        '<a href="./evolution.html" data-page="evolution.html" data-i18n="nav.evolution">Évolution</a>' +
        '<a href="./alertes.html" data-page="alertes.html" data-i18n="nav.alertes">Alertes</a>' +
        '<a href="./statistiques.html" data-page="statistiques.html" data-i18n="nav.statistiques">Statistiques</a>' +
        '<a href="./sonar.html" data-page="sonar.html" data-i18n="nav.sonar">Sonar</a>' +
        '<a href="./unes.html" data-page="unes.html" data-i18n="nav.unes">Dans le radar</a>' +
        '<a href="./methodologie.html" data-page="methodologie.html" data-i18n="nav.methodologie">Méthodologie</a>' +
        // Tout ce qui restait dans l'ancien tiroir : menu déroulant vers le bas.
        '<div class="site-bar-dropdown">' +
          '<button type="button" class="site-bar-dropdown-btn" aria-haspopup="true" aria-expanded="false">' +
            '<span data-i18n="nav.section_about">À propos</span> <span class="site-bar-caret" aria-hidden="true">\u25be</span>' +
          '</button>' +
          '<div class="site-bar-dropdown-menu" role="menu">' +
            '<a href="./radarplus.html" data-page="radarplus.html" data-i18n="nav.radarplus">Radar+</a>' +
            '<a href="./partenaires.html" data-page="partenaires.html" data-i18n="nav.partenaires">Partenaires &amp; contributeurs</a>' +
            '<a href="./acces-donnees.html" data-page="acces-donnees.html" data-i18n="nav.acces_donnees">Accès aux données</a>' +
            '<a href="https://www.clessn.com/radar/index.html" target="_blank" rel="noopener" data-i18n="nav.analyses">Analyses</a>' +
            '<a href="#" class="site-bar-report-link" data-i18n="nav.report_issue">Signaler un problème</a>' +
            '<a href="https://github.com/adriclout/radar-plus" target="_blank" rel="noopener">GitHub</a>' +
          '</div>' +
        '</div>' +
      '</nav>' +
      '<div class="site-bar-right">' +
        '<div class="lang-switch site-bar-lang" role="group" aria-label="Language">' +
          '<button type="button" class="lang-btn" data-lang="fr" aria-label="Français">FR</button>' +
          '<button type="button" class="lang-btn" data-lang="en" aria-label="English">EN</button>' +
        '</div>' +
      '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.classList.add('has-site-bar');
    var current = bar.querySelector('.site-bar-nav a[data-page="' + page + '"]');
    if (current) {
      current.classList.add('current');
      var dd = current.closest('.site-bar-dropdown');
      if (dd) dd.classList.add('current');
    }
    // Menu déroulant « À propos » : clic (et clavier) ; se ferme au clic ailleurs.
    var ddBtn = bar.querySelector('.site-bar-dropdown-btn');
    var ddWrap = bar.querySelector('.site-bar-dropdown');
    function setDropdown(open) {
      ddWrap.classList.toggle('open', open);
      ddBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    ddBtn.addEventListener('click', function(e) { e.stopPropagation(); setDropdown(!ddWrap.classList.contains('open')); });
    document.addEventListener('click', function(e) { if (!ddWrap.contains(e.target)) setDropdown(false); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') setDropdown(false); });
    var rep = bar.querySelector('.site-bar-report-link');
    if (rep) rep.addEventListener('click', function(e) {
      e.preventDefault(); setDropdown(false);
      if (typeof window.__radarIssueReporterOpen === 'function') window.__radarIssueReporterOpen();
    });
    return bar;
  }

  function setupSharedMenu() {
    if (document.querySelector('.side-nav')) return;

    var siteBar = injectSiteBar();
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

    // Panneau de menu : descend sous le bandeau, pleine largeur (plus de tiroir à droite).
    var sideNav = document.createElement('nav');
    sideNav.className = 'side-nav site-menu-panel';
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
      '<a href="./sonar.html" data-page="sonar.html"><span data-i18n="nav.sonar">Sonar</span> <span class="nav-badge" data-i18n="nav.badge_qualite">QUALITÉ</span></a>',
      '<a href="./index.html#hot20" data-i18n="nav.hot20">Hot 20</a>',
      '<a href="./unes.html" data-page="unes.html" data-i18n="nav.unes">Dans le radar</a>',
      '<a href="https://www.clessn.com/radar/index.html" target="_blank" rel="noopener" data-i18n="nav.analyses">Analyses</a>',
      '<h3 style="margin-top: 30px;" data-i18n="nav.section_about">À propos</h3>',
      '<a href="./radarplus.html" data-page="radarplus.html" data-i18n="nav.radarplus">Radar+</a>',
      '<a href="./methodologie.html" data-page="methodologie.html" data-i18n="nav.methodologie">Méthodologie</a>',
      '<a href="./partenaires.html" data-page="partenaires.html" data-i18n="nav.partenaires">Partenaires &amp; contributeurs</a>',
      '<a href="./acces-donnees.html" data-page="acces-donnees.html" data-i18n="nav.acces_donnees">Accès aux données</a>',
      '<a href="#" id="nav-report-link" data-i18n="nav.report_issue">Signaler un problème</a>',
      '<a href="https://github.com/adriclout/radar-plus" target="_blank" rel="noopener" class="nav-github" data-i18n-aria-label="nav.github" aria-label="GitHub">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">' +
          '<path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18.92-.26 1.91-.39 2.89-.39s1.97.13 2.89.39c2.21-1.49 3.18-1.18 3.18-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.68.8.56 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z"/>' +
        '</svg>' +
      '</a>'
    ].join('');

    document.body.insertBefore(sideNav, document.body.firstChild);
    // Le bouton du menu vit dans le bandeau ; plus d'indice « Ouvrir menu ».
    siteBar.querySelector('.site-bar-right').appendChild(navToggle);

    var current = currentPage();
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
      document.querySelectorAll('.lang-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.lang === lang);
      });
    }
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.__i18n && window.__i18n.setLang) {
          window.__i18n.setLang(btn.dataset.lang).then(refreshLangButtons);
        }
      });
    });
    refreshLangButtons();
    document.addEventListener('i18n:applied', refreshLangButtons);

    var reportLink = document.getElementById('nav-report-link');
    if (reportLink) {
      reportLink.addEventListener('click', function (event) {
        event.preventDefault();
        setNavOpen(false);
        if (typeof window.__radarIssueReporterOpen === 'function') {
          window.__radarIssueReporterOpen();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupSharedMenu, { once: true });
  } else {
    setupSharedMenu();
  }

  function reportText(key, fallback) {
    if (typeof window.t !== 'function') return fallback;
    var out = window.t(key);
    return (!out || out === key) ? fallback : out;
  }

  function closestSectionLabel(target) {
    if (!target || !target.closest) return '';

    var explicit = target.closest('[data-section]');
    if (explicit && explicit.getAttribute('data-section')) {
      return explicit.getAttribute('data-section').trim();
    }

    var container = target.closest('section, article, main, [id]');
    if (!container) return '';

    var heading = container.querySelector('h1, h2, h3');
    if (heading && heading.textContent) {
      return heading.textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
    }

    if (container.id) return container.id;
    return '';
  }

  function initIssueReporter() {
    if (document.getElementById('rp-issue-menu')) return;

    var uiState = 'idle';
    var reportCtx = {
      section: '',
      elementContext: '',
      page: window.location.pathname,
      url: window.location.href
    };

    var menu = document.createElement('div');
    menu.id = 'rp-issue-menu';
    menu.className = 'rp-issue-menu';
    menu.innerHTML = '<button type="button" id="rp-issue-menu-btn" data-i18n="report.menu_item">Signaler un problème</button>';
    document.body.appendChild(menu);

    var modal = document.createElement('div');
    modal.id = 'rp-issue-modal';
    modal.className = 'rp-issue-modal';
    modal.innerHTML = [
      '<div class="rp-issue-dialog" role="dialog" aria-modal="true" aria-labelledby="rp-issue-title">',
      '  <p class="rp-issue-kicker" id="rp-issue-kicker">Radar+</p>',
      '  <h2 id="rp-issue-title" data-i18n="report.modal_title">Signaler un problème</h2>',
      '  <p class="rp-issue-dek" data-i18n="report.modal_dek">Décris brièvement ce qui ne va pas, avec le plus de contexte possible.</p>',
      '  <p class="rp-issue-context" id="rp-issue-context"></p>',
      '  <label class="rp-issue-field-label" for="rp-issue-name">Nom (optionnel)</label>',
      '  <input type="text" id="rp-issue-name" maxlength="120" placeholder="Ex: Camille" autocomplete="name" />',
      '  <textarea id="rp-issue-text" maxlength="2000" data-i18n-placeholder="report.placeholder" placeholder="Ex: le score affiché semble incohérent avec les articles listés."></textarea>',
      '  <p class="rp-issue-note" id="rp-issue-note"></p>',
      '  <div class="rp-issue-actions">',
      '    <button type="button" class="rp-issue-btn ghost" id="rp-issue-cancel" data-i18n="report.cancel">Annuler</button>',
      '    <button type="button" class="rp-issue-btn" id="rp-issue-submit" data-i18n="report.submit">Envoyer</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    var menuBtn = document.getElementById('rp-issue-menu-btn');
    var nameInput = document.getElementById('rp-issue-name');
    var textarea = document.getElementById('rp-issue-text');
    var note = document.getElementById('rp-issue-note');
    var contextLine = document.getElementById('rp-issue-context');
    var kicker = document.getElementById('rp-issue-kicker');
    var submitBtn = document.getElementById('rp-issue-submit');
    var cancelBtn = document.getElementById('rp-issue-cancel');

    function applyReportTexts() {
      if (!note) return;
      if (!REPORT_ENABLED) {
        note.textContent = reportText('report.token_missing', 'Signalement hors ligne: configurer RADAR_REPORT_DISPATCH_TOKEN pour activer l\'envoi.');
      }
    }

    function closeMenu() {
      menu.classList.remove('open');
      uiState = uiState === 'menu' ? 'idle' : uiState;
    }

    function closeModal() {
      modal.classList.remove('open');
      if (nameInput) nameInput.value = '';
      if (textarea) textarea.value = '';
      if (note) note.textContent = REPORT_ENABLED ? '' : reportText('report.token_missing', 'Signalement hors ligne: configurer RADAR_REPORT_DISPATCH_TOKEN pour activer l\'envoi.');
      uiState = 'idle';
    }

    function openModal() {
      closeMenu();
      if (kicker) kicker.textContent = reportCtx.section || 'Radar+';
      if (contextLine) {
        contextLine.textContent = reportCtx.elementContext
          ? reportText('report.context_prefix', 'Contexte: ') + reportCtx.elementContext
          : '';
      }
      applyReportTexts();
      modal.classList.add('open');
      uiState = 'modal';
      setTimeout(function() {
        if (nameInput) {
          nameInput.focus();
          return;
        }
        if (textarea) textarea.focus();
      }, 10);
    }

    function showSubmitResult(ok) {
      if (!note) return;
      note.textContent = ok
        ? reportText('report.success', 'Merci, le signalement a été transmis.')
        : reportText('report.error', 'Échec de l\'envoi. Réessaie dans quelques instants.');
      note.classList.toggle('ok', !!ok);
      note.classList.toggle('error', !ok);
    }

    function openFromNav() {
      reportCtx = {
        section: reportText('report.default_section', 'Navigation Radar+'),
        elementContext: '',
        page: window.location.pathname,
        url: window.location.href
      };
      openModal();
    }

    async function submitReport() {
      if (!textarea || !submitBtn) return;
      var reporterName = nameInput ? (nameInput.value || '').trim() : '';
      var description = (textarea.value || '').trim();
      if (!description) return;
      if (!REPORT_ENABLED) {
        showSubmitResult(false);
        return;
      }

      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      if (note) {
        note.classList.remove('ok', 'error');
        note.textContent = reportText('report.sending', 'Envoi en cours...');
      }

      try {
        var payload = {
          event_type: REPORT_EVENT_TYPE,
          client_payload: {
            description: description,
            reporter_name: reporterName,
            section: reportCtx.section,
            element_context: reportCtx.elementContext,
            page: reportCtx.page,
            url: reportCtx.url,
            language: (window.__i18n && window.__i18n.currentLang && window.__i18n.currentLang()) || document.documentElement.lang || 'fr',
            user_agent: navigator.userAgent,
            submitted_at: new Date().toISOString()
          }
        };

        var res = await fetch('https://api.github.com/repos/' + REPORT_REPO + '/dispatches', {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer ' + REPORT_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        showSubmitResult(res.ok);
        if (res.ok) {
          if (textarea) textarea.value = '';
        }
      } catch (_) {
        showSubmitResult(false);
      } finally {
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
      }
    }

    window.__radarIssueReporterOpen = openFromNav;

    if (menuBtn) {
      menuBtn.addEventListener('click', function(event) {
        event.preventDefault();
        openModal();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        closeModal();
      });
    }
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        submitReport();
      });
    }
    if (textarea) {
      textarea.addEventListener('keydown', function(event) {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          submitReport();
        }
      });
    }

    modal.addEventListener('click', function(event) {
      if (event.target === modal) closeModal();
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        if (modal.classList.contains('open')) {
          closeModal();
          return;
        }
        if (menu.classList.contains('open')) closeMenu();
      }
    });

    document.addEventListener('click', function(event) {
      if (!menu.classList.contains('open')) return;
      if (menu.contains(event.target)) return;
      closeMenu();
    });

    document.addEventListener('contextmenu', function(event) {
      var target = event.target;
      if (!target || !(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;

      event.preventDefault();
      reportCtx = {
        section: closestSectionLabel(target) || reportText('report.default_section', 'Radar+'),
        elementContext: ((target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180)),
        page: window.location.pathname,
        url: window.location.href
      };

      if (kicker) kicker.textContent = reportCtx.section;
      if (contextLine) {
        contextLine.textContent = reportCtx.elementContext
          ? reportText('report.context_prefix', 'Contexte: ') + reportCtx.elementContext
          : '';
      }

      var x = event.clientX;
      var y = event.clientY;
      var maxX = Math.max(12, window.innerWidth - 220);
      var maxY = Math.max(12, window.innerHeight - 58);
      menu.style.left = Math.min(x, maxX) + 'px';
      menu.style.top = Math.min(y, maxY) + 'px';
      menu.classList.add('open');
      uiState = 'menu';
    });

    document.addEventListener('i18n:applied', function() {
      if (window.__i18n && typeof window.__i18n.applyTo === 'function') {
        window.__i18n.applyTo(menu);
        window.__i18n.applyTo(modal);
      }
      applyReportTexts();
    });

    if (window.__i18n && typeof window.__i18n.applyTo === 'function') {
      window.__i18n.applyTo(menu);
      window.__i18n.applyTo(modal);
    }
    applyReportTexts();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIssueReporter, { once: true });
  } else {
    initIssueReporter();
  }

  /* ================================================================
     BANDEAU D'ALERTE GLOBAL
     Barre fixe en haut de toutes les pages, affiche les objets
     actuellement en alerte (élevé / très élevé / extrême) sur la
     période la plus récente.
  ================================================================ */

  // Niveaux montrés dans le bandeau global. Ordre = priorité décroissante.
  // Taxonomie pipeline (build_data.R): 3 tiers d'alerte basés sur la grille
  // de saillance par pays (high/very_high/extreme).
  var ALERT_BAR_LEVELS = ['extreme', 'tres_eleve', 'eleve'];

  // Convertit un niveau (avec underscore) en classe CSS (avec hyphen)
  // pour aligner avec la convention des autres pages.
  function levelCss(lvl) { return String(lvl == null ? '' : lvl).replace(/_/g, '-'); }

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

  // ─── Bandeau d'alertes = ÉVÉNEMENTS saillants (règle d'Adrien, 24 oct. 2026) ───
  // Source : v2/events/latest.json → événements du dernier bloc, par région,
  // dont la bande est au moins « Élevée ». Un après l'autre, chacun avec son
  // niveau, suivi des médias qui l'ont couvert (chips cliquables vers l'article).
  // Clic sur l'événement : un des médias au hasard (comme la Vitrine).
  // Vitesse constante et lisible ; seule la couleur du bandeau change (niveau
  // le plus élevé parmi les événements affichés).
  var EVENT_BAND_TO_LEVEL = { elevee: 'eleve', tres_elevee: 'tres_eleve', extreme: 'extreme' };
  var EVENT_BAR_PX_PER_SEC = 45;
  var EVENT_BAR_MAX_MEDIA = 6;

  function eventBarItems(latest) {
    var items = [];
    var regions = (latest && latest.by_region) ? Object.keys(latest.by_region) : [];
    regions.forEach(function(region) {
      var evs = (latest.by_region[region] && latest.by_region[region].events) || [];
      evs.forEach(function(ev) {
        var level = EVENT_BAND_TO_LEVEL[ev.band];
        if (!level) return;
        var arts = Array.isArray(ev.articles) ? ev.articles.filter(function(a) { return a && a.url; }) : [];
        var byMedia = {}; var media = [];
        arts.forEach(function(a) {
          var m = a.media_id || '';
          if (!m || byMedia[m]) return;
          byMedia[m] = true; media.push({ media_id: m, url: a.url, title: a.title || '' });
        });
        if (!media.length && ev.url) media.push({ media_id: ev.media || '', url: ev.url, title: ev.title || '' });
        items.push({ id: ev.id, title: ev.title || '', level: level, region: region, index: Number(ev.index) || 0,
                     urls: arts.map(function(a) { return a.url; }), media: media.slice(0, EVENT_BAR_MAX_MEDIA) });
      });
    });
    var rank = { extreme: 0, tres_eleve: 1, eleve: 2 };
    items.sort(function(a, b) { return (rank[a.level] - rank[b.level]) || (b.index - a.index); });
    return items;
  }

  function buildEventBarItems(items) {
    return items.map(function(it) {
      var lvlCss = levelCss(it.level);
      var urls = it.urls.length ? it.urls : it.media.map(function(m) { return m.url; });
      var chips = it.media.map(function(m) {
        return '<a class="alert-bar-media-chip" href="' + escHtml(m.url) + '" target="_blank" rel="noopener" title="' + escHtml(m.title) + '">' + escHtml(m.media_id) + '</a>';
      }).join('');
      return '<span class="alert-bar-item is-event level-' + escHtml(lvlCss) + '">' +
        '<a class="alert-bar-event-main" href="' + escHtml(urls[0] || '#') + '" target="_blank" rel="noopener" data-urls="' + escHtml(JSON.stringify(urls)) + '">' +
          '<span class="alert-bar-item-badge">' + escHtml(alertBarLabel(it.level)) + '</span>' +
          '<span class="alert-bar-item-name">' + escHtml(it.title) + '</span>' +
          '<span class="alert-bar-item-country">' + escHtml(it.region) + '</span>' +
        '</a>' +
        (chips ? '<span class="alert-bar-media">' + chips + '</span>' : '') +
      '</span>' +
      '<span class="alert-bar-sep" aria-hidden="true">•</span>';
    }).join('');
  }

  function populateAlertBar(latest) {
    var strip    = document.getElementById('alert-bar-strip');
    var bar      = document.getElementById('global-alert-bar');
    var navBadge = document.getElementById('nav-alert-badge');
    if (!strip || !bar) return;

    var items = eventBarItems(latest);
    if (navBadge) {
      if (items.length) { navBadge.textContent = String(items.length); navBadge.classList.add('active'); }
      else { navBadge.style.display = 'none'; }
    }
    if (!items.length) {
      bar.style.display = 'none';
      document.body.classList.remove('has-alert-bar');
      return;
    }
    bar.classList.remove('bar-extreme', 'bar-tres-eleve', 'bar-eleve');
    bar.classList.add('bar-' + levelCss(items[0].level));

    // Une seule copie comme référence de mesure, puis un nombre PAIR de copies
    // pour que translateX(-50%) boucle sans couture (rAF : mesure après rendu).
    var itemsHtml = buildEventBarItems(items);
    strip.innerHTML = itemsHtml;
    var token = (_alertBarRenderToken = (_alertBarRenderToken || 0) + 1);
    window.requestAnimationFrame(function() {
      if (token !== _alertBarRenderToken) return;
      var track = document.getElementById('alert-bar-track');
      var trackW = track ? track.clientWidth : 800;
      var oneW = strip.scrollWidth || 1;
      var copies = Math.max(2, Math.ceil((trackW + 40) / oneW) * 2);
      var multi = '';
      for (var i = 0; i < copies; i++) multi += itemsHtml;
      strip.innerHTML = multi;
      var halfW = strip.scrollWidth / 2 || oneW;
      // Vitesse constante (px/s), lisible ; plancher 20 s.
      var dur = Math.max(20, Math.round(halfW / EVENT_BAR_PX_PER_SEC));
      strip.style.setProperty('--alert-strip-dur', dur + 's');
      bar.classList.add('ready');
    });
  }

  // Clic sur l'événement : un des articles au hasard.
  document.addEventListener('click', function(e) {
    var a = e.target.closest && e.target.closest('.alert-bar-event-main[data-urls]');
    if (!a) return;
    var urls = [];
    try { urls = JSON.parse(a.getAttribute('data-urls') || '[]'); } catch (err) { urls = []; }
    if (urls.length > 1) {
      e.preventDefault();
      window.open(urls[Math.floor(Math.random() * urls.length)], '_blank', 'noopener');
    }
  });
  var _alertBarRenderToken = 0;

  var _lastAlertGraphData = null;
  function initAlertBar() {
    injectAlertBar();
    // Source : événements saillants du dernier bloc (v2/events/latest.json, ~15 ko).
    if (!(window.radarData && window.radarData.eventsLatest)) return;
    window.radarData.eventsLatest()
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
