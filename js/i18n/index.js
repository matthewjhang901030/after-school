/**
 * i18n — translation lookup with param interpolation.
 * Depends on: window.AS_I18N_ZH_TW, window.AS_I18N_EN (loaded before this file).
 * Language change re-renders the current page via App.router.refresh().
 * @namespace App.i18n
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const CATALOGUES = {
    'zh-TW': window.AS_I18N_ZH_TW || {},
    'en':    window.AS_I18N_EN     || {},
  };

  /** Currently active language code. */
  let _lang = 'zh-TW';

  /**
   * Translate a key, substituting {param} placeholders.
   * Falls back to English if the key is missing in the active language.
   * Logs a warning if the key is missing in both languages.
   *
   * @param {string} key    Dot-separated key, e.g. 'nav.dashboard'
   * @param {Object} [params]  Plain object; values replace {name} tokens.
   * @returns {string}
   */
  function t(key, params) {
    let str = CATALOGUES[_lang] && CATALOGUES[_lang][key];
    if (str === undefined) {
      // Fallback to English
      str = CATALOGUES['en'][key];
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

  /**
   * Return the current language code.
   * @returns {string}
   */
  function lang() {
    return _lang;
  }

  /**
   * Switch the UI language and re-render the current page.
   * @param {'zh-TW'|'en'} code
   */
  function setLang(code) {
    if (!CATALOGUES[code]) {
      console.warn('[i18n] Unknown language:', code);
      return;
    }
    _lang = code;
    document.documentElement.lang = code === 'zh-TW' ? 'zh-Hant' : 'en';
    // Persist via settings (if available)
    if (App.store && App.store.settings) {
      App.store.settings.update({ language: code });
    }
    // Re-render current page
    if (App.router) App.router.refresh();
  }

  /**
   * Initialise language from stored settings (called during boot).
   * @param {string} [storedLang]
   */
  function init(storedLang) {
    _lang = CATALOGUES[storedLang] ? storedLang : 'zh-TW';
    document.documentElement.lang = _lang === 'zh-TW' ? 'zh-Hant' : 'en';
  }

  App.i18n = { t, lang, setLang, init };
})();
