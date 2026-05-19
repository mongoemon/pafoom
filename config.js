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
  'Thai':   'th',
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
//  MOCK DATA — shown automatically when SHEET_ID is not set.
//  Remove or clear this array once you connect your real sheet.
// ============================================================
const MOCK_DATA = [
  {
    name: 'Sauvage',
    brand: 'Dior',
    image: 'https://placehold.co/300x400/141418/c8a96e?text=Sauvage',
    notes: 'Bergamot, Ambroxan, Pepper, Vetiver',
    season: 'Fall',
    concentration: 'EDP',
    rating: 4.5,
    description: 'My go-to autumn fragrance. Incredibly versatile — works for a casual day out or a formal dinner. The ambroxan dry-down is addictive.',
    status: 'Owned',
    volume: '100ml',
  },
  {
    name: 'Bleu de Chanel',
    brand: 'Chanel',
    image: 'https://placehold.co/300x400/0e1420/7ab3e0?text=Bleu',
    notes: 'Citrus, Ginger, Sandalwood, Cedar, Labdanum',
    season: 'All Season',
    concentration: 'EDP',
    rating: 4,
    description: 'A safe, polished all-rounder. Never wrong, never boring. The EDP version has noticeably more depth and longevity than the EDT.',
    status: 'Owned',
    volume: '50ml',
  },
  {
    name: 'Aventus',
    brand: 'Creed',
    image: 'https://placehold.co/300x400/1a150e/d4a843?text=Aventus',
    notes: 'Pineapple, Blackcurrant, Birch, Ambergris, Oakmoss',
    season: 'Spring',
    concentration: 'EDP',
    rating: 5,
    description: 'The holy grail. My batch leans fruity-smoky with excellent projection. Worth every penny for special occasions.',
    status: 'Wishlist',
    volume: '100ml',
  },
  {
    name: 'Black Orchid',
    brand: 'Tom Ford',
    image: 'https://placehold.co/300x400/130a14/b87fc4?text=Black+Orchid',
    notes: 'Black Truffle, Ylang-Ylang, Black Orchid, Patchouli, Dark Chocolate',
    season: 'Winter',
    concentration: 'EDP',
    rating: 4.5,
    description: 'Dark, sensual, and completely unique. This is a perfume that demands attention. Not for the faint of heart.',
    status: 'Owned',
    volume: '50ml',
  },
  {
    name: 'Jazz Club',
    brand: 'Maison Margiela',
    image: '',
    notes: 'Rum, Pink Pepper, Neroli, Tobacco, Vetiver, Vanilla',
    season: 'Fall',
    concentration: 'EDT',
    rating: 4,
    description: 'Exactly what the name promises — warm, smoky, slightly sweet. Perfect for a cozy evening. The rum and tobacco opening is brilliant.',
    status: 'Decant',
    volume: '5ml',
  },
  {
    name: 'Oud Wood',
    brand: 'Tom Ford',
    image: 'https://placehold.co/300x400/110c08/c48a55?text=Oud+Wood',
    notes: 'Oud, Rosewood, Cardamom, Sandalwood, Vetiver, Tonka Bean',
    season: 'Winter',
    concentration: 'EDP',
    rating: 4.5,
    description: 'The most approachable oud fragrance I have tried. Smooth and creamy rather than animalic. The price is painful but the scent is flawless.',
    status: 'Wishlist',
    volume: '100ml',
  },
  {
    name: 'Lime Basil & Mandarin',
    brand: 'Jo Malone',
    image: '',
    notes: 'Lime, Basil, White Thyme, Mandarin, Amber',
    season: 'Spring',
    concentration: 'EDC',
    rating: 3.5,
    description: 'Fresh and herbal — the perfect summer cologne. Longevity is short but the opening is so joyful I do not mind reapplying.',
    status: 'Owned',
    volume: '100ml',
  },
  {
    name: 'L\'Homme',
    brand: 'Yves Saint Laurent',
    image: 'https://placehold.co/300x400/0f1118/8899cc?text=L\'Homme',
    notes: 'Ginger, Bergamot, Cedar, White Pepper, Vetiver',
    season: 'All Season',
    concentration: 'EDT',
    rating: 3.5,
    description: 'A gift from a close friend. Classy and understated — the kind of scent that gets quiet compliments rather than loud ones.',
    status: 'Gifted',
    volume: '60ml',
  },
  {
    name: 'Acqua di Giò',
    brand: 'Giorgio Armani',
    image: '',
    notes: 'Aquatic, Bergamot, Neroli, Rosemary, Patchouli',
    season: 'Summer',
    concentration: 'EDT',
    rating: 3.5,
    description: 'My summer staple. Smells like sunscreen at the beach in the best way. Familiar to everyone but still a classic for good reason.',
    status: 'Owned',
    volume: '100ml',
  },
  {
    name: 'Tobacco Vanille',
    brand: 'Tom Ford',
    image: 'https://placehold.co/300x400/150e08/e8b87a?text=Tobacco',
    notes: 'Tobacco Leaf, Vanilla, Tonka Bean, Dry Fruit, Woody Spices',
    season: 'Winter',
    concentration: 'EDP',
    rating: 4,
    description: 'Gourmand and indulgent — this is dessert in a bottle. Incredible in cold weather. Surprisingly wearable despite how sweet it sounds.',
    status: 'Decant',
    volume: '10ml',
  },
  {
    name: 'Flower Bomb',
    brand: 'Viktor & Rolf',
    image: '',
    notes: 'Sambac Jasmine, Rose, Cattleya Orchid, Patchouli, Musk',
    season: 'Fall',
    concentration: 'EDP',
    rating: 3,
    description: 'A gift for my partner that I ended up loving too. The floral bomb opening calms into a soft, musky drydown. Universally liked.',
    status: 'Gifted',
    volume: '50ml',
  },
  {
    name: 'Baccarat Rouge 540',
    brand: 'Maison Francis Kurkdjian',
    image: 'https://placehold.co/300x400/140a08/e87858?text=BR540',
    notes: 'Jasmine, Saffron, Amberwood, Ambergris, Fir Resin',
    season: 'Fall',
    concentration: 'EDP',
    rating: 5,
    description: 'Nothing else smells like this. The combination of floral, woody, and almost metallic sweetness is impossible to describe — you just have to smell it.',
    status: 'Wishlist',
    volume: '70ml',
  },
];
