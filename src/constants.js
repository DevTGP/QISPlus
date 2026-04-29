'use strict';

// ---------------------------------------------------------------------------
// QISPlus – shared constants
// Import this module wherever colour values, storage keys, or layout constants
// are needed to avoid magic strings / numbers scattered across the codebase.
// ---------------------------------------------------------------------------

/** Total ECTS credits required for the degree. Adjust if your programme differs. */
export const TOTAL_ECTS = 180;

/** DOM id of the injected widget element. */
export const WIDGET_ID = 'qisplus-widget';

// ---------------------------------------------------------------------------
// chrome.storage.local keys
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = /** @type {const} */ ({
  ENABLED:  'qisplus_enabled',
  IMPROVE:  'qisplus_improve',
  HISTORY:  'qisplus_history',
});

// ---------------------------------------------------------------------------
// Brand / UI colours (all inline styles reference these)
// ---------------------------------------------------------------------------
export const COLORS = /** @type {const} */ ({
  // Brand palette
  ORANGE:         '#ca5116',
  ORANGE_HOVER:   '#a33e0f',
  TEAL:           '#115E67',
  TEAL_LIGHT:     '#1a8a96',
  GREEN:          '#298836',
  RED:            '#A50034',

  // Widget chrome
  WIDGET_BG:      '#f7fbff',
  WIDGET_BORDER:  '#ca5116',

  // Table / rows
  ROW_BORDER:     '#dee2eb',
  GROUP_HDR_BG:   '#dce8f5',

  // Passed rows (alternating white / light-blue)
  PASSED_ROW_A:   '#ffffff',
  PASSED_ROW_B:   '#eef4fb',

  // Ongoing rows (greyed, italic)
  ONGOING_ROW_A:  '#fafafa',
  ONGOING_ROW_B:  '#f3f3f3',

  // Improving rows (yellow tint)
  IMPROVE_ROW_A:  '#fffbea',
  IMPROVE_ROW_B:  '#fff8d6',

  // Historical rows (orange tint)
  HIST_ROW_A:     '#fff8f0',
  HIST_ROW_B:     '#fff2e5',

  // Misc
  GREY_TEXT:      '#6b7280',
  WHITE:          '#ffffff',
});

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
export const BORDER_RADIUS = '6px';
export const WIDGET_FONT   = 'sans-serif';
export const WIDGET_FONT_SIZE = '14px';

// ---------------------------------------------------------------------------
// Table column definitions  (used by buildTable + sorting logic)
// ---------------------------------------------------------------------------
export const COLUMNS = /** @type {const} */ ([
  { key: 'name',     label: 'Modul',    align: 'left',   width: '40%' },
  { key: 'grade',    label: 'Note',     align: 'center', width: '12%' },
  { key: 'ects',     label: 'ECTS',     align: 'center', width: '8%'  },
  { key: 'semester', label: 'Semester', align: 'center', width: '16%' },
]);

// ---------------------------------------------------------------------------
// QIS CSS class names we rely on for parsing
// ---------------------------------------------------------------------------
export const QIS_CLASSES = /** @type {const} */ ({
  KONTO:       'qis_konto',
  KONTO_TOP:   'qis_kontoOnTop',
  DETAIL_ROW:  'ns_tabelle1_alignleft',
});

// ---------------------------------------------------------------------------
// Column indices within a detail row  (ns_tabelle1_alignleft)
// ---------------------------------------------------------------------------
export const COL = /** @type {const} */ ({
  PRUEF_NR:  0,
  TEXT:      1,
  SEMESTER:  2,
  NOTE:      3,
  STATUS:    4,
  ECTS:      5,
  VERMERK:   6,
  FREIV:     7,
  VERSUCH:   8,
  DATUM:     9,
});
