'use strict';

// ---------------------------------------------------------------------------
// QISPlus – table row builders
//
// Three exported functions, one per row type:
//   buildGroupHeader(semLabel, semStats, isCurrentSem) → <tr>
//   buildModuleRow(m, rowIndex, withImprovement, rowType, sortCol) → <tr>
//   buildHistoricalRow(h, rowIndex) → <tr>
//
// No state, no event listeners – pure DOM construction.
// ---------------------------------------------------------------------------

import { COLORS, BORDER_RADIUS }        from '../constants.js';
import { el, fmt, gradeColor }           from './core.js';
import { buildBadge }                    from './progress.js';

// ---------------------------------------------------------------------------
// Shared row helpers
// ---------------------------------------------------------------------------

/**
 * Create a plain <td> with common base styles.
 *
 * @param {string} text
 * @param {Partial<CSSStyleDeclaration>} [styles]
 * @returns {HTMLTableCellElement}
 */
function td(text, styles = {}) {
  const cell = /** @type {HTMLTableCellElement} */ (
    document.createElement('td')
  );
  Object.assign(cell.style, {
    padding:     '6px 10px',
    borderBottom: `1px solid ${COLORS.ROW_BORDER}`,
    verticalAlign: 'middle',
    ...styles,
  });
  cell.textContent = text;
  return cell;
}

/**
 * Create a <td> that accepts arbitrary child nodes.
 *
 * @param {Partial<CSSStyleDeclaration>} [styles]
 * @returns {HTMLTableCellElement}
 */
function tdEl(styles = {}) {
  const cell = /** @type {HTMLTableCellElement} */ (
    document.createElement('td')
  );
  Object.assign(cell.style, {
    padding:      '6px 10px',
    borderBottom: `1px solid ${COLORS.ROW_BORDER}`,
    verticalAlign: 'middle',
    ...styles,
  });
  return cell;
}

// ---------------------------------------------------------------------------
// buildGroupHeader
// ---------------------------------------------------------------------------

/**
 * Build the semester group header row – a full-width <tr> with a single
 * <td colspan=4>.
 *
 *   [bold semLabel (teal)]          [Ø X.XX · Y ECTS pill]  [aktuell pill?]
 *   If no semStats (ongoing-only):  italic grey "läuft"
 *
 * @param {string}                          semLabel
 * @param {{ avg: number, ects: number }|null} semStats   null = ongoing-only
 * @param {boolean}                         isCurrentSem
 * @returns {HTMLTableRowElement}
 */
export function buildGroupHeader(semLabel, semStats, isCurrentSem) {
  const row = document.createElement('tr');

  const cell = /** @type {HTMLTableCellElement} */ (
    document.createElement('td')
  );
  cell.colSpan = 4;
  Object.assign(cell.style, {
    backgroundColor: COLORS.GROUP_HDR_BG,
    padding:         '5px 10px',
    borderBottom:    `1px solid ${COLORS.ROW_BORDER}`,
  });

  // Flex layout: label left, stats right
  const inner = el('div', {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
  });

  // --- Left: semester label -------------------------------------------
  const labelEl = el('span', {
    fontWeight: '700',
    color:      COLORS.TEAL,
    fontSize:   '0.88em',
  });
  labelEl.textContent = semLabel;

  // --- Right: stats pill or "läuft" -----------------------------------
  const right = el('span', { display: 'flex', alignItems: 'center', gap: '6px' });

  if (semStats) {
    const pill = buildBadge(
      `Ø&thinsp;${fmt(semStats.avg)}&ensp;·&ensp;${semStats.ects}&thinsp;ECTS`,
      gradeColor(semStats.avg),
      { fontSize: '0.76em' }
    );
    right.append(pill);
  } else {
    const running = el('span', {
      fontStyle: 'italic',
      color:     COLORS.GREY_TEXT,
      fontSize:  '0.82em',
    });
    running.textContent = 'läuft';
    right.append(running);
  }

  if (isCurrentSem) {
    right.append(
      buildBadge('aktuell', COLORS.TEAL, { fontSize: '0.72em', padding: '1px 6px' })
    );
  }

  inner.append(labelEl, right);
  cell.append(inner);
  row.append(cell);

  return row;
}

// ---------------------------------------------------------------------------
// buildModuleRow
// ---------------------------------------------------------------------------

/**
 * Row background colours indexed by type and alternating index.
 */
const ROW_BG = {
  passed:    [COLORS.PASSED_ROW_A,  COLORS.PASSED_ROW_B],
  ongoing:   [COLORS.ONGOING_ROW_A, COLORS.ONGOING_ROW_B],
  improving: [COLORS.IMPROVE_ROW_A, COLORS.IMPROVE_ROW_B],
};

/**
 * Build a module data row.
 *
 * @param {import('../stats.js').ModuleInfo} m
 * @param {number}  rowIndex          Used for alternating row colour
 * @param {boolean} withImprovement   Improvement simulation active?
 * @param {'passed'|'ongoing'|'improving'} rowType
 * @param {string}  sortCol           Current sort column ('group' hides Semester)
 * @returns {HTMLTableRowElement}
 */
