// ============================================================
//  PAFOOM — Application Logic
// ============================================================

// Apply any overrides saved from settings.html (localStorage takes priority over config.js)
;(function () {
  try {
    const s = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
    if (s.sheetId)                   CONFIG.SHEET_ID      = s.sheetId;
    if (s.sheetName)                 CONFIG.SHEET_NAME    = s.sheetName;
    if (s.siteTitle)                 CONFIG.SITE_TITLE    = s.siteTitle;
    if (s.siteSubtitle)              CONFIG.SITE_SUBTITLE = s.siteSubtitle;
    if (s.useMockData !== undefined) CONFIG.USE_MOCK_DATA = s.useMockData;
    if (s.columns)                   Object.assign(COLUMN_NAMES, s.columns);
    if (s.language)                  CONFIG.LANGUAGE      = s.language;
  } catch {}
})();

// Resolve 'auto': look up current sheet tab in SHEET_LANGUAGES map
if (CONFIG.LANGUAGE === 'auto') {
  CONFIG.LANGUAGE =
    (typeof SHEET_LANGUAGES !== 'undefined' && SHEET_LANGUAGES[CONFIG.SHEET_NAME]) || 'en';
}

const L = LOCALES[CONFIG.LANGUAGE] || LOCALES.en;

const state = {
  all:      [],
  filtered: [],
};

// ── DOM references ────────────────────────────────────────
const grid        = document.getElementById('perfume-grid');
const loading     = document.getElementById('loading');
const statsEl     = document.getElementById('collection-stats');
const searchInput = document.getElementById('search');
const brandSel    = document.getElementById('filter-brand');
const seasonSel   = document.getElementById('filter-season');
const statusSel   = document.getElementById('filter-status');
const overlay     = document.getElementById('modal-overlay');
const modalBody   = document.getElementById('modal-content');

// ── Initialise ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.site-title').textContent    = CONFIG.SITE_TITLE;
  document.querySelector('.site-subtitle').textContent = CONFIG.SITE_SUBTITLE;
  document.title = CONFIG.SITE_TITLE;
  document.documentElement.lang = L.lang;

  searchInput.placeholder = L.searchPlaceholder;
  searchInput.setAttribute('aria-label', L.searchPlaceholder);
  brandSel.options[0].textContent = L.allBrands;
  const footerP = document.querySelector('.site-footer p');
  if (footerP) footerP.textContent = L.footer;
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) langBtn.textContent = L.langSwitch;

  buildFilterOptions();

  if (CONFIG.USE_MOCK_DATA || CONFIG.SHEET_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') {
    loadMockData();
    setupListeners();
    return;
  }

  fetchData();
  setupListeners();
});

// ── Language toggle ────────────────────────────────────────
function toggleLanguage() {
  const next = CONFIG.LANGUAGE === 'th' ? 'en' : 'th';
  try {
    const s = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
    s.language = next;
    localStorage.setItem('pafoom_config', JSON.stringify(s));
  } catch {}
  location.reload();
}

// ── Data fetching (JSONP — works from file:// and hosted) ─
function fetchData() {
  showSkeletons();

  const cbName = '__pafoom_' + Date.now();
  const url =
    `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq` +
    `?tqx=responseHandler:${cbName}&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}&headers=1`;

  const script = document.createElement('script');

  const cleanup = () => {
    delete window[cbName];
    script.remove();
  };

  const timer = setTimeout(() => {
    cleanup();
    showError(new Error(L.testTimeout));
  }, 12000);

  window[cbName] = (data) => {
    clearTimeout(timer);
    cleanup();
    try {
      if (data.status === 'error') {
        throw new Error(data.errors?.[0]?.detailed_message || L.testSheetError);
      }
      state.all      = parseTable(data.table);
      state.filtered = [...state.all];
      populateBrandFilter();
      renderGrid(state.all);
      renderStats(state.all);
    } catch (err) {
      showError(err);
    }
  };

  script.onerror = () => {
    clearTimeout(timer);
    cleanup();
    showError(new Error(L.testFail));
  };

  document.head.appendChild(script);
  script.src = url;
}

// Converts any Google Drive share URL to a direct embeddable image URL.
// Paste either format in your sheet's Image column:
//   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
//   https://drive.google.com/open?id=FILE_ID
// Non-Drive URLs are passed through unchanged.
function toDriveImageUrl(url) {
  if (!url || !url.includes('drive.google.com')) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}

