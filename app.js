// ============================================================
//  PAFOOM — Application Logic
// ============================================================

(function () {
  'use strict';

  // ── Config overrides from localStorage ────────────────────
  try {
    var savedCfg = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
    if (savedCfg.sheetId) CONFIG.SHEET_ID = savedCfg.sheetId;
    if (savedCfg.sheetName) CONFIG.SHEET_NAME = savedCfg.sheetName;
    if (savedCfg.siteTitle) CONFIG.SITE_TITLE = savedCfg.siteTitle;
    if (savedCfg.siteSubtitle) CONFIG.SITE_SUBTITLE = savedCfg.siteSubtitle;
    if (savedCfg.useMockData !== undefined) CONFIG.USE_MOCK_DATA = savedCfg.useMockData;
    if (savedCfg.columns) Object.assign(COLUMN_NAMES, savedCfg.columns);
    if (savedCfg.language) CONFIG.LANGUAGE = savedCfg.language;
  } catch (e) { /* ignore */ }

  // Resolve 'auto' language
  if (CONFIG.LANGUAGE === 'auto') {
    CONFIG.LANGUAGE =
      (typeof SHEET_LANGUAGES !== 'undefined' && SHEET_LANGUAGES[CONFIG.SHEET_NAME]) || 'en';
  }

  // ── State ──────────────────────────────────────────────────
  var L = LOCALES[CONFIG.LANGUAGE] || LOCALES.en;

  var state = {
    all: [],
    filtered: [],
  };

  // ── DOM references ────────────────────────────────────────
  var grid = document.getElementById('perfume-grid');
  var loading = document.getElementById('loading');
  var statsEl = document.getElementById('collection-stats');
  var searchInput = document.getElementById('search');
  var brandSel = document.getElementById('filter-brand');
  var seasonSel = document.getElementById('filter-season');
  var statusSel = document.getElementById('filter-status');
  var sortSel = document.getElementById('filter-sort');
  var overlay = document.getElementById('modal-overlay');
  var modalBody = document.getElementById('modal-content');

  // ── Locale helpers ────────────────────────────────────────
  function localizeStatus(status) {
    var s = status && status.toLowerCase ? status.toLowerCase() : '';
    var map = {};
    map.owned = L.statusOwned;
    map.wishlist = L.statusWishlist;
    map.decant = L.statusDecant;
    map.gifted = L.statusGifted;
    return map[s] || status;
  }

  function localizeSeason(season) {
    var s = season && season.toLowerCase ? season.toLowerCase() : '';
    var map = {};
    map.spring = L.seasonSpring;
    map.summer = L.seasonSummer;
    map.fall = L.seasonFall;
    map.winter = L.seasonWinter;
    map['all season'] = L.seasonAll;
    return map[s] || season;
  }

  // ── Translation (in-place, no reload) ──────────────────────
  function translateUI() {
    document.querySelector('.site-title').textContent = CONFIG.SITE_TITLE;
    document.querySelector('.site-subtitle').textContent = CONFIG.SITE_SUBTITLE;
    document.title = CONFIG.SITE_TITLE;
    document.documentElement.lang = L.lang;

    searchInput.placeholder = L.searchPlaceholder;
    searchInput.setAttribute('aria-label', L.searchPlaceholder);
    if (sortSel) sortSel.options[0].textContent = L.sortByRating;
    brandSel.options[0].textContent = L.allBrands;
    var footerP = document.querySelector('.site-footer p');
    if (footerP) footerP.textContent = L.footer;
    if (sortSel) {
      sortSel.options[1].textContent = L.sortHighToLow;
      sortSel.options[2].textContent = L.sortLowToHigh;
    }
    var langBtn = document.getElementById('lang-toggle');
    if (langBtn) langBtn.textContent = L.langSwitch;

    // Translate view mode button labels
    document.querySelectorAll('.view-btn span').forEach(function (span) {
      var btn = span.parentElement;
      var view = btn.getAttribute('data-view');
      var labels = { tile: L.viewTile, list: L.viewList, details: L.viewDetails, content: L.viewContent };
      if (labels[view]) span.textContent = labels[view];
    });

    buildFilterOptions();
    renderByView(state.filtered);
    renderStats(state.filtered);
  }

  // ── Language toggle (in-place) ────────────────────────────
  function toggleLanguage() {
    var next = CONFIG.LANGUAGE === 'th' ? 'en' : 'th';
    CONFIG.LANGUAGE = next;
    L = LOCALES[next] || LOCALES.en;
    try {
      var s = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
      s.language = next;
      localStorage.setItem('pafoom_config', JSON.stringify(s));
    } catch (e) { /* ignore */ }
    translateUI();
  }

  // Expose toggleLanguage so HTML onclick still works
  window.toggleLanguage = toggleLanguage;

  // ── View mode ─────────────────────────────────────────────
  var VIEW_MODES = ['tile', 'list', 'details', 'content'];

  function saveViewMode(mode) {
    try {
      var s = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
      s.viewMode = mode;
      localStorage.setItem('pafoom_config', JSON.stringify(s));
    } catch (e) { /* ignore */ }
  }

  function loadViewMode() {
    try {
      var s = JSON.parse(localStorage.getItem('pafoom_config') || '{}');
      if (s.viewMode && VIEW_MODES.indexOf(s.viewMode) !== -1) return s.viewMode;
    } catch (e) { /* ignore */ }
    return 'tile';
  }

  function switchView(mode) {
    document.querySelectorAll('.view-btn').forEach(function (btn) {
      var isActive = btn.getAttribute('data-view') === mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
    saveViewMode(mode);
    grid.className = 'perfume-grid perfume-grid--' + mode;
    // Re-render with current data using the correct view renderer
    renderByView(state.filtered);
  }

  function renderByView(perfumes) {
    var mode = loadViewMode();
    if (mode === 'list') { renderListView(perfumes); }
    else if (mode === 'details') { renderDetailsView(perfumes); }
    else if (mode === 'content') { renderContentView(perfumes); }
    else { renderGridView(perfumes); }
  }

  // ── Data fetching (cascading: Google Sheets → local CSV → mock) ──
  function fetchData() {
    showSkeletons();

    // Step 1: Check if the Sheet ID is valid
    if (isValidSheetId(CONFIG.SHEET_ID)) {
      // Try Google Sheets first
      sheetsFetch(CONFIG.SHEET_ID, CONFIG.SHEET_NAME, 12000).then(
        function (result) {
          applySheetData(result);
        }
      ).catch(function (err) {
        console.warn('[Pafoom] Google Sheets fetch failed, trying local CSV files:', err.message);
        tryLocalCsv();
      });
    } else {
      // Invalid or placeholder Sheet ID — skip straight to local CSV
      console.log('[Pafoom] Sheet ID is invalid or a placeholder, trying local CSV files.');
      tryLocalCsv();
    }
  }

  function applySheetData(result) {
    state.all = parseTable(result.table);
    state.filtered = state.all.slice();
    populateBrandFilter();
    renderByView(state.all);
    renderStats(state.all);
  }

  // Step 2: Try local CSV files (primary, then alternate)
  function tryLocalCsv() {
    var primaryPath = 'sheet/' + CONFIG.SHEET_NAME + '.csv';

    fetchLocalCsv(primaryPath, 10000).then(
      function (result) {
        applySheetData(result);
      }
    ).catch(function (primaryErr) {
      console.warn('[Pafoom] Local CSV "' + primaryPath + '" failed:', primaryErr.message);

      // Try the alternate sheet name if it exists
      var altSheetName = (CONFIG.SHEET_NAME === 'Thai') ? 'Sheet1' : 'Thai';
      var altPath = 'sheet/' + altSheetName + '.csv';

      fetchLocalCsv(altPath, 10000).then(
        function (result) {
          applySheetData(result);
        }
      ).catch(function (altErr) {
        console.warn('[Pafoom] Alternate local CSV "' + altPath + '" also failed:', altErr.message);
        // Step 3: Fall back to mock data
        loadMockData();
      });
    });
  }

  function parseTable(table) {
    if (!table || !table.cols || !table.rows) return [];

    // Build header -> column-index map (case-insensitive)
    var headerMap = {};
    table.cols.forEach(function (col, i) {
      headerMap[col.label.trim().toLowerCase()] = i;
    });

    // Map configured column names to indices
    var idx = {};
    Object.keys(COLUMN_NAMES).forEach(function (key) {
      var label = COLUMN_NAMES[key].trim().toLowerCase();
      idx[key] = headerMap.hasOwnProperty(label) ? headerMap[label] : -1;
    });

    function get(row, key) {
      var i = idx[key];
      if (i === -1) return '';
      var cell = row.c[i];
      if (!cell || cell.v === null || cell.v === undefined) return '';
      return String(cell.v).trim();
    }

    return table.rows
      .map(function (row) {
        return {
          name: get(row, 'NAME'),
          brand: get(row, 'BRAND'),
          image: toDriveImageUrl(get(row, 'IMAGE')),
          notes: get(row, 'NOTES'),
          season: get(row, 'SEASON'),
          concentration: get(row, 'CONCENTRATION'),
          rating: parseFloat(get(row, 'RATING')) || 0,
          description: get(row, 'DESCRIPTION'),
          status: get(row, 'STATUS'),
          volume: get(row, 'VOLUME'),
        };
      })
      .filter(function (p) { return p.name; });
  }

  // ── Filters & search ─────────────────────────────────────
  function buildFilterOptions() {
    seasonSel.innerHTML =
      '<option value="">' + L.allSeasons + '</option>' +
      SEASONS.map(function (s) {
        var key = s.toLowerCase();
        var labels = {
          spring: L.seasonSpring, summer: L.seasonSummer,
          fall: L.seasonFall, winter: L.seasonWinter,
          'all season': L.seasonAll
        };
        return '<option value="' + s + '">' + (labels[key] || s) + '</option>';
      }).join('');

    statusSel.innerHTML =
      '<option value="">' + L.allStatus + '</option>' +
      STATUSES.map(function (s) {
        var key = s.toLowerCase();
        var labels = {
          owned: L.statusOwned, wishlist: L.statusWishlist,
          decant: L.statusDecant, gifted: L.statusGifted
        };
        return '<option value="' + s + '">' + (labels[key] || s) + '</option>';
      }).join('');
  }

  function setupListeners() {
    searchInput.addEventListener('input', debounce(applyFilters, 250));
    brandSel.addEventListener('change', applyFilters);
    seasonSel.addEventListener('change', applyFilters);
    statusSel.addEventListener('change', applyFilters);
    if (sortSel) sortSel.addEventListener('change', applyFilters);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  function applyFilters() {
    var q = searchInput.value.toLowerCase();
    var brand = brandSel.value;
    var season = seasonSel.value;
    var status = statusSel.value;
    var sort = sortSel ? sortSel.value : '';

    state.filtered = state.all.filter(function (p) {
      var matchQ =
        !q ||
        p.name.toLowerCase().indexOf(q) !== -1 ||
        p.brand.toLowerCase().indexOf(q) !== -1 ||
        p.notes.toLowerCase().indexOf(q) !== -1 ||
        p.description.toLowerCase().indexOf(q) !== -1;

      var matchBrand = !brand || p.brand === brand;
      var matchSeason = !season || p.season === season;
      var matchStatus = !status || p.status === status;

      return matchQ && matchBrand && matchSeason && matchStatus;
    });

    // Sort by rating
    if (sort === 'desc') {
      state.filtered.sort(function (a, b) { return b.rating - a.rating; });
    } else if (sort === 'asc') {
      state.filtered.sort(function (a, b) { return a.rating - b.rating; });
    }

    renderByView(state.filtered);
    renderStats(state.filtered, q || brand || season || status);
  }

  function populateBrandFilter() {
    var seen = {};
    var brands = [];
    state.all.forEach(function (p) {
      if (p.brand && !seen[p.brand]) {
        seen[p.brand] = true;
        brands.push(p.brand);
      }
    });
    brands.sort();

    // Remove previously appended brand options (keep the first "All Brands" option)
    while (brandSel.options.length > 1) {
      brandSel.remove(1);
    }

    brands.forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      brandSel.appendChild(opt);
    });
  }

  // ── Rendering ─────────────────────────────────────────────

  function renderEmptyView() {
    grid.innerHTML =
      '<div class="empty-state">' +
      '  <div class="empty-icon">✦</div>' +
      '  <p>' + L.noResults + '</p>' +
      '  <button class="btn-reset" id="btn-reset-filters">' + L.clearFilters + '</button>' +
      '</div>';
    document.getElementById('btn-reset-filters').addEventListener('click', resetFilters);
  }

  // ── Tile view (original card grid) ─────────────────────────
  function renderGridView(perfumes) {
    grid.innerHTML = '';

    if (!perfumes.length) { renderEmptyView(); return; }

    var frag = document.createDocumentFragment();
    perfumes.forEach(function (p) { frag.appendChild(createCard(p)); });
    grid.appendChild(frag);
  }

  // ── List view (compact rows) ───────────────────────────────
  function renderListView(perfumes) {
    grid.innerHTML = '';

    if (!perfumes.length) { renderEmptyView(); return; }

    var frag = document.createDocumentFragment();
    perfumes.forEach(function (p) {
      var row = document.createElement('article');
      row.className = 'perfume-list-row';
      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', p.name + ' by ' + p.brand);

      var statusClass = p.status ? 'status-' + p.status.toLowerCase().replace(/\s+/g, '-') : '';

      row.innerHTML =
        '<div class="list-thumb">' +
        (p.image
          ? '<img src="' + escapeAttr(p.image) + '" alt="' + escapeAttr(p.name) + '" loading="lazy" onerror="this.parentElement.classList.add(\'img-error\')">'
          : BOTTLE_PLACEHOLDER_SVG) +
        '</div>' +
        '<div class="list-body">' +
        '  <div class="list-main">' +
        '    <span class="list-brand">' + escapeHtml(p.brand) + '</span>' +
        '    <span class="list-sep">·</span>' +
        '    <span class="list-name">' + escapeHtml(p.name) + '</span>' +
        '  </div>' +
        '  <div class="list-meta">' +
        (p.rating ? '<span class="list-rating" aria-label="' + L.outOf5Stars(p.rating) + '">' + renderStars(p.rating) + ' ' + p.rating.toFixed(1) + '</span>' : '') +
        (p.concentration ? '<span class="meta-tag">' + escapeHtml(p.concentration) + '</span>' : '') +
        (p.season ? '<span class="meta-tag">' + escapeHtml(localizeSeason(p.season)) + '</span>' : '') +
        (p.volume ? '<span class="meta-tag">' + escapeHtml(p.volume) + '</span>' : '') +
        (p.status ? '<span class="status-badge ' + statusClass + '">' + escapeHtml(localizeStatus(p.status)) + '</span>' : '') +
        '  </div>' +
        '</div>';

      row.addEventListener('click', function () { openModal(p); });
      row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openModal(p); });
      frag.appendChild(row);
    });
    grid.appendChild(frag);
  }

  // ── Details view (expanded cards with description) ─────────
  function renderDetailsView(perfumes) {
    grid.innerHTML = '';

    if (!perfumes.length) { renderEmptyView(); return; }

    var frag = document.createDocumentFragment();
    perfumes.forEach(function (p) {
      var card = document.createElement('article');
      card.className = 'perfume-detail-card';
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', p.name + ' by ' + p.brand);

      var notesHtml = parseNotes(p.notes)
        .map(function (n) { return '<span class="note-tag">' + n + '</span>'; })
        .join('');
      var statusClass = p.status ? 'status-' + p.status.toLowerCase().replace(/\s+/g, '-') : '';

      card.innerHTML =
        '<div class="detail-image-wrap">' +
        (p.image
          ? '<img src="' + escapeAttr(p.image) + '" alt="' + escapeAttr(p.name) + '" loading="lazy" onerror="this.parentElement.classList.add(\'img-error\');this.remove()">'
          : BOTTLE_PLACEHOLDER_SVG) +
        (p.status ? '<span class="status-badge ' + statusClass + '">' + escapeHtml(localizeStatus(p.status)) + '</span>' : '') +
        '</div>' +
        '<div class="detail-body">' +
        '  <p class="card-brand">' + escapeHtml(p.brand) + '</p>' +
        '  <h2 class="detail-name">' + escapeHtml(p.name) + '</h2>' +
        '  <div class="detail-meta-row">' +
        (p.rating ? '<div class="card-rating" aria-label="' + L.outOf5Stars(p.rating) + '">' + renderStars(p.rating) + '<span class="rating-num">' + p.rating.toFixed(1) + '</span></div>' : '') +
        (p.concentration ? '<span class="meta-tag">' + escapeHtml(p.concentration) + '</span>' : '') +
        (p.season ? '<span class="meta-tag">' + escapeHtml(localizeSeason(p.season)) + '</span>' : '') +
        (p.volume ? '<span class="meta-tag">' + escapeHtml(p.volume) + '</span>' : '') +
        '  </div>' +
        (notesHtml ? '<div class="card-notes">' + notesHtml + '</div>' : '') +
        (p.description ? '<p class="detail-desc">' + escapeHtml(p.description) + '</p>' : '') +
        '</div>';

      card.addEventListener('click', function () { openModal(p); });
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openModal(p); });
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  // ── Content view (full-width magazine layout, 1 per row) ───
  function renderContentView(perfumes) {
    grid.innerHTML = '';

    if (!perfumes.length) { renderEmptyView(); return; }

    var frag = document.createDocumentFragment();

    perfumes.forEach(function (p) {
      var hero = document.createElement('article');
      hero.className = 'perfume-content-hero';
      hero.setAttribute('tabindex', '0');
      hero.setAttribute('role', 'button');
      hero.setAttribute('aria-label', p.name + ' by ' + p.brand);

      var notesHtml = parseNotes(p.notes)
        .map(function (n) { return '<span class="note-tag">' + n + '</span>'; })
        .join('');
      var statusClass = p.status ? 'status-' + p.status.toLowerCase().replace(/\s+/g, '-') : '';

      hero.innerHTML =
        '<div class="hero-image-wrap">' +
        (p.image
          ? '<img src="' + escapeAttr(p.image) + '" alt="' + escapeAttr(p.name) + '" loading="lazy" onerror="this.parentElement.classList.add(\'img-error\');this.remove()">'
          : BOTTLE_PLACEHOLDER_SVG) +
        (p.status ? '<span class="status-badge ' + statusClass + '">' + escapeHtml(localizeStatus(p.status)) + '</span>' : '') +
        '</div>' +
        '<div class="hero-body">' +
        '  <p class="card-brand">' + escapeHtml(p.brand) + '</p>' +
        '  <h2 class="hero-name">' + escapeHtml(p.name) + '</h2>' +
        (p.rating ? '<div class="card-rating" aria-label="' + L.outOf5Stars(p.rating) + '">' + renderStars(p.rating) + '<span class="rating-num">' + p.rating.toFixed(1) + '</span></div>' : '') +
        (notesHtml ? '<div class="card-notes">' + notesHtml + '</div>' : '') +
        '  <div class="card-meta">' +
        (p.concentration ? '<span class="meta-tag">' + escapeHtml(p.concentration) + '</span>' : '') +
        (p.season ? '<span class="meta-tag">' + escapeHtml(localizeSeason(p.season)) + '</span>' : '') +
        (p.volume ? '<span class="meta-tag">' + escapeHtml(p.volume) + '</span>' : '') +
        '  </div>' +
        (p.description ? '<p class="hero-desc">' + escapeHtml(p.description) + '</p>' : '') +
        '</div>';

      hero.addEventListener('click', function () { openModal(p); });
      hero.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openModal(p); });
      frag.appendChild(hero);
    });

    grid.appendChild(frag);
  }

  function createCard(p) {
    var card = document.createElement('article');
    card.className = 'perfume-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', p.name + ' by ' + p.brand);

    var notesHtml = parseNotes(p.notes)
      .map(function (n) { return '<span class="note-tag">' + n + '</span>'; })
      .join('');

    var statusClass = p.status ? 'status-' + p.status.toLowerCase().replace(/\s+/g, '-') : '';

    card.innerHTML =
      '<div class="card-image-wrap">' +
      (p.image
        ? '<img src="' + escapeAttr(p.image) + '" alt="' + escapeAttr(p.name) + '" class="card-image" loading="lazy" onerror="this.parentElement.classList.add(\'img-error\');this.remove()">'
        : '') +
      BOTTLE_PLACEHOLDER_SVG +
      (p.status ? '<span class="status-badge ' + statusClass + '">' + escapeHtml(localizeStatus(p.status)) + '</span>' : '') +
      '</div>' +
      '<div class="card-body">' +
      '  <p class="card-brand">' + escapeHtml(p.brand) + '</p>' +
      '  <h2 class="card-name">' + escapeHtml(p.name) + '</h2>' +
      (p.rating ? '<div class="card-rating" aria-label="' + L.outOf5Stars(p.rating) + '">' + renderStars(p.rating) + '<span class="rating-num">' + p.rating.toFixed(1) + '</span></div>' : '') +
      (notesHtml ? '<div class="card-notes">' + notesHtml + '</div>' : '') +
      '  <div class="card-meta">' +
      (p.concentration ? '<span class="meta-tag">' + escapeHtml(p.concentration) + '</span>' : '') +
      (p.season ? '<span class="meta-tag">' + escapeHtml(localizeSeason(p.season)) + '</span>' : '') +
      (p.volume ? '<span class="meta-tag">' + escapeHtml(p.volume) + '</span>' : '') +
      '  </div>' +
      '</div>';

    card.addEventListener('click', function () { openModal(p); });
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') openModal(p); });
    return card;
  }

  function renderStats(perfumes, filtered) {
    var owned = 0;
    var wishlist = 0;
    perfumes.forEach(function (p) {
      var s = p.status && p.status.toLowerCase ? p.status.toLowerCase() : '';
      if (s === 'owned') owned++;
      if (s === 'wishlist') wishlist++;
    });
    var total = perfumes.length;

    var prefix = filtered ? L.statsShowing : L.statsCollection;
    var parts = ['<span>' + total + ' ' + (total === 1 ? L.fragrance : L.fragrances) + '</span>'];
    if (!filtered && owned) parts.push('<span>' + owned + ' ' + L.statsOwned + '</span>');
    if (!filtered && wishlist) parts.push('<span>' + wishlist + ' ' + L.statsWishlist + '</span>');

    statsEl.innerHTML = '<p class="stats-text">' + prefix + ' · ' + parts.join(' · ') + '</p>';
  }

  // ── Modal ─────────────────────────────────────────────────
  function openModal(p) {
    var allNotes = parseNotes(p.notes).map(function (n) { return '<span class="note-tag">' + n + '</span>'; }).join('');
    var statusClass = p.status ? 'status-' + p.status.toLowerCase().replace(/\s+/g, '-') : '';

    // modal placeholder variant
    var modalPlaceholder = BOTTLE_PLACEHOLDER_SVG.replace('card-image-placeholder', 'card-image-placeholder modal-placeholder');

    modalBody.innerHTML =
      '<div class="modal-image-wrap">' +
      (p.image
        ? '<img src="' + escapeAttr(p.image) + '" alt="' + escapeAttr(p.name) + '" class="modal-image" onerror="this.parentElement.classList.add(\'img-error\');this.remove()">'
        : '') +
      modalPlaceholder +
      '</div>' +
      '<div class="modal-info">' +
      '  <p class="modal-brand">' + escapeHtml(p.brand) + '</p>' +
      '  <h2 class="modal-name" id="modal-title">' + escapeHtml(p.name) + '</h2>' +
      '  <div class="modal-badges">' +
      (p.status ? '<span class="status-badge ' + statusClass + '">' + escapeHtml(localizeStatus(p.status)) + '</span>' : '') +
      (p.concentration ? '<span class="meta-tag">' + escapeHtml(p.concentration) + '</span>' : '') +
      (p.volume ? '<span class="meta-tag">' + escapeHtml(p.volume) + '</span>' : '') +
      (p.season ? '<span class="meta-tag">' + escapeHtml(localizeSeason(p.season)) + '</span>' : '') +
      '  </div>' +
      (p.rating ? '<div class="modal-rating" aria-label="' + L.outOf5(p.rating) + '">' + renderStars(p.rating) + '<span class="rating-num">' + p.rating.toFixed(1) + '</span></div>' : '') +
      (allNotes ?
        '<div class="modal-section">' +
        '  <p class="modal-label">' + L.fragranceNotes + '</p>' +
        '  <div class="modal-notes">' + allNotes + '</div>' +
        '</div>' : '') +
      (p.description ?
        '<div class="modal-section">' +
        '  <p class="modal-label">' + L.myNotes + '</p>' +
        '  <p class="modal-description">' + escapeHtml(p.description) + '</p>' +
        '</div>' : '') +
      '</div>';

    overlay.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
  }

  // ── Loading / error states ────────────────────────────────
  function showSkeletons() {
    var cards = [];
    for (var i = 0; i < SKELETON_COUNT; i++) {
      cards.push(
        '<div class="skeleton-card" aria-hidden="true">' +
        '  <div class="skeleton skeleton-img"></div>' +
        '  <div class="skeleton-body">' +
        '    <div class="skeleton skeleton-line short"></div>' +
        '    <div class="skeleton skeleton-line"></div>' +
        '    <div class="skeleton skeleton-line medium"></div>' +
        '  </div>' +
        '</div>'
      );
    }
    grid.innerHTML = cards.join('');
  }

  function showError(err) {
    grid.innerHTML =
      '<div class="error-state">' +
      '  <p class="error-title">' + L.errorTitle + '</p>' +
      '  <p class="error-detail">' + escapeHtml(err.message) + '</p>' +
      '  <ul class="error-tips">' +
      '    <li>' + L.errorTip1 + '</li>' +
      '    <li>' + L.errorTip2 + '</li>' +
      '    <li>' + L.errorTip3 + '</li>' +
      '  </ul>' +
      '  <button class="btn-reset" id="btn-try-again">' + L.tryAgain + '</button>' +
      '</div>';
    document.getElementById('btn-try-again').addEventListener('click', fetchData);
    console.error('[Pafoom]', err);
  }

  function loadMockData() {
    showSkeletons();
    setTimeout(function () {
      state.all = MOCK_DATA;
      state.filtered = MOCK_DATA.slice();
      populateBrandFilter();
      renderByView(state.all);
      renderStats(state.all);

      var banner = document.createElement('div');
      banner.className = 'demo-banner';
      banner.innerHTML = L.demoBanner;
      document.querySelector('.main-content').prepend(banner);
    }, 600);
  }

  function showSetupMessage() {
    grid.innerHTML =
      '<div class="setup-state">' +
      '  <h2 class="setup-title">Welcome to Pafoom ✦</h2>' +
      '  <p>Open <code>config.js</code> and replace <code>YOUR_GOOGLE_SHEET_ID_HERE</code> with your actual Sheet ID to get started.</p>' +
      '  <ol class="setup-steps">' +
      '    <li>Create a Google Sheet with columns: <em>Name, Brand, Image, Notes, Season, Concentration, Rating, Description, Status, Volume</em></li>' +
      '    <li>Share it → <em>"Anyone with the link — Viewer"</em></li>' +
      '    <li>Copy the Sheet ID from the URL</li>' +
      '    <li>Paste it in <code>config.js</code></li>' +
      '  </ol>' +
      '</div>';
    if (loading) loading.remove();
  }

  // ── Helpers ───────────────────────────────────────────────
  function resetFilters() {
    searchInput.value = '';
    brandSel.value = '';
    seasonSel.value = '';
    statusSel.value = '';
    if (sortSel) sortSel.value = '';
    applyFilters();
  }

  // Expose resetFilters for HTML onclick (empty-state button)
  window.resetFilters = resetFilters;

  function parseNotes(raw) {
    if (!raw) return [];
    // Split by newlines first (for Top:/Mid:/Base: format), then by commas
    return raw.split(/\n/).reduce(function (acc, line) {
      var parts = line.split(/[,、，]/).map(function (n) { return n.trim(); }).filter(Boolean);
      if (parts.length) {
        // Re-join comma-separated items on the same line so each line stays as one tag
        acc.push(parts.join(', '));
      }
      return acc;
    }, []);
  }

  function renderStars(rating) {
    var full = Math.floor(rating);
    var half = rating % 1 >= 0.5 ? 1 : 0;
    var empty = 5 - full - half;
    var star = '★';
    var emptyStar = '☆';
    var i;
    var result = '<span class="stars" aria-hidden="true">';
    for (i = 0; i < full; i++) result += star;
    if (half) result += '½';
    for (i = 0; i < empty; i++) result += emptyStar;
    result += '</span>';
    return result;
  }

  // ── Initialise ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Set initial view mode class
    var initialView = loadViewMode();
    grid.className = 'perfume-grid perfume-grid--' + initialView;
    document.querySelectorAll('.view-btn').forEach(function (btn) {
      var isActive = btn.getAttribute('data-view') === initialView;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    translateUI();

    // View mode button listeners
    document.querySelectorAll('.view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchView(this.getAttribute('data-view'));
      });
    });

    // If user explicitly enabled mock data, use it directly
    if (CONFIG.USE_MOCK_DATA) {
      loadMockData();
      setupListeners();
      return;
    }

    // Otherwise use cascading fetch:
    //   Google Sheets → local CSV (Sheet1.csv / Thai.csv) → mock data
    fetchData();
    setupListeners();
  });

})();