export function buildModuleRow(m, rowIndex, withImprovement, rowType, sortCol) {
  const row = document.createElement('tr');
  const bg  = ROW_BG[rowType][rowIndex % 2];

  Object.assign(row.style, {
    backgroundColor: bg,
    opacity:         rowType === 'ongoing' ? '0.72' : '1',
  });

  // ------------------------------------------------------------------
  // Name cell
  // ------------------------------------------------------------------
  const nameCell = tdEl({ textAlign: 'left' });

  const nameSpan = el('span', {
    fontStyle: rowType === 'ongoing' ? 'italic' : 'normal',
    color:     rowType === 'ongoing' ? COLORS.GREY_TEXT : 'inherit',
  });
  nameSpan.textContent = m.name;
  nameCell.append(nameSpan);

  // Badges appended after the name
  if (rowType === 'ongoing') {
    nameCell.append('\u00a0'); // nbsp
    nameCell.append(
      buildBadge('angemeldet', COLORS.TEAL, { fontSize: '0.72em' })
    );
  }

  if (rowType === 'improving' && m.improvementSem) {
    nameCell.append('\u00a0');
    nameCell.append(
      buildBadge(
        `✎&thinsp;Verbesserung&thinsp;${m.improvementSem}`,
        '#b8860b',
        { fontSize: '0.72em', backgroundColor: '#c9a227' }
      )
    );
  }

  // ------------------------------------------------------------------
  // Grade cell
  // ------------------------------------------------------------------
  const gradeCell = tdEl({ textAlign: 'center', fontVariantNumeric: 'tabular-nums' });

  if (rowType === 'passed') {
    if (m.passedGrade !== null) {
      const gradeSpan = el('span', {
        fontWeight: '600',
        color:      gradeColor(m.passedGrade),
      });
      gradeSpan.textContent = fmt(m.passedGrade);
      gradeCell.append(gradeSpan);

      // Improvement simulation hint
      if (withImprovement && m.improvable) {
        const hint = el('span', {
          color:     COLORS.GREEN,
          fontSize:  '0.8em',
          marginLeft: '4px',
        });
        hint.textContent = '(1.00)';
        gradeCell.append(hint);
      }
    }
  } else if (rowType === 'improving') {
    // Show current grade → ? (or new grade if improvement already graded)
    if (m.passedGrade !== null) {
      const cur = el('span', {
        fontWeight: '600',
        color:      gradeColor(m.passedGrade),
      });
      cur.textContent = fmt(m.passedGrade);
      gradeCell.append(cur);

      const arrow = el('span', {
        color:     COLORS.GREY_TEXT,
        fontSize:  '0.82em',
        margin:    '0 3px',
      });
      arrow.textContent = ' →';
      gradeCell.append(arrow);

      // If a new BE grade in currentSem is already recorded, show it;
      // otherwise show "?"
      const newGradeSpan = el('span', { color: COLORS.GREY_TEXT, fontSize: '0.82em' });
      newGradeSpan.textContent = ' ?';
      gradeCell.append(newGradeSpan);
    }
  } else {
    // ongoing
    gradeCell.textContent = '–';
  }

  // ------------------------------------------------------------------
  // ECTS cell
  // ------------------------------------------------------------------
  const ectsCell = td(
    rowType === 'passed' ? String(m.ects) : '–',
    { textAlign: 'center', color: COLORS.GREY_TEXT }
  );

  // ------------------------------------------------------------------
  // Semester cell  (hidden when grouping by semester)
  // ------------------------------------------------------------------
  const semCell = tdEl({
    textAlign: 'center',
    display:   sortCol === 'group' ? 'none' : 'table-cell',
  });
  const semSpan = el('span', { fontSize: '0.82em', color: COLORS.GREY_TEXT });
  semSpan.textContent = m.passedSem ?? '–';
  semCell.append(semSpan);

  row.append(nameCell, gradeCell, ectsCell, semCell);
  return row;
}

// ---------------------------------------------------------------------------
// buildHistoricalRow
// ---------------------------------------------------------------------------

/**
 * Build a historical (failed / withdrawn) attempt row.
 *
 * @param {import('../stats.js').HistEntry} h
 * @param {number} rowIndex
 * @returns {HTMLTableRowElement}
 */
export function buildHistoricalRow(h, rowIndex) {
  const bg  = rowIndex % 2 === 0 ? COLORS.HIST_ROW_A : COLORS.HIST_ROW_B;
  const row = document.createElement('tr');
  row.style.backgroundColor = bg;

  // Name cell – italic, muted
  const nameCell = tdEl({ textAlign: 'left' });
  const nameSpan = el('span', {
    fontStyle: 'italic',
    color:     COLORS.GREY_TEXT,
    fontSize:  '0.9em',
  });
  nameSpan.textContent = h.moduleName;
  nameCell.append(nameSpan, '\u00a0');

  // Reason badge
  const badgeColor = (h.status === 'NB' || h.status === 'EN')
    ? COLORS.RED
    : COLORS.ORANGE;
  nameCell.append(
    buildBadge(h.reasonLabel, badgeColor, { fontSize: '0.70em' })
  );

  // Grade cell
  const gradeCell = tdEl({ textAlign: 'center', fontVariantNumeric: 'tabular-nums' });
  if (h.grade !== null) {
    const s = el('span', {
      fontWeight: '500',
      color:      gradeColor(h.grade),
      fontSize:   '0.9em',
    });
    s.textContent = fmt(h.grade);
    gradeCell.append(s);
  } else {
    gradeCell.textContent = '–';
  }

  // ECTS (always 0 for historical rows)
  const ectsCell = td('0', {
    textAlign: 'center',
    color:     COLORS.GREY_TEXT,
    fontSize:  '0.85em',
  });

  // Semester
  const semCell = tdEl({ textAlign: 'center' });
  const semSpan = el('span', { fontSize: '0.82em', color: COLORS.GREY_TEXT });
  semSpan.textContent = h.semester;
  semCell.append(semSpan);

  row.append(nameCell, gradeCell, ectsCell, semCell);
  return row;
}
