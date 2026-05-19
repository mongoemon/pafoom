// ============================================================
//  PAFOOM — Shared Utilities
// ============================================================

// Google Sheets GViz base URL
function buildSheetsUrl(sheetId, sheetName, callbackName) {
    return (
        'https://docs.google.com/spreadsheets/d/' + sheetId + '/gviz/tq' +
        '?tqx=responseHandler:' + callbackName + '&sheet=' + encodeURIComponent(sheetName) + '&headers=1'
    );
}

// Extract Sheet ID from a full Google Sheets URL or a raw ID
function extractSheetId(raw) {
    var match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : raw;
}

// Converts any Google Drive share URL to a direct embeddable image URL
function toDriveImageUrl(url) {
    if (!url || !url.includes('drive.google.com')) return url;
    var match = url.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
    return match ? 'https://lh3.googleusercontent.com/d/' + match[1] : url;
}

// Generic JSONP fetch from Google Sheets GViz
// Returns a Promise that resolves with { table, count } on success
function sheetsFetch(sheetId, sheetName, timeoutMs) {
    return new Promise(function (resolve, reject) {
        var cbName = '__pafoom_fetch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        var url = buildSheetsUrl(sheetId, sheetName, cbName);

        var script = document.createElement('script');

        var cleanup = function () {
            delete window[cbName];
            script.remove();
        };

        var timer = setTimeout(function () {
            cleanup();
            reject(new Error('Timeout'));
        }, timeoutMs);

        window[cbName] = function (data) {
            clearTimeout(timer);
            cleanup();
            if (data.status === 'error') {
                reject(new Error(data.errors && data.errors[0] ? data.errors[0].detailed_message : 'Sheet returned an error'));
                return;
            }
            var rows = (data.table && data.table.rows) || [];
            resolve({
                table: data.table,
                count: rows.filter(function (r) { return r.c && r.c.some(function (c) { return c && c.v; }); }).length
            });
        };

        script.onerror = function () {
            clearTimeout(timer);
            cleanup();
            reject(new Error('Network error'));
        };

        document.head.appendChild(script);
        script.src = url;
    });
}

// ── Sheet ID validation ──────────────────────────────────────
// Returns false for empty, placeholder, or IDs that don't match
// the typical Google Sheets ID format (20+ alphanumeric/dash/underscore chars).
function isValidSheetId(sheetId) {
    if (!sheetId || sheetId === 'YOUR_GOOGLE_SHEET_ID_HERE') return false;
    return /^[a-zA-Z0-9_-]{20,}$/.test(sheetId);
}

// ── Local CSV parsing & fetching ─────────────────────────────
// Parses CSV text (with quoted multi-line fields) into the same
// { table: { cols, rows }, count } shape that sheetsFetch returns.
function parseCsvToTable(csvText) {
    var rows = [];
    var headers = [];

    var i = 0;
    var len = csvText.length;
    var currentRow = [];
    var currentField = '';
    var inQuotes = false;
    var afterQuote = false;

    // Strip BOM if present
    if (csvText.charCodeAt(0) === 0xFEFF) i = 1;

    while (i < len) {
        var ch = csvText[i];

        if (inQuotes) {
            if (ch === '"') {
                // Escaped quote ""
                if (i + 1 < len && csvText[i + 1] === '"') {
                    currentField += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                afterQuote = true;
                i++;
                continue;
            }
            currentField += ch;
            i++;
            continue;
        }

        if (afterQuote) {
            afterQuote = false;
            if (ch === ',') {
                currentRow.push(currentField);
                currentField = '';
                i++;
                continue;
            }
            if (ch === '\r') { i++; continue; }
            if (ch === '\n') {
                currentRow.push(currentField);
                currentField = '';
                rows.push(currentRow);
                currentRow = [];
                i++;
                continue;
            }
        }

        if (ch === '"') {
            inQuotes = true;
            i++;
            continue;
        }

        if (ch === ',') {
            currentRow.push(currentField);
            currentField = '';
            i++;
            continue;
        }

        if (ch === '\r') { i++; continue; }

        if (ch === '\n') {
            currentRow.push(currentField);
            currentField = '';
            if (currentRow.length > 0 || rows.length > 0) {
                rows.push(currentRow);
            }
            currentRow = [];
            i++;
            continue;
        }

        currentField += ch;
        i++;
    }

    // Last field / row
    if (currentField !== '' || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.some(function (f) { return f !== ''; })) {
            rows.push(currentRow);
        }
    }

    if (rows.length === 0) return { table: { cols: [], rows: [] }, count: 0 };

    headers = rows[0];
    var dataRows = rows.slice(1);

    var cols = headers.map(function (h) {
        return { label: h.trim() };
    });

    var tableRows = dataRows.map(function (row) {
        // Pad row to match header count (some rows may have fewer fields)
        while (row.length < cols.length) row.push('');
        return {
            c: row.map(function (val) {
                return { v: val };
            })
        };
    });

    return {
        table: {
            cols: cols,
            rows: tableRows
        },
        count: tableRows.length
    };
}

