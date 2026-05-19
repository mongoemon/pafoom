// ============================================================
//  PAFOOM — CONFIGURATION
//  Edit this file to connect your Google Sheet.
// ============================================================
//
//  SETUP STEPS:
//  1. Create a Google Sheet with the column headers listed
//     under COLUMN_NAMES below (first row = headers).
//
//  2. Make the sheet public so this site can read it:
//       Share → Change to "Anyone with the link" → Viewer
//     (Or: File → Share → Publish to web)
//
//  3. Copy the Sheet ID from the URL bar:
//       https://docs.google.com/spreadsheets/d/[COPY_THIS]/edit
//
//  4. Paste it as the value of SHEET_ID below, then save.
//
// ============================================================
//
//  RECOMMENDED GOOGLE SHEET COLUMNS (first-row headers):
//
//    Name          | Brand         | Image
//    Notes         | Season        | Concentration
//    Rating        | Description   | Status
//    Volume
//
//  - Image    → paste a direct image URL (Imgur, Google Photos
//               "direct link", etc.)
//  - Notes    → comma-separated, e.g. "Rose, Oud, Amber"
//  - Season   → Spring / Summer / Fall / Winter / All Season
//  - Rating   → number 1–5
//  - Status   → Owned / Wishlist / Decant / Gifted
//
// ============================================================

const CONFIG = {
  SHEET_ID: '1vTTJWPtJGkcYEmRoqH6NrXr34-DiF1OnpZGqDImNk-k',
  SHEET_NAME: 'Sheet1',        // The tab name at the bottom of your sheet

  SITE_TITLE: 'Pafoom',
  SITE_SUBTITLE: 'My Fragrance Collection',

  // Set to true to preview with demo data instead of fetching from Google Sheets.
  // Switch back to false when your real sheet is ready.
  USE_MOCK_DATA: false,

  // UI language: 'auto', 'en', or 'th'.
  //   'auto' — automatically follows SHEET_LANGUAGES below.
  //   'en'   — always English regardless of sheet.
  //   'th'   — always Thai regardless of sheet.
  // Can also be changed from the Settings page.
  LANGUAGE: 'auto',
};

// ── Sheet → Language mapping (used when LANGUAGE is 'auto') ──
//
//  Add one entry per sheet tab name. The tab name must match
//  exactly the tab at the bottom of your Google Sheet (case-sensitive).
//
//    'MyTabName': 'en'   ← this tab holds English data → English UI
//    'MyTabName': 'th'   ← this tab holds Thai data    → Thai UI
//
const SHEET_LANGUAGES = {
  'Sheet1': 'en',   // ← rename or duplicate as needed
  'Thai': 'th',
};

// Map CONFIG column names → your actual sheet header text.
// Change the right-hand values if your headers are spelled differently.
const COLUMN_NAMES = {
  NAME: 'Name',
  BRAND: 'Brand',
  IMAGE: 'Image',
  NOTES: 'Notes',
  SEASON: 'Season',
  CONCENTRATION: 'Concentration',
  RATING: 'Rating',
  DESCRIPTION: 'Description',
  STATUS: 'Status',
  VOLUME: 'Volume',
};

// ============================================================
//  MOCK DATA — see mock-data.js for sample fragrances.
// ============================================================
