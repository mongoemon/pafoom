// ============================================================
//  PAFOOM — Settings Page Logic
// ============================================================

(function () {
  'use strict';

  // Initialise locale from saved language (before building the page)
  var _savedLang = (function () {
    try {
      var s = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
      var lang = s.language || CONFIG.LANGUAGE || 'auto';
      if (lang === 'auto') {
        var tab = s.sheetName || CONFIG.SHEET_NAME;
        lang = (typeof SHEET_LANGUAGES !== 'undefined' && SHEET_LANGUAGES[tab]) || 'en';
      }
      return lang;
    } catch (e) { return 'en'; }
  })();

  var L = LOCALES[_savedLang] || LOCALES.en;

  var COLUMN_KEYS = ['NAME', 'BRAND', 'IMAGE', 'NOTES', 'SEASON', 'CONCENTRATION', 'RATING', 'DESCRIPTION', 'STATUS', 'VOLUME'];

  var COLUMN_DEFS = COLUMN_KEYS.map(function (key) {
    return {
      key: key,
      label: L.columnDefs[key] ? L.columnDefs[key].label : key,
      hint: L.columnDefs[key] ? L.columnDefs[key].hint : '',
    };
  });

  document.addEventListener('DOMContentLoaded', function () {
    translatePage();
    buildColumnGrid();
    loadSettings();
  });

  // ── i18n ──────────────────────────────────────────────────
  function translatePage() {
    document.title = L.settingsTitle + ' — Pafoom';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key in L) el.textContent = L[key];
    });

    document.querySelectorAll('[data-i18n-tip]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-tip');
      if (key in L) el.setAttribute('data-tip', L[key]);
    });

    var autoOpt = document.querySelector('#language option[value="auto"]');
    if (autoOpt) autoOpt.textContent = L.langAuto;
  }

  // ── Persistence ───────────────────────────────────────────
  function getSaved() {
    try { return JSON.parse(localStorage.getItem('pafoom_config') || '{}'); }
    catch (e) { return {}; }
  }

  function loadSettings() {
    var s = getSaved();

    var rawId = s.sheetId !== undefined ? s.sheetId : CONFIG.SHEET_ID;
    document.getElementById('sheetId').value = rawId === 'YOUR_GOOGLE_SHEET_ID_HERE' ? '' : rawId;
    document.getElementById('sheetName').value = s.sheetName !== undefined ? s.sheetName : CONFIG.SHEET_NAME;
    document.getElementById('siteTitle').value = s.siteTitle !== undefined ? s.siteTitle : CONFIG.SITE_TITLE;
    document.getElementById('siteSubtitle').value = s.siteSubtitle !== undefined ? s.siteSubtitle : CONFIG.SITE_SUBTITLE;
    document.getElementById('useMockData').checked = s.useMockData !== undefined ? s.useMockData : CONFIG.USE_MOCK_DATA;

    var langSel = document.getElementById('language');
    if (langSel) langSel.value = s.language || CONFIG.LANGUAGE || 'auto';

    COLUMN_DEFS.forEach(function (def) {
      var el = document.getElementById('col-' + def.key);
      if (el) el.value = (s.columns || {})[def.key] || '';
    });
  }

  function saveSettings() {
    var prevSaved = getSaved();
    var raw = document.getElementById('sheetId').value.trim();

    // Accept full Google Sheets URL — extract just the ID
    var sheetId = extractSheetId(raw);

    // Collect non-empty column overrides
    var columns = {};
    COLUMN_DEFS.forEach(function (def) {
      var val = document.getElementById('col-' + def.key);
      if (val) val = val.value.trim();
      if (val) columns[def.key] = val;
    });

    var newLang = (document.getElementById('language') && document.getElementById('language').value) || 'en';

    var payload = {
      sheetId: sheetId,
      sheetName: document.getElementById('sheetName').value.trim() || 'Sheet1',
      siteTitle: document.getElementById('siteTitle').value.trim(),
      siteSubtitle: document.getElementById('siteSubtitle').value.trim(),
      useMockData: document.getElementById('useMockData').checked,
      language: newLang,
    };
    if (Object.keys(columns).length) payload.columns = columns;

    localStorage.setItem('pafoom_config', JSON.stringify(payload));

    // Show cleaned ID back in the field if URL was pasted
    if (sheetId !== raw) document.getElementById('sheetId').value = sheetId;

    showToast(L.savedOk);

    // Reload to apply new language if it changed
    var prevLang = prevSaved.language || CONFIG.LANGUAGE || 'en';
    if (newLang !== prevLang) {
      setTimeout(function () { location.reload(); }, 800);
    }
  }

  function resetSettings() {
    if (!confirm(L.resetConfirm)) return;
    localStorage.removeItem('pafoom_config');
    loadSettings();
    document.getElementById('connection-status').className = 'connection-status';
    document.getElementById('connection-status').textContent = '';
    showToast(L.resetOk);
    setTimeout(function () { location.reload(); }, 800);
  }

  // ── Test connection (uses shared sheetsFetch) ──────────────
  function testConnection() {
    var raw = document.getElementById('sheetId').value.trim();
    var sheetName = document.getElementById('sheetName').value.trim() || 'Sheet1';

    var sheetId = extractSheetId(raw);

    if (!sheetId) { setStatus('error', L.testEmpty); return; }

    setStatus('testing', L.testConnecting);

    sheetsFetch(sheetId, sheetName, 10000).then(
      function (result) {
        setStatus('ok', L.testSuccess(result.count));
      }
    ).catch(function (err) {
      if (err.message === 'Timeout') setStatus('error', L.testTimeout);
      else if (err.message === 'Network error') setStatus('error', L.testFail);
      else setStatus('error', L.testSheetError);
    });
  }

  function setStatus(type, message) {
    var el = document.getElementById('connection-status');
    el.className = 'connection-status status-' + type;
    el.textContent = message;
  }

  // ── Helpers ───────────────────────────────────────────────
  function buildColumnGrid() {
    document.getElementById('columns-grid').innerHTML = COLUMN_DEFS.map(function (def) {
      return (
        '<div class="field">' +
        '  <label for="col-' + def.key + '">' +
        def.label +
        (def.hint ? '<i class="tip" tabindex="0" data-tip="' + def.hint.replace(/"/g, '"') + '">?</i>' : '') +
        '  </label>' +
        '  <input type="text" id="col-' + def.key + '" placeholder="' + COLUMN_NAMES[def.key] + '">' +
        '</div>'
      );
    }).join('');
  }

  function showToast(message) {
    var toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2500);
  }

  // Expose for HTML onclick attributes
  window.saveSettings = saveSettings;
  window.resetSettings = resetSettings;
  window.testConnection = testConnection;

})();