function parseTable(table) {
  if (!table || !table.cols || !table.rows) return [];

  // Build header → column-index map (case-insensitive)
  const headerMap = {};
  table.cols.forEach((col, i) => {
    headerMap[col.label.trim().toLowerCase()] = i;
  });

  // Map configured column names to indices
  const idx = {};
  for (const [key, label] of Object.entries(COLUMN_NAMES)) {
    idx[key] = headerMap[label.trim().toLowerCase()] ?? -1;
  }

  const get = (row, key) => {
    const i = idx[key];
    if (i === -1) return '';
    const cell = row.c[i];
    if (!cell || cell.v === null || cell.v === undefined) return '';
    return String(cell.v).trim();
  };

  return table.rows
    .map(row => ({
      name:          get(row, 'NAME'),
      brand:         get(row, 'BRAND'),
      image:         toDriveImageUrl(get(row, 'IMAGE')),
      notes:         get(row, 'NOTES'),
      season:        get(row, 'SEASON'),
      concentration: get(row, 'CONCENTRATION'),
      rating:        parseFloat(get(row, 'RATING')) || 0,
      description:   get(row, 'DESCRIPTION'),
      status:        get(row, 'STATUS'),
      volume:        get(row, 'VOLUME'),
    }))
    .filter(p => p.name);   // skip empty rows
}

// ── Filters & search ─────────────────────────────────────
function buildFilterOptions() {
  seasonSel.innerHTML =
    `<option value="">${L.allSeasons}</option>` +
    `<option value="Spring">${L.seasonSpring}</option>` +
    `<option value="Summer">${L.seasonSummer}</option>` +
    `<option value="Fall">${L.seasonFall}</option>` +
    `<option value="Winter">${L.seasonWinter}</option>` +
    `<option value="All Season">${L.seasonAll}</option>`;

  statusSel.innerHTML =
    `<option value="">${L.allStatus}</option>` +
    `<option value="Owned">${L.statusOwned}</option>` +
    `<option value="Wishlist">${L.statusWishlist}</option>` +
    `<option value="Decant">${L.statusDecant}</option>` +
    `<option value="Gifted">${L.statusGifted}</option>`;
}

function setupListeners() {
  searchInput.addEventListener('input',  applyFilters);
  brandSel.addEventListener('change',    applyFilters);
  seasonSel.addEventListener('change',   applyFilters);
  statusSel.addEventListener('change',   applyFilters);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown',   e => { if (e.key === 'Escape') closeModal(); });
}

function applyFilters() {
  const q      = searchInput.value.toLowerCase();
  const brand  = brandSel.value;
  const season = seasonSel.value;
  const status = statusSel.value;

  state.filtered = state.all.filter(p => {
    const matchQ =
      !q ||
      p.name.toLowerCase().includes(q)  ||
      p.brand.toLowerCase().includes(q) ||
      p.notes.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q);

    const matchBrand  = !brand  || p.brand  === brand;
    const matchSeason = !season || p.season === season;
    const matchStatus = !status || p.status === status;

    return matchQ && matchBrand && matchSeason && matchStatus;
  });

  renderGrid(state.filtered);
  renderStats(state.filtered, q || brand || season || status);
}

function populateBrandFilter() {
  const brands = [...new Set(state.all.map(p => p.brand).filter(Boolean))].sort();
  brands.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    brandSel.appendChild(opt);
  });
}

// ── Locale helpers ────────────────────────────────────────
function localizeStatus(status) {
  const map = {
    owned:    L.statusOwned,
    wishlist: L.statusWishlist,
    decant:   L.statusDecant,
    gifted:   L.statusGifted,
  };
  return map[status?.toLowerCase()] || status;
}

function localizeSeason(season) {
  const map = {
    spring:       L.seasonSpring,
    summer:       L.seasonSummer,
    fall:         L.seasonFall,
    winter:       L.seasonWinter,
    'all season': L.seasonAll,
  };
  return map[season?.toLowerCase()] || season;
}

