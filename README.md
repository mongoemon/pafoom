# Pafoom — Perfume Collection Website

A static website that displays your perfume collection from a Google Sheet.  
No backend needed — just open `index.html` in a browser.

---

## Quick Start

1. [Set up your Google Sheet](#1-set-up-your-google-sheet)
2. [Make the sheet public](#2-make-the-sheet-public)
3. [Connect it to the site](#3-connect-it-to-the-site)
4. [Open the site](#4-open-the-site)

---

## 1. Set up your Google Sheet

Create a new Google Sheet. The **first row must be these headers** (exact spelling, any order):

| Column | Required | Description |
|--------|----------|-------------|
| `Name` | ✅ | Perfume name |
| `Brand` | ✅ | Brand / house name |
| `Image` | | Photo URL (see [Using Google Drive Images](#using-google-drive-images)) |
| `Notes` | | Fragrance notes, comma-separated — e.g. `Rose, Oud, Amber` |
| `Season` | | `Spring` `Summer` `Fall` `Winter` `All Season` |
| `Concentration` | | `EDP` `EDT` `Parfum` `EDC` etc. |
| `Rating` | | Number from `1` to `5` (decimals OK, e.g. `4.5`) |
| `Description` | | Your personal notes or review |
| `Status` | | `Owned` `Wishlist` `Decant` `Gifted` |
| `Volume` | | Bottle size, e.g. `100ml` |

Each perfume is one row. Only `Name` is required — all other columns are optional.

---

## 2. Make the sheet public

The site reads your sheet directly from the browser, so it must be publicly accessible.

1. Click **Share** (top-right in Google Sheets)
2. Under "General access", change to **Anyone with the link**
3. Set permission to **Viewer**
4. Click **Done**

---

## 3. Connect it to the site

Open `config.js` and fill in your Sheet ID:

```js
const CONFIG = {
  SHEET_ID: 'YOUR_GOOGLE_SHEET_ID_HERE',  // ← paste your ID here
  SHEET_NAME: 'Sheet1',                   // ← tab name at the bottom of your sheet
  USE_MOCK_DATA: false,                   // ← keep this false for real data
  LANGUAGE: 'auto',                       // ← 'auto', 'en', or 'th'
  ...
};
```

**Finding your Sheet ID** — it's the long string in the URL between `/d/` and `/edit`:

```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
                                        ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
```

---

## 4. Open the site

Open `index.html` in any browser. The collection loads automatically from your sheet.

To update your collection, just edit the Google Sheet and refresh the page — no code changes needed.

---

## Using Google Drive Images

You can store perfume photos in Google Drive and link them directly.

**For each image:**

1. Upload the photo to Google Drive
2. Right-click the file → **Share** → set to **Anyone with the link — Viewer**
3. Click **Copy link** — you'll get a URL like:
   ```
   https://drive.google.com/file/d/1ABC123.../view?usp=sharing
   ```
4. Paste that URL into the **Image** column of your sheet

The site converts it to a working image URL automatically.

> Each image file needs its own sharing permission. Setting a folder to public does not make the files inside it publicly viewable.

**Other image sources** — any direct image URL works too (Imgur, your own hosting, etc.).

---

## Bulk Image URLs from a Google Drive Folder

If you have many photos, use this Google Apps Script to match image files from a Drive folder to your sheet rows automatically — no manual copy-pasting.

### How matching works

Add an optional **`Photo`** column to your sheet. Write the image filename (without extension) for each row. The script finds that file in your Drive folder and fills in the `Image` URL.

| Name | Brand | Photo | Image |
|------|-------|-------|-------|
| Sauvage | Dior | dior_sauvage | ← filled by script |
| Black Orchid | Tom Ford | tf_black_orchid | ← filled by script |
| Aventus | Creed | creed_aventus | ← filled by script |

Your Drive folder contains:
```
dior_sauvage.jpg
tf_black_orchid.png
creed_aventus.jpg
```

The `Photo` column gives you full control — the filename can be anything, completely independent of the perfume name. If you skip the `Photo` column entirely, the script falls back to matching by the `Name` column instead.

> Already have an `Image` URL in a row? The script skips that row so it never overwrites existing data.

---

### Steps

**1. Add a `Photo` column header** to row 1 of your sheet (optional but recommended).

**2. Fill in the `Photo` column** — write just the filename without the extension for each row you want to sync.

**3. Upload all your photos to one Google Drive folder.**  
Name the files to match what you wrote in the `Photo` column.

**4. Copy the folder ID from the URL:**
```
https://drive.google.com/drive/folders/1ABCdef_FOLDER_ID_HERE
                                        ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
```

**5. Open your Google Sheet → Extensions → Apps Script.**

**6. Delete any existing code and paste this script:**

```javascript
function syncPerfumeImages() {
  const FOLDER_ID = 'PASTE_YOUR_FOLDER_ID_HERE'; // ← edit this

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  const headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const imageCol = headers.indexOf('Image') + 1;
  const photoCol = headers.indexOf('Photo') + 1; // explicit key column (preferred)
  const nameCol  = headers.indexOf('Name')  + 1; // fallback

  if (imageCol === 0) {
    SpreadsheetApp.getUi().alert('No "Image" column found in row 1.');
    return;
  }

  const matchCol = photoCol > 0 ? photoCol : nameCol;
  if (matchCol === 0) {
    SpreadsheetApp.getUi().alert('No "Photo" or "Name" column found in row 1.');
    return;
  }

  // Build key → row map from the sheet
  const lastRow = sheet.getLastRow();
  const keyMap  = {};
  const keys    = sheet.getRange(2, matchCol, lastRow - 1, 1).getValues();
  keys.forEach(([key], i) => {
    if (key) keyMap[String(key).trim().toLowerCase()] = i + 2;
  });

  // Build filename → file map from Drive
  const files   = folder.getFiles();
  const fileMap = {};
  while (files.hasNext()) {
    const file = files.next();
    if (!file.getMimeType().startsWith('image/')) continue;
    const base = file.getName().replace(/\.[^.]+$/, '').trim().toLowerCase();
    fileMap[base] = file;
  }

  // Match and fill
  let matched = 0;
  let skipped = 0;
  let missing = [];

  for (const [key, row] of Object.entries(keyMap)) {
    const existing = sheet.getRange(row, imageCol).getValue();
    if (existing) { skipped++; continue; } // already has a URL — skip

    if (fileMap[key]) {
      const file = fileMap[key];
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      sheet.getRange(row, imageCol).setValue(
        `https://lh3.googleusercontent.com/d/${file.getId()}`
      );
      matched++;
    } else {
      missing.push(key);
    }
  }

  let msg = `Done!\n• ${matched} image(s) filled\n• ${skipped} row(s) skipped (already had an image)`;
  if (missing.length) msg += `\n\nNo file found for:\n${missing.map(k => `  • ${k}`).join('\n')}`;
  SpreadsheetApp.getUi().alert(msg);
}
```

**7. Edit line 2** — replace `PASTE_YOUR_FOLDER_ID_HERE` with your actual folder ID.

**8. Click Save (Ctrl+S), then click Run → `syncPerfumeImages`.**  
The first run will ask for permissions — click **Allow**.

**9. Check your sheet** — `Image` URLs are filled in for every matched row.

To sync new photos later, just upload more files to the same folder and run the script again. Rows that already have an image are untouched.

---

### Naming examples

```
Photo column value    →   Drive filename
────────────────────────────────────────
dior_sauvage          →   dior_sauvage.jpg
tf_black_orchid       →   tf_black_orchid.png
creed_aventus         →   creed_aventus.jpeg
mfk_br540             →   mfk_br540.jpg
```

Case and file extension are ignored. Any format works (JPG, PNG, WEBP, etc.).

---

## Demo Mode

To preview the site with sample data before connecting your sheet, open `config.js` and set:

```js
USE_MOCK_DATA: true,
```

The 12 built-in sample fragrances live in `mock-data.js`. Switch `USE_MOCK_DATA` back to `false` when your real sheet is ready.

---

## Language (Thai / English)

The site supports English and Thai. The UI language is controlled by `LANGUAGE` in `config.js`.

### Option 1 — Auto mode (recommended)

Set `LANGUAGE: 'auto'` and map each sheet tab name to a language using `SHEET_LANGUAGES`:

```js
const CONFIG = {
  ...
  LANGUAGE: 'auto',  // follows SHEET_LANGUAGES below
};

const SHEET_LANGUAGES = {
  'Sheet1': 'en',  // this tab holds English data → English UI
  'Thai':   'th',  // this tab holds Thai data    → Thai UI
};
```

When the site loads the `Sheet1` tab it shows English; when it loads the `Thai` tab it shows Thai. Add or rename entries to match your actual tab names (case-sensitive).

### Option 2 — Fixed language

Pin the language regardless of which sheet is active:

```js
LANGUAGE: 'en',   // always English
LANGUAGE: 'th',   // always Thai
```

### Changing language at runtime

- **Header toggle button** — switches between English and Thai instantly (page reloads).
- **Settings page → Language** — choose Auto, English, or Thai. Saved to the browser.

> **Important for Google Sheets:** The `Season` and `Status` column values in your sheet must always be in English — `Spring`, `Summer`, `Fall`, `Winter`, `All Season`, `Owned`, `Wishlist`, `Decant`, `Gifted`. The Thai UI translates them for display only. All other columns (Name, Brand, Notes, Description, etc.) can contain Thai text freely.

---

## Customising

All display settings are in `config.js`:

| Setting | What it does |
|---------|-------------|
| `SITE_TITLE` | The large heading in the header |
| `SITE_SUBTITLE` | The smaller line below the title |
| `SHEET_NAME` | Which tab to read (default: `Sheet1`) |
| `LANGUAGE` | UI language: `'auto'`, `'en'`, or `'th'` |
| `SHEET_LANGUAGES` | Maps tab names to languages (used when `LANGUAGE` is `'auto'`) |
| `COLUMN_NAMES` | Rename columns if your headers are spelled differently |

> 💡 **Tip:** You can also configure all settings through the **Settings page** (`settings.html`) — no code editing required. Changes are saved to your browser and apply immediately when you return to the collection.

**Example — if your sheet uses `House` instead of `Brand`:**

```js
const COLUMN_NAMES = {
  BRAND: 'House',   // ← change the right-hand value only
  ...
};
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Could not load collection" | Check `SHEET_ID` is correct and the sheet is shared publicly |
| Images not showing | Make sure each image file in Drive is shared publicly (not just the folder) |
| Wrong data / missing columns | Check `SHEET_NAME` matches your tab name exactly (case-sensitive) |
| Filters not working | Check `Season` and `Status` values are in English even when using Thai UI |
| Language not switching | Check the tab name in `SHEET_LANGUAGES` matches your sheet tab exactly |

---

## Sorting

The collection grid supports sorting by rating via a dropdown next to the filters. Choose **High to Low** or **Low to High** to reorder the cards without reloading.

The sort control appears automatically when a real or mock data source is active.

---

## Settings Page

Open the settings page by clicking the gear icon in the header or visiting `settings.html`.

### Connection Test

Enter your Sheet ID and tab name, then click **Test Connection** to verify the sheet is reachable before saving. The test reports the number of rows found or an error message if the connection fails.

All settings — including Sheet ID, tab name, site title, subtitle, language, and column mappings — are saved to your browser's local storage and applied immediately when you return to the collection page.

---

## File Structure

```
Pafoom/
├── index.html     — collection page structure
├── style.css      — dark luxury styling (shared)
├── settings.html  — settings page
├── settings.css   — settings page styles
├── app.js         — data fetching and UI logic
├── settings.js    — settings page logic
├── config.js      — your sheet ID, language, and column mapping
├── locale.js      — English and Thai UI strings
├── mock-data.js   — 12 sample fragrances for demo mode
└── utils.js       — shared helpers (sheet URL builder, Drive image converter)
```
