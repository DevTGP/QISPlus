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

import { CSS_VARS, BORDER_RADIUS }      from '../constants.js';
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
    borderBottom: `1px solid ${CSS_VARS.ROW_BORDER}`,
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
    borderBottom: `1px solid ${CSS_VARS.ROW_BORDER}`,
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
    backgroundColor: CSS_VARS.GROUP_HDR_BG,
    padding:         '5px 10px',
    borderBottom:    `1px solid ${CSS_VARS.ROW_BORDER}`,
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
    color:      CSS_VARS.TEAL,
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
      color:     CSS_VARS.GREY_TEXT,
      fontSize:  '0.82em',
    });
    running.textContent = 'läuft';
    right.append(running);
  }

  if (isCurrentSem) {
    right.append(
      buildBadge('aktuell', CSS_VARS.TEAL, { fontSize: '0.72em', padding: '1px 6px' })
    );
  }

  inner.append(labelEl, right);
  cell.append(inner);
  row.append(cell);

  return row;
}

// ---------------------------------------------------------------------------
// renderPassedGradeCell – passed-row grade cell with click-to-edit "what-if"
// ---------------------------------------------------------------------------

/**
 * Render the contents of the grade cell for a passed module, including the
 * per-module what-if grade UI (click to edit, mini input, reset ×).
 *
 * Visual states:
 *   • Normal:   1.70                 (clickable to open input)
 *   • What-If:  1̶.̶7̶0̶ → 1.00 ×        (original strikethrough + new + reset)
 *   • Improve:  1.70 (1.00)          (when improvement sim active and module is improvable)
 *
 * @param {HTMLTableCellElement} cell
 * @param {import('../stats.js').ModuleInfo & { _isWhatIf?: boolean, _origGrade?: number }} m
 * @param {boolean} withImprovement
 * @param {((name: string, value: number|null, commit: boolean) => void)|null} onWhatIfChange
 */
function renderPassedGradeCell(cell, m, withImprovement, onWhatIfChange) {
  cell.innerHTML = '';

  if (m._isWhatIf) {
    // Original (strikethrough)
    const orig = el('span', {
      color:          CSS_VARS.GREY_TEXT,
      textDecoration: 'line-through',
      fontSize:       '0.85em',
    });
    orig.textContent = fmt(m._origGrade);
    cell.append(orig);

    const arrow = el('span', {
      color:    CSS_VARS.GREY_TEXT,
      fontSize: '0.82em',
      margin:   '0 4px',
    });
    arrow.textContent = '→';
    cell.append(arrow);

    // New (what-if) grade
    const neu = el('span', {
      fontWeight: '700',
      color:      gradeColor(m.passedGrade),
    });
    neu.textContent = fmt(m.passedGrade);
    cell.append(neu);

    if (onWhatIfChange) {
      const x = el('span', {
        marginLeft: '6px',
        color:      CSS_VARS.GREY_TEXT,
        cursor:     'pointer',
        fontSize:   '0.95em',
        fontWeight: '700',
        userSelect: 'none',
      });
      x.textContent = '×';
      x.title = 'Was-wäre-wenn-Note entfernen';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        onWhatIfChange(m.name, null, true);
      });
      cell.append(x);
    }
  } else {
    const gradeSpan = el('span', {
      fontWeight: '600',
      color:      gradeColor(m.passedGrade),
    });
    gradeSpan.textContent = fmt(m.passedGrade);
    cell.append(gradeSpan);

    // Improvement simulation hint
    if (withImprovement && m.improvable) {
      const hint = el('span', {
        color:      CSS_VARS.GREEN,
        fontSize:   '0.8em',
        marginLeft: '4px',
      });
      hint.textContent = '(1.00)';
      cell.append(hint);
    }
  }

  // Click-to-edit (only if a callback was supplied and we have a real grade)
  if (onWhatIfChange) {
    cell.style.cursor = 'pointer';
    cell.title        = m._isWhatIf
      ? 'Klicken um Was-wäre-wenn-Note zu ändern'
      : 'Klicken für Was-wäre-wenn-Note';

    cell.addEventListener('click', (e) => {
      // Ignore clicks on the reset × (it stops propagation, but be defensive)
      if (cell.querySelector('input')) return;
      openWhatIfEditor(cell, m, onWhatIfChange);
    });
  }
}

