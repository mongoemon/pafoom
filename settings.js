// ============================================================
//  PAFOOM — Settings Page Logic
// ============================================================

// Initialise locale from saved language (before building the page).
// Resolves 'auto' the same way app.js does, so the settings page
// renders in the correct language.
const _savedLang = (() => {
  try {
    const s = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
    let lang = s.language || CONFIG.LANGUAGE || 'auto';
    if (lang === 'auto') {
      const tab = s.sheetName || CONFIG.SHEET_NAME;
      lang = (typeof SHEET_LANGUAGES !== 'undefined' && SHEET_LANGUAGES[tab]) || 'en';
    }
    return lang;
  } catch { return 'en'; }
})();
const L = LOCALES[_savedLang] || LOCALES.en;

const COLUMN_KEYS = ['NAME', 'BRAND', 'IMAGE', 'NOTES', 'SEASON', 'CONCENTRATION', 'RATING', 'DESCRIPTION', 'STATUS', 'VOLUME'];

const COLUMN_DEFS = COLUMN_KEYS.map(key => ({
  key,
  label: L.columnDefs[key]?.label || key,
  hint:  L.columnDefs[key]?.hint  || '',
}));

document.addEventListener('DOMContentLoaded', () => {
  translatePage();
  buildColumnGrid();
  loadSettings();
});

// ── i18n ──────────────────────────────────────────────────
function translatePage() {
  document.title = `${L.settingsTitle} — Pafoom`;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key in L) el.textContent = L[key];
  });

  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    const key = el.getAttribute('data-i18n-tip');
    if (key in L) el.setAttribute('data-tip', L[key]);
  });

  // Translate the 'auto' language option label
  const autoOpt = document.querySelector('#language option[value="auto"]');
  if (autoOpt) autoOpt.textContent = L.langAuto;
}

// ── Persistence ───────────────────────────────────────────
function getSaved() {
  try { return JSON.parse(localStorage.getItem('pafoom_config') || '{}'); }
  catch { return {}; }
}

function loadSettings() {
  const s = getSaved();

  const rawId = s.sheetId ?? CONFIG.SHEET_ID;
  document.getElementById('sheetId').value      = rawId === 'YOUR_GOOGLE_SHEET_ID_HERE' ? '' : rawId;
  document.getElementById('sheetName').value    = s.sheetName    ?? CONFIG.SHEET_NAME;
  document.getElementById('siteTitle').value    = s.siteTitle    ?? CONFIG.SITE_TITLE;
  document.getElementById('siteSubtitle').value = s.siteSubtitle ?? CONFIG.SITE_SUBTITLE;
  document.getElementById('useMockData').checked = s.useMockData ?? CONFIG.USE_MOCK_DATA;

  const langSel = document.getElementById('language');
  if (langSel) langSel.value = s.language || CONFIG.LANGUAGE || 'auto';

  COLUMN_DEFS.forEach(({ key }) => {
    const el = document.getElementById(`col-${key}`);
    if (el) el.value = (s.columns || {})[key] ?? '';
  });
}

function saveSettings() {
  const prevSaved = getSaved();
  const raw = document.getElementById('sheetId').value.trim();

  // Accept full Google Sheets URL — extract just the ID
  const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const sheetId  = urlMatch ? urlMatch[1] : raw;

  // Collect non-empty column overrides
  const columns = {};
  COLUMN_DEFS.forEach(({ key }) => {
    const val = document.getElementById(`col-${key}`)?.value.trim();
    if (val) columns[key] = val;
  });

  const newLang = document.getElementById('language')?.value || 'en';

  const payload = {
    sheetId,
    sheetName:    document.getElementById('sheetName').value.trim() || 'Sheet1',
    siteTitle:    document.getElementById('siteTitle').value.trim(),
    siteSubtitle: document.getElementById('siteSubtitle').value.trim(),
    useMockData:  document.getElementById('useMockData').checked,
    language:     newLang,
  };
  if (Object.keys(columns).length) payload.columns = columns;

  localStorage.setItem('pafoom_config', JSON.stringify(payload));

  // Show cleaned ID back in the field if URL was pasted
  if (sheetId !== raw) document.getElementById('sheetId').value = sheetId;

  showToast(L.savedOk);

  // Reload to apply new language if it changed
  const prevLang = prevSaved.language || CONFIG.LANGUAGE || 'en';
  if (newLang !== prevLang) {
    setTimeout(() => location.reload(), 800);
  }
}

function resetSettings() {
  if (!confirm(L.resetConfirm)) return;
  localStorage.removeItem('pafoom_config');
  loadSettings();
  document.getElementById('connection-status').className = 'connection-status';
  document.getElementById('connection-status').textContent = '';
  showToast(L.resetOk);
  // Reload so language resets too
  setTimeout(() => location.reload(), 800);
}

// ── Test connection ────────────────────────────────────────
function testConnection() {
  const raw       = document.getElementById('sheetId').value.trim();
  const sheetName = document.getElementById('sheetName').value.trim() || 'Sheet1';

  const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const sheetId  = urlMatch ? urlMatch[1] : raw;

  if (!sheetId) { setStatus('error', L.testEmpty); return; }

  setStatus('testing', L.testConnecting);

  const cbName = '__pafoom_test_' + Date.now();
  const url    = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=responseHandler:${cbName}&sheet=${encodeURIComponent(sheetName)}&headers=1`;

  const script = document.createElement('script');

  const cleanup = () => { clearTimeout(timer); delete window[cbName]; script.remove(); };

  const timer = setTimeout(() => {
    cleanup();
    setStatus('error', L.testTimeout);
  }, 10000);

  window[cbName] = (data) => {
    cleanup();
    if (data.status === 'error') {
      setStatus('error', L.testSheetError);
      return;
    }
    const count = (data.table?.rows || []).filter(r => r.c?.some(c => c?.v)).length;
    setStatus('ok', L.testSuccess(count));
  };

  script.onerror = () => {
    cleanup();
    setStatus('error', L.testFail);
  };

  document.head.appendChild(script);
  script.src = url;
}

function setStatus(type, message) {
  const el = document.getElementById('connection-status');
  el.className = `connection-status status-${type}`;
  el.textContent = message;
}

// ── Helpers ───────────────────────────────────────────────
function buildColumnGrid() {
  document.getElementById('columns-grid').innerHTML = COLUMN_DEFS.map(({ key, label, hint }) => `
    <div class="field">
      <label for="col-${key}">
        ${label}
        ${hint ? `<i class="tip" tabindex="0" data-tip="${hint.replace(/"/g, '&quot;')}">?</i>` : ''}
      </label>
      <input type="text" id="col-${key}" placeholder="${COLUMN_NAMES[key]}">
    </div>`).join('');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
