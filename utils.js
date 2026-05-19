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