// Fetches a local CSV file and returns parsed table data.
// Resolves with { table, count } or rejects on failure.
function fetchLocalCsv(filePath, timeoutMs) {
    return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
            reject(new Error('Timeout'));
        }, timeoutMs || 10000);

        fetch(filePath)
            .then(function (response) {
                clearTimeout(timer);
                if (!response.ok) {
                    reject(new Error('Not found'));
                    return;
                }
                return response.text();
            })
            .then(function (text) {
                if (text === undefined) return;
                var result = parseCsvToTable(text);
                if (result.count === 0) {
                    reject(new Error('Empty CSV'));
                    return;
                }
                resolve(result);
            })
            .catch(function (err) {
                clearTimeout(timer);
                reject(err);
            });
    });
}

// Debounce utility
function debounce(fn, delay) {
    var timer;
    return function () {
        var self = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(self, args); }, delay);
    };
}

// Escape helpers
var _ESC_AMP = '&' + 'amp;';
var _ESC_LT = '&' + 'lt;';
var _ESC_GT = '&' + 'gt;';
var _ESC_QUOT = '&' + 'quot;';
var _ESC_APOS = '&' + '#39;';

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, _ESC_AMP)
        .replace(/</g, _ESC_LT)
        .replace(/>/g, _ESC_GT)
        .replace(/"/g, _ESC_QUOT);
}

function escapeAttr(str) {
    return String(str).replace(/"/g, _ESC_QUOT).replace(/'/g, _ESC_APOS);
}

// Shared SVG placeholder for perfume bottle (used by cards and modals)
var BOTTLE_PLACEHOLDER_SVG = [
    '<div class="card-image-placeholder" aria-hidden="true">',
    '  <svg viewBox="0 0 80 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '    <rect x="28" y="2" width="24" height="10" rx="3" stroke="currentColor" stroke-width="1.5"/>',
    '    <rect x="20" y="12" width="40" height="8" rx="2" stroke="currentColor" stroke-width="1.5"/>',
    '    <path d="M16 20h48a4 4 0 0 1 4 4v88a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4z" stroke="currentColor" stroke-width="1.5"/>',
    '    <path d="M28 50c0-6.627 5.373-12 12-12s12 5.373 12 12-5.373 18-12 18-12-11.373-12-18z" stroke="currentColor" stroke-width="1.2" opacity=".4"/>',
    '    <line x1="40" y1="75" x2="40" y2="95" stroke="currentColor" stroke-width="1.2" opacity=".3"/>',
    '  </svg>',
    '</div>'
].join('');

// Canonical value lists — single source of truth
var SEASONS = ['Spring', 'Summer', 'Fall', 'Winter', 'All Season'];
var STATUSES = ['Owned', 'Wishlist', 'Decant', 'Gifted'];

// Skeleton card count
var SKELETON_COUNT = 8;
