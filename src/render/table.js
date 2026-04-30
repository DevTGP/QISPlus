'use strict';

// ---------------------------------------------------------------------------
// QISPlus – sortable table skeleton builder
//
// buildTable() creates the <table> + <thead> with clickable sort headers.
// It does NOT populate <tbody> rows – that is done by widget.js's render()
// loop so rows can be rebuilt on every state change without recreating the
// whole table structure.
// ---------------------------------------------------------------------------

import { CSS_VARS, COLUMNS, BORDER_RADIUS } from '../constants.js';
import { el }                                from './core.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the sort-indicator character for the given column.
 *
 * @param {string} colKey
 * @param {string} sortCol  Currently active sort column
 * @param {number} sortDir  1 = asc, -1 = desc
 * @returns {string}
 */
function sortIndicator(colKey, sortCol, sortDir) {
  if (colKey !== sortCol) return '';
  return sortDir === 1 ? ' ↑' : ' ↓';
}

/**
 * Tooltip text for the semester column header (cycles through three states).
 *
 * @param {string} sortCol
 * @returns {string}
 */
function semesterTooltip(sortCol) {
  if (sortCol !== 'semester') return 'Sortieren nach Semester (aufsteigend)';
  return 'Klicken um Sortierung zu wechseln (Semestergruppe → asc → desc)';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {{ table: HTMLTableElement, tbody: HTMLTableSectionElement }} TableResult
 */

/**
 * Build a sortable <table> element with a styled <thead>.
 *
 * The <tbody> is returned separately so the caller can fill / replace rows
 * without touching the header.
 *
 * Column cycle for "Semester":
 *   group → sem↑ → sem↓ → group (handled in widget.js's onHeaderClick)
 *
 * @param {string}   sortCol        Active sort column key
 * @param {number}   sortDir        1 = asc, -1 = desc
 * @param {(key: string) => void} onHeaderClick  Called with the column key on click
 * @returns {TableResult}
 */
export function buildTable(sortCol, sortDir, onHeaderClick) {
  const table = /** @type {HTMLTableElement} */ (el('table', {
    width:          '100%',
    borderCollapse: 'collapse',
    fontSize:       '13px',
    fontFamily:     'sans-serif',
  }));

  // --- <thead> --------------------------------------------------------
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  for (const col of COLUMNS) {
    const isActive = col.key === sortCol;

    const th = /** @type {HTMLTableCellElement} */ (
      document.createElement('th')
    );

    Object.assign(th.style, {
      padding:         '7px 10px',
      textAlign:       col.align,
      width:           col.width,
      backgroundColor: isActive ? CSS_VARS.ORANGE_HOVER : CSS_VARS.ORANGE,
      color:           CSS_VARS.ON_ACCENT,
      fontWeight:      '600',
      fontSize:        '0.82em',
      letterSpacing:   '0.03em',
      cursor:          'pointer',
      userSelect:      'none',
      whiteSpace:      'nowrap',
      borderRight:     `1px solid ${CSS_VARS.HEADER_DIVIDER}`,
      transition:      'background-color 0.15s',
    });

    // Label + sort arrow
    th.textContent = col.label + sortIndicator(col.key, sortCol, sortDir);

    if (col.key === 'semester') {
      th.title = semesterTooltip(sortCol);
    }

    // Hover effect
    th.addEventListener('mouseenter', () => {
      th.style.backgroundColor = CSS_VARS.ORANGE_HOVER;
    });
    th.addEventListener('mouseleave', () => {
      th.style.backgroundColor = isActive ? CSS_VARS.ORANGE_HOVER : CSS_VARS.ORANGE;
    });

    // Click → delegate to caller
    th.addEventListener('click', () => onHeaderClick(col.key));

    headerRow.append(th);
  }

  thead.append(headerRow);
  table.append(thead);

  // --- <tbody> (empty – caller fills it) ------------------------------
  const tbody = document.createElement('tbody');
  table.append(tbody);

  return { table, tbody };
}