// ── Rendering ─────────────────────────────────────────────
function renderGrid(perfumes) {
  grid.innerHTML = '';

  if (!perfumes.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✦</div>
        <p>${L.noResults}</p>
        <button class="btn-reset" onclick="resetFilters()">${L.clearFilters}</button>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  perfumes.forEach(p => frag.appendChild(createCard(p)));
  grid.appendChild(frag);
}

function createCard(p) {
  const card = document.createElement('article');
  card.className = 'perfume-card';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `${p.name} by ${p.brand}`);

  const notesHtml = parseNotes(p.notes)
    .slice(0, 3)
    .map(n => `<span class="note-tag">${n}</span>`)
    .join('');

  const statusClass = p.status ? `status-${p.status.toLowerCase().replace(/\s+/g, '-')}` : '';

  card.innerHTML = `
    <div class="card-image-wrap">
      ${p.image
        ? `<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" class="card-image" loading="lazy" onerror="this.parentElement.classList.add('img-error');this.remove()">`
        : ''}
      <div class="card-image-placeholder" aria-hidden="true">
        <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="28" y="2" width="24" height="10" rx="3" stroke="currentColor" stroke-width="1.5"/>
          <rect x="20" y="12" width="40" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 20h48a4 4 0 0 1 4 4v88a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M28 50c0-6.627 5.373-12 12-12s12 5.373 12 12-5.373 18-12 18-12-11.373-12-18z" stroke="currentColor" stroke-width="1.2" opacity=".4"/>
          <line x1="40" y1="75" x2="40" y2="95" stroke="currentColor" stroke-width="1.2" opacity=".3"/>
        </svg>
      </div>
      ${p.status ? `<span class="status-badge ${statusClass}">${escapeHtml(localizeStatus(p.status))}</span>` : ''}
    </div>
    <div class="card-body">
      <p class="card-brand">${escapeHtml(p.brand)}</p>
      <h2 class="card-name">${escapeHtml(p.name)}</h2>
      ${p.rating ? `<div class="card-rating" aria-label="${L.outOf5Stars(p.rating)}">${renderStars(p.rating)}</div>` : ''}
      ${notesHtml ? `<div class="card-notes">${notesHtml}</div>` : ''}
      <div class="card-meta">
        ${p.concentration ? `<span class="meta-tag">${escapeHtml(p.concentration)}</span>` : ''}
        ${p.season       ? `<span class="meta-tag">${escapeHtml(localizeSeason(p.season))}</span>` : ''}
        ${p.volume       ? `<span class="meta-tag">${escapeHtml(p.volume)}</span>` : ''}
      </div>
    </div>`;

  card.addEventListener('click',  () => openModal(p));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openModal(p); });
  return card;
}

function renderStats(perfumes, filtered) {
  const owned    = perfumes.filter(p => p.status?.toLowerCase() === 'owned').length;
  const wishlist = perfumes.filter(p => p.status?.toLowerCase() === 'wishlist').length;
  const total    = perfumes.length;

  const prefix = filtered ? L.statsShowing : L.statsCollection;
  const parts  = [`<span>${total} ${total === 1 ? L.fragrance : L.fragrances}</span>`];
  if (!filtered && owned)    parts.push(`<span>${owned} ${L.statsOwned}</span>`);
  if (!filtered && wishlist) parts.push(`<span>${wishlist} ${L.statsWishlist}</span>`);

  statsEl.innerHTML = `<p class="stats-text">${prefix} · ${parts.join(' · ')}</p>`;
}

// ── Modal ─────────────────────────────────────────────────
function openModal(p) {
  const allNotes = parseNotes(p.notes).map(n => `<span class="note-tag">${n}</span>`).join('');
  const statusClass = p.status ? `status-${p.status.toLowerCase().replace(/\s+/g, '-')}` : '';

  modalBody.innerHTML = `
    <div class="modal-image-wrap">
      ${p.image
        ? `<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" class="modal-image" onerror="this.parentElement.classList.add('img-error');this.remove()">`
        : ''}
      <div class="card-image-placeholder modal-placeholder" aria-hidden="true">
        <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="28" y="2" width="24" height="10" rx="3" stroke="currentColor" stroke-width="1.5"/>
          <rect x="20" y="12" width="40" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M16 20h48a4 4 0 0 1 4 4v88a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M28 50c0-6.627 5.373-12 12-12s12 5.373 12 12-5.373 18-12 18-12-11.373-12-18z" stroke="currentColor" stroke-width="1.2" opacity=".4"/>
          <line x1="40" y1="75" x2="40" y2="95" stroke="currentColor" stroke-width="1.2" opacity=".3"/>
        </svg>
      </div>
    </div>
    <div class="modal-info">
      <p class="modal-brand">${escapeHtml(p.brand)}</p>
      <h2 class="modal-name" id="modal-title">${escapeHtml(p.name)}</h2>
      <div class="modal-badges">
        ${p.status        ? `<span class="status-badge ${statusClass}">${escapeHtml(localizeStatus(p.status))}</span>` : ''}
        ${p.concentration ? `<span class="meta-tag">${escapeHtml(p.concentration)}</span>` : ''}
        ${p.volume        ? `<span class="meta-tag">${escapeHtml(p.volume)}</span>` : ''}
        ${p.season        ? `<span class="meta-tag">${escapeHtml(localizeSeason(p.season))}</span>` : ''}
      </div>
      ${p.rating ? `<div class="modal-rating" aria-label="${L.outOf5(p.rating)}">${renderStars(p.rating)}<span class="rating-num">${p.rating.toFixed(1)}</span></div>` : ''}
      ${allNotes ? `
        <div class="modal-section">
          <p class="modal-label">${L.fragranceNotes}</p>
          <div class="modal-notes">${allNotes}</div>
        </div>` : ''}
      ${p.description ? `
        <div class="modal-section">
          <p class="modal-label">${L.myNotes}</p>
          <p class="modal-description">${escapeHtml(p.description)}</p>
        </div>` : ''}
    </div>`;

  overlay.hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal() {
  overlay.hidden = true;
  document.body.classList.remove('modal-open');
}

// ── Loading / error states ────────────────────────────────
function showSkeletons() {
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line medium"></div>
      </div>
    </div>`).join('');
}

