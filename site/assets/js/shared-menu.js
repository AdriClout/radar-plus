(function(window, document) {
  'use strict';

  function setupSharedMenu() {
    if (document.querySelector('.side-nav')) return;

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
      '<a href="./sonar.html" data-page="sonar.html">Sonar <span class="nav-badge">MONITORING</span></a>',
      '<a href="./index.html#hot20">Hot 20</a>',
      '<a href="./unes.html" data-page="unes.html">Dans le radar</a>',
      '<a href="https://github.com/adriclout/radar-plus/tree/main/analyses" target="_blank" rel="noopener">Analyses</a>',
      '<h3 style="margin-top: 30px;">À propos</h3>',
      '<a href="./radarplus.html" data-page="radarplus.html">Radar+</a>',
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
})(window, document);