/**
 * Replace the cell content with a small numeric input for editing the
 * what-if grade. Live updates fire on every keystroke (commit=false);
 * Enter / blur trigger the final commit (commit=true), Esc cancels.
 *
 * @param {HTMLTableCellElement} cell
 * @param {import('../stats.js').ModuleInfo & { _isWhatIf?: boolean, _origGrade?: number }} m
 * @param {(name: string, value: number|null, commit: boolean) => void} onWhatIfChange
 */
function openWhatIfEditor(cell, m, onWhatIfChange) {
  cell.innerHTML = '';

  const inp = document.createElement('input');
  inp.type        = 'number';
  inp.min         = '1.0';
  inp.max         = '4.0';
  inp.step        = '0.1';
  inp.value       = String(m._isWhatIf ? m.passedGrade : m._origGrade ?? m.passedGrade);
  inp.placeholder = 'Note';
  Object.assign(inp.style, {
    width:        '60px',
    padding:      '2px 4px',
    border:       `1px solid ${CSS_VARS.TEAL}`,
    borderRadius: '4px',
    fontSize:     '0.9em',
    fontFamily:   'inherit',
    color:        CSS_VARS.INPUT_FG,
    textAlign:    'center',
    outline:      'none',
    background:   CSS_VARS.INPUT_BG,
  });

  const parseVal = () => {
    const raw = inp.value.replace(',', '.').trim();
    if (raw === '') return null;
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v < 1.0 || v > 4.0) return null;
    return Math.round(v * 100) / 100;
  };

  let cancelled = false;
  let committed = false;

  // Live preview on every input
  inp.addEventListener('input', () => {
    onWhatIfChange(m.name, parseVal(), /*commit*/ false);
  });

  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inp.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelled = true;
      // Restore the prior state: original (no whatIf) or the previously
      // committed whatIf value. A commit=true call ensures full re-render
      // which restores the cell to its non-edit appearance.
      const restore = m._isWhatIf ? m.passedGrade : null;
      committed = true;
      onWhatIfChange(m.name, restore, true);
    }
  });

  inp.addEventListener('blur', () => {
    if (committed) return;
    committed = true;
    if (cancelled) return;
    onWhatIfChange(m.name, parseVal(), /*commit*/ true);
  });

  // Prevent click bubbling from re-opening the editor
  inp.addEventListener('click', (e) => e.stopPropagation());

  cell.append(inp);
  inp.focus();
  inp.select();
}

// ---------------------------------------------------------------------------
// buildModuleRow
// ---------------------------------------------------------------------------

/**
 * Row background colours indexed by type and alternating index.
 */
const ROW_BG = {
  passed:    [CSS_VARS.PASSED_ROW_A,  CSS_VARS.PASSED_ROW_B],
  ongoing:   [CSS_VARS.ONGOING_ROW_A, CSS_VARS.ONGOING_ROW_B],
  improving: [CSS_VARS.IMPROVE_ROW_A, CSS_VARS.IMPROVE_ROW_B],
};

/**
 * Build a module data row.
 *
 * @param {import('../stats.js').ModuleInfo} m
 * @param {number}  rowIndex          Used for alternating row colour
 * @param {boolean} withImprovement   Improvement simulation active?
 * @param {'passed'|'ongoing'|'improving'} rowType  Determines styling and
 *                                        which semester to show (passedSem /
 *                                        improvementSem / ongoingSem).
 * @param {string}  sortCol           Current sort column (kept for callers,
 *                                        currently unused inside this fn)
 * @param {Object}  [opts]
 * @param {(name: string, value: number|null, commit: boolean) => void} [opts.onWhatIfChange]
 *        Callback invoked when the user edits a hypothetical grade. `value`
 *        is `null` to clear. `commit` distinguishes live preview (false,
 *        stats-only update) from final commit (true, full re-render).
 * @returns {HTMLTableRowElement}
 */
