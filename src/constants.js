'use strict';

// ---------------------------------------------------------------------------
// QISPlus – shared constants
// Import this module wherever colour values, storage keys, or layout constants
// are needed to avoid magic strings / numbers scattered across the codebase.
// ---------------------------------------------------------------------------

/** Default total ECTS credits required for the degree. Configurable via the popup. */
export const DEFAULT_TOTAL_ECTS = 180;

/** DOM id of the injected widget element. */
export const WIDGET_ID = 'qisplus-widget';

// ---------------------------------------------------------------------------
// chrome.storage.local keys
// ---------------------------------------------------------------------------
export const STORAGE_KEYS = /** @type {const} */ ({
  ENABLED:       'qisplus_enabled',
  IMPROVE:       'qisplus_improve',
  HISTORY:       'qisplus_history',
  UPDATE_CACHE:  'qisplus_update_cache',
  TOTAL_ECTS:    'qisplus_total_ects',
  THEME:         'qisplus_theme',
});

// ---------------------------------------------------------------------------
// Theme modes – 'auto' follows the OS prefers-color-scheme; 'light' / 'dark'
// force the respective theme regardless of OS settings.
// ---------------------------------------------------------------------------
export const THEMES = /** @type {const} */ ({
  AUTO:  'auto',
  LIGHT: 'light',
  DARK:  'dark',
});

export const DEFAULT_THEME = THEMES.AUTO;

// ---------------------------------------------------------------------------
// GitHub release source – used by src/update.js to check for new versions.
// Keep these in one place so a future fork only has to change a single line.
// ---------------------------------------------------------------------------
export const GITHUB = /** @type {const} */ ({
  OWNER:        'DevTGP',
  REPO:         'QISPlus',
  RELEASES_URL: 'https://github.com/DevTGP/QISPlus/releases',
  API_LATEST:   'https://api.github.com/repos/DevTGP/QISPlus/releases/latest',
  API_TAGS:     'https://api.github.com/repos/DevTGP/QISPlus/tags',
});

/** Update-check cache TTL in milliseconds (6 hours). */
export const UPDATE_TTL_MS = 6 * 60 * 60 * 1000;

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
// CSS custom-property references
//
// Inline styles in the render layer use these instead of the raw COLORS hex
// values. The actual colour values live in src/render/theme.js, which injects
// a single <style> block with both the light defaults and the dark overrides.
// COLORS above is still used for non-CSS contexts (service-worker badge,
// fallbacks) where a real hex string is required.
// ---------------------------------------------------------------------------
export const CSS_VARS = /** @type {const} */ ({
  // Brand palette
  ORANGE:         'var(--qp-orange)',
  ORANGE_HOVER:   'var(--qp-orange-hover)',
  TEAL:           'var(--qp-teal)',
  TEAL_LIGHT:     'var(--qp-teal-light)',
  GREEN:          'var(--qp-green)',
  RED:            'var(--qp-red)',

  // Widget chrome
  WIDGET_BG:      'var(--qp-widget-bg)',
  WIDGET_BORDER:  'var(--qp-widget-border)',
  WIDGET_FG:      'var(--qp-fg)',
  WIDGET_SHADOW:  'var(--qp-shadow)',

  // Surfaces
  SURFACE:        'var(--qp-surface)',
  ON_ACCENT:      'var(--qp-on-accent)',

  // Table / rows
  ROW_BORDER:     'var(--qp-row-border)',
  GROUP_HDR_BG:   'var(--qp-group-hdr-bg)',
  HEADER_DIVIDER: 'var(--qp-header-divider)',

  PASSED_ROW_A:   'var(--qp-passed-row-a)',
  PASSED_ROW_B:   'var(--qp-passed-row-b)',
  ONGOING_ROW_A:  'var(--qp-ongoing-row-a)',
  ONGOING_ROW_B:  'var(--qp-ongoing-row-b)',
  IMPROVE_ROW_A:  'var(--qp-improve-row-a)',
  IMPROVE_ROW_B:  'var(--qp-improve-row-b)',
  HIST_ROW_A:     'var(--qp-hist-row-a)',
  HIST_ROW_B:     'var(--qp-hist-row-b)',

  // Progress bar
  PROGRESS_TRACK:    'var(--qp-progress-track)',
  PROGRESS_BG:       'var(--qp-progress-bg)',
  PROGRESS_LABEL:    'var(--qp-progress-label)',
  PROGRESS_GRAD_A:   'var(--qp-progress-grad-a)',
  PROGRESS_GRAD_B:   'var(--qp-progress-grad-b)',

  // Reverse calculator box
  REVERSE_BG:       'var(--qp-reverse-bg)',
  REVERSE_BORDER:   'var(--qp-reverse-border)',

  // Improve bar
  IMPROVE_BAR_BG:     'var(--qp-improve-bar-bg)',
  IMPROVE_BAR_BORDER: 'var(--qp-improve-bar-border)',
  IMPROVE_BAR_TEXT:   'var(--qp-improve-bar-text)',

  // Toggle switch
  TOGGLE_OFF:        'var(--qp-toggle-off)',

  // Inputs
  INPUT_BG:          'var(--qp-input-bg)',
  INPUT_FG:          'var(--qp-input-fg)',

  // Grade-bracket colours (replaces gradeColor() hex returns)
  GRADE_GOOD:        'var(--qp-grade-good)',   // ≤ 1.5
  GRADE_OK:          'var(--qp-grade-ok)',     // ≤ 2.5
  GRADE_WARN:        'var(--qp-grade-warn)',   // ≤ 3.5
  GRADE_BAD:         'var(--qp-grade-bad)',    // > 3.5

  // Improvement badge (✎ Verbesserung)
  IMPROVING_BADGE_BG: 'var(--qp-improving-badge-bg)',
  IMPROVING_BADGE_FG: 'var(--qp-improving-badge-fg)',

  // Misc
  GREY_TEXT:      'var(--qp-grey-text)',
  WHITE:          'var(--qp-on-accent)',  // legacy alias for badge text colour
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