function showError(err) {
  grid.innerHTML = `
    <div class="error-state">
      <p class="error-title">${L.errorTitle}</p>
      <p class="error-detail">${escapeHtml(err.message)}</p>
      <ul class="error-tips">
        <li>${L.errorTip1}</li>
        <li>${L.errorTip2}</li>
        <li>${L.errorTip3}</li>
      </ul>
      <button class="btn-reset" onclick="fetchData()">${L.tryAgain}</button>
    </div>`;
  console.error('[Pafoom]', err);
}

function loadMockData() {
  showSkeletons();
  // Brief artificial delay so you can see the skeleton loading state
  setTimeout(() => {
    state.all      = MOCK_DATA;
    state.filtered = [...MOCK_DATA];
    populateBrandFilter();
    renderGrid(state.all);
    renderStats(state.all);

    const banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.innerHTML = L.demoBanner;
    document.querySelector('.main-content').prepend(banner);
  }, 600);
}

function showSetupMessage() {
  grid.innerHTML = `
    <div class="setup-state">
      <h2 class="setup-title">Welcome to Pafoom ✦</h2>
      <p>Open <code>config.js</code> and replace <code>YOUR_GOOGLE_SHEET_ID_HERE</code> with your actual Sheet ID to get started.</p>
      <ol class="setup-steps">
        <li>Create a Google Sheet with columns: <em>Name, Brand, Image, Notes, Season, Concentration, Rating, Description, Status, Volume</em></li>
        <li>Share it → <em>"Anyone with the link — Viewer"</em></li>
        <li>Copy the Sheet ID from the URL</li>
        <li>Paste it in <code>config.js</code></li>
      </ol>
    </div>`;
  if (loading) loading.remove();
}

// ── Helpers ───────────────────────────────────────────────
function resetFilters() {
  searchInput.value = '';
  brandSel.value    = '';
  seasonSel.value   = '';
  statusSel.value   = '';
  applyFilters();
}

function parseNotes(raw) {
  if (!raw) return [];
  return raw.split(/[,、，]/).map(n => n.trim()).filter(Boolean);
}

function renderStars(rating) {
  const full  = Math.floor(rating);
  const half  = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return (
    '<span class="stars" aria-hidden="true">' +
    '★'.repeat(full) +
    (half ? '½' : '') +
    '☆'.repeat(empty) +
    '</span>'
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
