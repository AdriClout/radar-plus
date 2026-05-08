/* Radar+ — i18n runtime
 *
 * Single source of truth pour les chaînes UI:
 *   site/i18n/ui.{lang}.json  (FR par défaut, EN supportée)
 *
 * Usage côté HTML:
 *   <span data-i18n="hot20.title">HOT 20</span>
 *   <input data-i18n-placeholder="search.placeholder" placeholder="…">
 *   <a data-i18n-aria-label="nav.evolution" href="…">…</a>
 *   <div data-i18n-html="alertes.intro_html">…HTML autorisé…</div>
 *
 * Usage côté JS:
 *   window.t('hot20.subtitle', { count: 3 })
 *
 * Fallback: si une clé manque, le textContent original (FR) est préservé
 * et un warning console s'affiche → on évite les "[MISSING]" cassés visuellement
 * tout en signalant aux développeurs.
 */
(function (window, document) {
  'use strict';

  var SUPPORTED   = ['fr', 'en'];
  var DEFAULT_LANG = 'fr';
  var STORAGE_KEY  = 'radar:lang';

  // ─── Détection de la langue active ───────────────────────────────────────
  function detectLang() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromUrl = params.get('lang');
      if (fromUrl && SUPPORTED.indexOf(fromUrl) !== -1) return fromUrl;
    } catch (_) { /* noop */ }
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (_) { /* noop */ }
    var browser = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED.indexOf(browser) !== -1) return browser;
    return DEFAULT_LANG;
  }

  var currentLang = detectLang();
  var strings     = {};
  var loadedLang  = null;

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(s, params) {
    if (typeof s !== 'string' || !params) return s;
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return params[k] != null ? params[k] : '{' + k + '}';
    });
  }

  function t(key, params) {
    var v = getByPath(strings, key);
    if (typeof v !== 'string') {
      if (window.console && console.warn) {
        console.warn('[i18n] missing key:', key, 'lang:', currentLang);
      }
      return key;
    }
    return interpolate(v, params);
  }

  // Liste des attributs supportés via data-i18n-{attr}
  var SUPPORTED_ATTRS = [
    'placeholder', 'title', 'aria-label', 'aria-description',
    'value', 'alt', 'content'
  ];

  function applyTo(root) {
    if (!root || !root.querySelectorAll) return;

    // textContent
    root.querySelectorAll('[data-i18n]').forEach(function (node) {
      var key = node.getAttribute('data-i18n');
      var v = getByPath(strings, key);
      if (typeof v === 'string') node.textContent = v;
    });

    // innerHTML (à utiliser avec parcimonie, pour les chaînes contenant
    // du markup contrôlé)
    root.querySelectorAll('[data-i18n-html]').forEach(function (node) {
      var key = node.getAttribute('data-i18n-html');
      var v = getByPath(strings, key);
      if (typeof v === 'string') node.innerHTML = v;
    });

    // attributs (placeholder, title, aria-label…)
    SUPPORTED_ATTRS.forEach(function (attr) {
      var dataAttr = 'data-i18n-' + attr;
      root.querySelectorAll('[' + dataAttr + ']').forEach(function (node) {
        var key = node.getAttribute(dataAttr);
        var v = getByPath(strings, key);
        if (typeof v === 'string') node.setAttribute(attr, v);
      });
    });
  }

  function applyAll() {
    applyTo(document.body || document.documentElement);
    document.documentElement.setAttribute('lang', currentLang);
    document.dispatchEvent(new CustomEvent('i18n:applied', {
      detail: { lang: currentLang }
    }));
  }

  // ─── Chargement des fichiers JSON ────────────────────────────────────────
  function loadStrings(lang) {
    return fetch('./i18n/ui.' + lang + '.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .catch(function (e) {
        if (window.console && console.error) {
          console.error('[i18n] load failed for', lang, e);
        }
        return {};
      });
  }

  // ─── API publique ────────────────────────────────────────────────────────
  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    if (lang === loadedLang) return Promise.resolve();
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    return loadStrings(lang).then(function (data) {
      strings    = data || {};
      loadedLang = lang;
      applyAll();
      // Sync URL: ?lang=en (ou retire le param si défaut FR)
      try {
        var u = new URL(window.location.href);
        if (lang === DEFAULT_LANG) u.searchParams.delete('lang');
        else u.searchParams.set('lang', lang);
        window.history.replaceState({}, '',
          u.pathname + (u.search ? u.search : '') + (u.hash || ''));
      } catch (_) {}
    });
  }

  // Expose
  window.__i18n = {
    SUPPORTED: SUPPORTED.slice(),
    DEFAULT_LANG: DEFAULT_LANG,
    t: t,
    setLang: setLang,
    currentLang: function () { return currentLang; },
    applyTo: applyTo
  };
  window.t = t; // raccourci

  // Auto-init
  function init() { setLang(currentLang); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})(window, document);
