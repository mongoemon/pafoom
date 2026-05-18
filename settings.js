// ============================================================
//  PAFOOM — Settings Page Logic
// ============================================================

const COLUMN_DEFS = [
  {
    key: 'NAME', label: 'Name',
    hint: 'Required. The perfume or fragrance name — shown as the card heading.',
  },
  {
    key: 'BRAND', label: 'Brand',
    hint: 'The brand or fragrance house (e.g. Dior, Creed, Tom Ford). Shown above the name and used in the brand filter.',
  },
  {
    key: 'IMAGE', label: 'Image',
    hint: 'A direct URL to the perfume photo. Accepts Google Drive share links, Imgur, or any public image URL.',
  },
  {
    key: 'NOTES', label: 'Notes',
    hint: 'Fragrance notes, comma-separated (e.g. Rose, Oud, Sandalwood). Displayed as small tags on the card.',
  },
  {
    key: 'SEASON', label: 'Season',
    hint: 'Best wearing season. Use: Spring, Summer, Fall, Winter, or All Season. Powers the season filter.',
  },
  {
    key: 'CONCENTRATION', label: 'Concentration',
    hint: 'Fragrance type — e.g. EDP, EDT, Parfum, EDC. Shown as a tag on the card and in the detail view.',
  },
  {
    key: 'RATING', label: 'Rating',
    hint: 'Your personal score from 1 to 5. Decimals are fine (e.g. 4.5). Displayed as stars on the card.',
  },
  {
    key: 'DESCRIPTION', label: 'Description',
    hint: 'Your personal notes or review text. Only shown in the detail view when you click a card — not on the card itself.',
  },
  {
    key: 'STATUS', label: 'Status',
    hint: 'Ownership status. Use: Owned, Wishlist, Decant, or Gifted. Shows a colour badge on the card and powers the status filter.',
  },
  {
    key: 'VOLUME', label: 'Volume',
    hint: 'Bottle size (e.g. 100ml, 50ml). Shown as a small tag on the card and in the detail view.',
  },
];

document.addEventListener('DOMContentLoaded', () => {
  buildColumnGrid();
  loadSettings();
});

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

  COLUMN_DEFS.forEach(({ key }) => {
    const el = document.getElementById(`col-${key}`);
    if (el) el.value = (s.columns || {})[key] ?? '';
  });
}

function saveSettings() {
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

  const payload = {
    sheetId,
    sheetName:    document.getElementById('sheetName').value.trim() || 'Sheet1',
    siteTitle:    document.getElementById('siteTitle').value.trim(),
    siteSubtitle: document.getElementById('siteSubtitle').value.trim(),
    useMockData:  document.getElementById('useMockData').checked,
  };
  if (Object.keys(columns).length) payload.columns = columns;

  localStorage.setItem('pafoom_config', JSON.stringify(payload));

  // Show cleaned ID back in the field if URL was pasted
  if (sheetId !== raw) document.getElementById('sheetId').value = sheetId;

  showToast('Settings saved ✓');
}

function resetSettings() {
  if (!confirm('Reset all settings to the defaults in config.js?')) return;
  localStorage.removeItem('pafoom_config');
  loadSettings();
  document.getElementById('connection-status').className = 'connection-status';
  document.getElementById('connection-status').textContent = '';
  showToast('Reset to defaults');
}

// ── Test connection ────────────────────────────────────────
function testConnection() {
  const raw       = document.getElementById('sheetId').value.trim();
  const sheetName = document.getElementById('sheetName').value.trim() || 'Sheet1';

  const urlMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const sheetId  = urlMatch ? urlMatch[1] : raw;

  if (!sheetId) { setStatus('error', 'Enter a Sheet ID first'); return; }

  setStatus('testing', 'Testing connection…');

  const cbName = '__pafoom_test_' + Date.now();
  const url    = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
    `?tqx=responseHandler:${cbName}&sheet=${encodeURIComponent(sheetName)}&headers=1`;

  const script = document.createElement('script');

  const cleanup = () => { clearTimeout(timer); delete window[cbName]; script.remove(); };

  const timer = setTimeout(() => {
    cleanup();
    setStatus('error', 'Timed out — check your internet connection');
  }, 10000);

  window[cbName] = (data) => {
    cleanup();
    if (data.status === 'error') {
      setStatus('error', 'Sheet returned an error — check sharing settings');
      return;
    }
    const count = (data.table?.rows || []).filter(r => r.c?.some(c => c?.v)).length;
    setStatus('ok', `Connected — ${count} row${count !== 1 ? 's' : ''} found`);
  };

  script.onerror = () => {
    cleanup();
    setStatus('error', 'Failed — check Sheet ID and make sure the sheet is public');
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