export function buildModuleRow(m, rowIndex, withImprovement, rowType, sortCol, opts = {}) {
  const { onWhatIfChange = null } = opts;
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
    color:     rowType === 'ongoing' ? CSS_VARS.GREY_TEXT : CSS_VARS.WIDGET_FG,
  });
  nameSpan.textContent = m.name;
  nameCell.append(nameSpan);

  // Badges appended after the name
  if (rowType === 'ongoing') {
    nameCell.append('\u00a0'); // nbsp
    nameCell.append(
      buildBadge('angemeldet', CSS_VARS.TEAL, { fontSize: '0.72em' })
    );
  }

  if (rowType === 'improving' && m.improvementSem) {
    nameCell.append('\u00a0');
    nameCell.append(
      buildBadge(
        `✎&thinsp;Verbesserung&thinsp;${m.improvementSem}`,
        CSS_VARS.IMPROVING_BADGE_BG,
        { fontSize: '0.72em', color: CSS_VARS.IMPROVING_BADGE_FG }
      )
    );
  }

  // ------------------------------------------------------------------
  // Grade cell
  // ------------------------------------------------------------------
  const gradeCell = tdEl({ textAlign: 'center', fontVariantNumeric: 'tabular-nums' });

  if (rowType === 'passed') {
    if (m.passedGrade !== null) {
      renderPassedGradeCell(gradeCell, m, withImprovement, onWhatIfChange);
    }
  } else if (rowType === 'improving') {
    // Show current grade → ? (or "1.00" assumption when simulation is on)
    if (m.passedGrade !== null) {
      const cur = el('span', {
        fontWeight: '600',
        color:      gradeColor(m.passedGrade),
      });
      cur.textContent = fmt(m.passedGrade);
      gradeCell.append(cur);

      const arrow = el('span', {
        color:     CSS_VARS.GREY_TEXT,
        fontSize:  '0.82em',
        margin:    '0 3px',
      });
      arrow.textContent = ' →';
      gradeCell.append(arrow);

      // When the simulation is on, the calculation treats this module as
      // 1.0 – mirror that visually so the row matches what the global stats
      // are doing. Otherwise stay agnostic with a "?".
      if (withImprovement && m.improvable) {
        const sim = el('span', {
          fontWeight: '600',
          color:      CSS_VARS.GREEN,
          fontSize:   '0.9em',
        });
        sim.textContent = ' 1.00';
        gradeCell.append(sim);
      } else {
        const placeholder = el('span', {
          color:    CSS_VARS.GREY_TEXT,
          fontSize: '0.82em',
        });
        placeholder.textContent = ' ?';
        gradeCell.append(placeholder);
      }
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
    { textAlign: 'center', color: CSS_VARS.GREY_TEXT }
  );

  // ------------------------------------------------------------------
  // Semester cell  (always visible – also in group mode, so the
  // semester is identifiable per row even when scanning the table
  // outside of the group header context).
  //
  // The semester to show depends on the row's role:
  //   • passed    → semester of the passing attempt (m.passedSem)
  //   • improving → semester where the PNV is registered (m.improvementSem)
  //   • ongoing   → semester where the first-try AN is registered (m.ongoingSem)
  // ------------------------------------------------------------------
  const displaySem =
    rowType === 'improving' ? (m.improvementSem ?? m.passedSem) :
    rowType === 'ongoing'   ? m.ongoingSem :
    m.passedSem;

  const semCell = tdEl({ textAlign: 'center' });
  const semSpan = el('span', { fontSize: '0.82em', color: CSS_VARS.GREY_TEXT });
  semSpan.textContent = displaySem ?? '–';
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
  const bg  = rowIndex % 2 === 0 ? CSS_VARS.HIST_ROW_A : CSS_VARS.HIST_ROW_B;
  const row = document.createElement('tr');
  row.style.backgroundColor = bg;

  // Name cell – italic, muted
  const nameCell = tdEl({ textAlign: 'left' });
  const nameSpan = el('span', {
    fontStyle: 'italic',
    color:     CSS_VARS.GREY_TEXT,
    fontSize:  '0.9em',
  });
  nameSpan.textContent = h.moduleName;
  nameCell.append(nameSpan, '\u00a0');

  // Reason badge
  const badgeColor = (h.status === 'NB' || h.status === 'EN')
    ? CSS_VARS.RED
    : CSS_VARS.ORANGE;
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
    color:     CSS_VARS.GREY_TEXT,
    fontSize:  '0.85em',
  });

  // Semester
  const semCell = tdEl({ textAlign: 'center' });
  const semSpan = el('span', { fontSize: '0.82em', color: CSS_VARS.GREY_TEXT });
  semSpan.textContent = h.semester;
  semCell.append(semSpan);

  row.append(nameCell, gradeCell, ectsCell, semCell);
  return row;
}
