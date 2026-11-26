/**
 * i18n — translation lookup with param interpolation.
 * Reads catalogues from window.App._i18n (zero extra globals on window).
 * Language change re-renders the current page via App.router.refresh().
 * @namespace App.i18n
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const CATALOGUES = (App._i18n = App._i18n || {});

  let _lang = 'zh-TW';

  /**
   * Translate a key, substituting {param} placeholders.
   * Falls back to English if missing in active language; logs warning if missing in both.
   * @param {string} key
   * @param {Object} [params]
   * @returns {string}
   */
  function t(key, params) {
    let str = CATALOGUES[_lang] && CATALOGUES[_lang][key];
    if (str === undefined) {
      str = CATALOGUES['en'] && CATALOGUES['en'][key];
      if (str === undefined) {
        console.warn('[i18n] Missing key:', key);
        return key;
      }
    }
    if (params) {
      str = str.replace(/\{(\w+)\}/g, function (_, k) {
        return params[k] !== undefined ? String(params[k]) : '{' + k + '}';
      });
    }
    return str;
  }

  function lang() {
    return _lang;
  }

  function setLang(code) {
    if (!CATALOGUES[code]) {
      console.warn('[i18n] Unknown language:', code);
      return;
    }
    _lang = code;
    document.documentElement.lang = code === 'zh-TW' ? 'zh-Hant' : 'en';
    if (App.store && App.store.settings) {
      App.store.settings.update({ language: code });
    }
    if (App.router) App.router.refresh();
  }

  function init(storedLang) {
    _lang = CATALOGUES[storedLang] ? storedLang : 'zh-TW';
    document.documentElement.lang = _lang === 'zh-TW' ? 'zh-Hant' : 'en';
  }

  App.i18n = { t, lang, setLang, init, _catalogues: CATALOGUES };
})();
