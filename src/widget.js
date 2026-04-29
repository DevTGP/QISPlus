'use strict';

// ---------------------------------------------------------------------------
// QISPlus – widget orchestrator
//
// buildWidget(parseResult) → HTMLElement
//
// Owns all mutable UI state (sortCol, sortDir, improve, showHistory).
// On every state change it calls render() which rebuilds the table body and
// updates the stats displays in-place – no full DOM replacement.
// ---------------------------------------------------------------------------

import { WIDGET_ID, STORAGE_KEYS, COLORS, TOTAL_ECTS, BORDER_RADIUS } from './constants.js';
import {
  buildModuleMap,
  buildSemesterGroups,
  calcGlobalStats,
  calcSemStats,
} from './stats.js';
import {
  el,
  fmt,
  gradeColor,
  buildProgressBar,
  buildStatBadges,
  buildTable,
  buildGroupHeader,
  buildModuleRow,
  buildHistoricalRow,
} from './render/index.js';
import { getBool, setBool } from './storage.js';

// ---------------------------------------------------------------------------
// markImprovable – tag the most-recently-passed non-improving modules
// ---------------------------------------------------------------------------

/**
 * Find the highest passedSemNum among modules that are neither improving nor
 * ongoing, then set m.improvable = true on every module in that semester.
 * Returns the semester label of the "improvable" semester (for the improve bar).
 *
 * @param {import('./stats.js').SemesterGroup[]} groups
 * @returns {string}  semLabel of the improvable semester, or ''
 */
function markImprovable(groups) {
  let maxSemNum = -Infinity;
  let maxLabel  = '';

  for (const g of groups) {
    for (const m of g.passed) {
      if (m.isImproving || m.isOngoing) continue;
      if (m.passedSemNum > maxSemNum) {
        maxSemNum = m.passedSemNum;
        maxLabel  = m.passedSem ?? '';
      }
    }
  }

  if (maxSemNum === -Infinity) return '';

  for (const g of groups) {
    for (const m of g.passed) {
      m.improvable = m.passedSemNum === maxSemNum && !m.isImproving && !m.isOngoing;
    }
  }

  return maxLabel;
}

// ---------------------------------------------------------------------------
// sortRows – flat array sorter for non-group modes
// ---------------------------------------------------------------------------

/**
 * Sort a flat list of ModuleInfo by the active sort key.
 *
 * @param {import('./stats.js').ModuleInfo[]} modules
 * @param {string} sortCol
 * @param {number} sortDir  1 = asc, -1 = desc
 * @returns {import('./stats.js').ModuleInfo[]}
 */
function sortModules(modules, sortCol, sortDir) {
  return [...modules].sort((a, b) => {
    let cmp = 0;
    switch (sortCol) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'grade':
        cmp = (a.passedGrade ?? Infinity) - (b.passedGrade ?? Infinity);
        break;
      case 'ects':
        cmp = a.ects - b.ects;
        break;
      case 'semester':
        cmp = (a.passedSemNum ?? 0) - (b.passedSemNum ?? 0);
        break;
      default:
        cmp = 0;
    }
    return cmp * sortDir;
  });
}

// ---------------------------------------------------------------------------
// buildWidget
// ---------------------------------------------------------------------------

/**
 * Build and return the full QISPlus widget element.
 * All sub-elements are created once; render() updates them in place.
 *
 * @param {import('./parser.js').ParseResult} parseResult
 * @returns {HTMLElement}
 */
export function buildWidget(parseResult) {
  const { attempts, currentSem, currentSemNum } = parseResult;

  // ------------------------------------------------------------------
  // Mutable UI state
  // ------------------------------------------------------------------
  let sortCol     = 'group';   // 'group'|'name'|'grade'|'ects'|'semester'
  let sortDir     = 1;         // 1 = asc, -1 = desc
  let improve     = false;
  let showHistory = false;

  // ------------------------------------------------------------------
  // Build the stable module map (does not change with UI state)
  // ------------------------------------------------------------------
  const moduleMap = buildModuleMap(attempts, currentSem, currentSemNum);

  // ------------------------------------------------------------------
  // Widget shell
  // ------------------------------------------------------------------
  const widget = el('div', {
    id:           WIDGET_ID,
    background:   COLORS.WIDGET_BG,
    border:       `2px solid ${COLORS.WIDGET_BORDER}`,
    borderRadius: BORDER_RADIUS,
    padding:      '14px 16px',
    margin:       '16px 0',
    fontFamily:   'sans-serif',
    fontSize:     '14px',
    lineHeight:   '1.5',
    boxShadow:    '0 2px 8px rgba(0,0,0,0.07)',
  });
  widget.id = WIDGET_ID;

  // --- Title -----------------------------------------------------------
  const title = el('div', {
    fontWeight:   '700',
    fontSize:     '1.05em',
    color:        COLORS.TEAL,
    marginBottom: '10px',
    display:      'flex',
    alignItems:   'center',
    gap:          '6px',
  });
  title.textContent = '📊 QISPlus – Notenübersicht';

  // --- Progress bar placeholder (replaced each render) ---------------
  const progressBox = el('div', {});

  // --- Stat badges placeholder ----------------------------------------
  const badgesBox = el('div', {});

  // --- Improve bar ----------------------------------------------------
  const improveBar = buildImproveBar();

  // --- Control bar ----------------------------------------------------
  const ctrlBar = buildCtrlBar();

  // --- Table box (replaced each render) --------------------------------
  const tableBox = el('div', { marginTop: '8px', overflowX: 'auto' });

  // --- Best achievable box ---------------------------------------------
  const bestBox = el('div', {
    marginTop:  '8px',
    fontSize:   '0.82em',
    color:      COLORS.GREY_TEXT,
    fontStyle:  'italic',
    textAlign:  'right',
  });

  widget.append(title, progressBox, badgesBox, improveBar, ctrlBar, tableBox, bestBox);

  // ------------------------------------------------------------------
  // Restore persisted toggle states
  // ------------------------------------------------------------------
  Promise.all([
    getBool(STORAGE_KEYS.IMPROVE,  false),
    getBool(STORAGE_KEYS.HISTORY,  false),
  ]).then(([imp, hist]) => {
    improve     = imp;
    showHistory = hist;
    syncImproveToggle();
    render();
  });

  // Run an initial render immediately (with default state) so the
  // widget is visible before storage resolves.
  render();

  // ------------------------------------------------------------------
  // render()
  // ------------------------------------------------------------------
  function render() {
    const groups  = buildSemesterGroups(attempts, moduleMap, currentSemNum, showHistory);
    const impSem  = markImprovable(groups);
    const gStats  = calcGlobalStats(groups, improve, currentSemNum);

    // Update progress bar
    progressBox.innerHTML = '';
    progressBox.append(buildProgressBar(gStats.earnedEcts, gStats.remaining));

    // Update badges
    badgesBox.innerHTML = '';
    badgesBox.append(buildStatBadges(gStats.currentAvg, gStats.earnedEcts));

    // Update improve-bar subtitle
    const subtitle = widget.querySelector('#qp-imp-subtitle');
    if (subtitle) {
      subtitle.textContent = impSem
        ? `Letzte abgeschlossene Semester: ${impSem}`
        : 'Keine verbesserbaren Module gefunden';
    }

    // Update control bar button states
    updateCtrlBar();

    // Rebuild table
    tableBox.innerHTML = '';
    const { table, tbody } = buildTable(sortCol, sortDir, onHeaderClick);

    if (sortCol === 'group') {
      renderGrouped(tbody, groups);
    } else {
      renderFlat(tbody, groups);
    }

    tableBox.append(table);

    // Best achievable
    bestBox.textContent = gStats.currentAvg !== null
      ? `Bestmöglicher Schnitt (alle restlichen Module 1,0): ${fmt(gStats.bestAchievable)}`
      : '';
  }

  // ------------------------------------------------------------------
  // renderGrouped – insert rows grouped by semester
  // ------------------------------------------------------------------
  function renderGrouped(tbody, groups) {
    let passedIdx    = 0;
    let ongoingIdx   = 0;
    let improvingIdx = 0;
    let histIdx      = 0;

    for (const g of groups) {
      const hasContent =
        g.passed.length || g.ongoing.length || g.improving.length ||
        (showHistory && g.historical.length);
      if (!hasContent) continue;

      const semStats    = calcSemStats(g.passed);
      const isCurrent   = g.semNum === currentSemNum;

      tbody.append(buildGroupHeader(g.semLabel, semStats, isCurrent));

      for (const m of g.passed) {
        tbody.append(buildModuleRow(m, passedIdx++, improve, 'passed', sortCol));
      }
      for (const m of g.improving) {
        tbody.append(buildModuleRow(m, improvingIdx++, improve, 'improving', sortCol));
      }
      for (const m of g.ongoing) {
        tbody.append(buildModuleRow(m, ongoingIdx++, improve, 'ongoing', sortCol));
      }
      if (showHistory) {
        for (const h of g.historical) {
          tbody.append(buildHistoricalRow(h, histIdx++));
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // renderFlat – all passed modules in one flat sorted list
  // ------------------------------------------------------------------
  function renderFlat(tbody, groups) {
    const allPassed = groups.flatMap(g => g.passed);
    const sorted    = sortModules(allPassed, sortCol, sortDir);

    sorted.forEach((m, i) => {
      tbody.append(buildModuleRow(m, i, improve, 'passed', sortCol));
    });
  }

  // ------------------------------------------------------------------
  // Header click handler
  // ------------------------------------------------------------------
  function onHeaderClick(colKey) {
    if (colKey === 'semester') {
      // Cycle: group → sem↑ → sem↓ → group
      if (sortCol !== 'semester') {
        sortCol = 'semester';
        sortDir = 1;
      } else if (sortDir === 1) {
        sortDir = -1;
      } else {
        sortCol = 'group';
        sortDir = 1;
      }
    } else {
      if (sortCol === colKey) {
        sortDir = sortDir === 1 ? -1 : 1;
      } else {
        sortCol = colKey;
        sortDir = 1;
      }
    }
    render();
  }

  // ------------------------------------------------------------------
  // Improve bar builder (called once, state synced via syncImproveToggle)
  // ------------------------------------------------------------------
  function buildImproveBar() {
    const bar = el('div', {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      background:     '#fffbea',
      border:         `1px solid #f0d070`,
      borderRadius:   BORDER_RADIUS,
      padding:        '6px 10px',
      marginBottom:   '8px',
      gap:            '10px',
    });

    const textCol = el('div', { flex: '1' });
    const label   = el('div', {
      fontWeight: '600',
      fontSize:   '0.88em',
      color:      '#7a5800',
    }, '✨ Notenverbesserung simulieren');

    const subtitle = el('div', {
      fontSize: '0.78em',
      color:    COLORS.GREY_TEXT,
    });
    subtitle.id = 'qp-imp-subtitle';
    subtitle.textContent = '…';

    textCol.append(label, subtitle);

    // Toggle switch
    const switchLabel = document.createElement('label');
    Object.assign(switchLabel.style, {
      position: 'relative',
      display:  'inline-block',
      width:    '36px',
      height:   '20px',
      flexShrink: '0',
    });

    const checkbox  = document.createElement('input');
    checkbox.type   = 'checkbox';
    checkbox.id     = 'qp-imp';
    Object.assign(checkbox.style, { opacity: '0', width: '0', height: '0' });

    const slider = el('span', {
      position:     'absolute',
      cursor:       'pointer',
      top:          '0', left: '0', right: '0', bottom: '0',
      background:   '#ccc',
      borderRadius: '20px',
      transition:   'background 0.2s',
    });

    const knob = el('span', {
      position:     'absolute',
      content:      '""',
      height:       '14px',
      width:        '14px',
      left:         '3px',
      bottom:       '3px',
      background:   COLORS.WHITE,
      borderRadius: '50%',
      transition:   'transform 0.2s',
    });
    slider.append(knob);

    checkbox.addEventListener('change', () => {
      improve = checkbox.checked;
      slider.style.background = improve ? COLORS.ORANGE : '#ccc';
      knob.style.transform    = improve ? 'translateX(16px)' : 'translateX(0)';
      setBool(STORAGE_KEYS.IMPROVE, improve);
      render();
    });

    switchLabel.append(checkbox, slider);
    bar.append(textCol, switchLabel);

    // Keep a reference so syncImproveToggle can reach checkbox+knob+slider
    bar.dataset.checkboxId = 'qp-imp';
    bar._checkbox  = checkbox;
    bar._slider    = slider;
    bar._knob      = knob;

    return bar;
  }

  function syncImproveToggle() {
    const cb = improveBar._checkbox;
    if (!cb) return;
    cb.checked                       = improve;
    improveBar._slider.style.background = improve ? COLORS.ORANGE : '#ccc';
    improveBar._knob.style.transform    = improve ? 'translateX(16px)' : 'translateX(0)';
  }

  // ------------------------------------------------------------------
  // Control bar builder (reset + history buttons)
  // ------------------------------------------------------------------
  function buildCtrlBar() {
    const bar = el('div', {
      display:      'flex',
      gap:          '8px',
      marginBottom: '6px',
      alignItems:   'center',
    });

    // Reset button
    const resetBtn = el('button', {
      border:       `1px solid ${COLORS.ORANGE}`,
      background:   COLORS.WHITE,
      color:        COLORS.ORANGE,
      borderRadius: '4px',
      padding:      '3px 10px',
      fontSize:     '0.80em',
      cursor:       'pointer',
      transition:   'opacity 0.15s',
    }, '↺ Sortierung zurücksetzen');
    resetBtn.id = 'qp-reset';

    resetBtn.addEventListener('click', () => {
      if (sortCol === 'group' && sortDir === 1) return;
      sortCol = 'group';
      sortDir = 1;
      render();
    });

    // History button
    const histBtn = el('button', {
      border:       `1px solid ${COLORS.TEAL}`,
      background:   COLORS.WHITE,
      color:        COLORS.TEAL,
      borderRadius: '4px',
      padding:      '3px 10px',
      fontSize:     '0.80em',
      cursor:       'pointer',
      transition:   'opacity 0.15s',
    });
    histBtn.id = 'qp-hist';

    histBtn.addEventListener('click', () => {
      if (sortCol !== 'group') return;
      showHistory = !showHistory;
      setBool(STORAGE_KEYS.HISTORY, showHistory);
      render();
    });

    bar.append(resetBtn, histBtn);
    bar._resetBtn = resetBtn;
    bar._histBtn  = histBtn;

    return bar;
  }

  function updateCtrlBar() {
    const resetBtn = ctrlBar._resetBtn;
    const histBtn  = ctrlBar._histBtn;
    if (!resetBtn || !histBtn) return;

    const isDefault = sortCol === 'group' && sortDir === 1;
    resetBtn.style.opacity = isDefault ? '0.4' : '1';
    resetBtn.style.cursor  = isDefault ? 'default' : 'pointer';

    // Count historical entries across all groups for the button label
    const groups = buildSemesterGroups(attempts, moduleMap, currentSemNum, true);
    const histCount = groups.reduce((sum, g) => sum + g.historical.length, 0);

    histBtn.textContent  = `📋 Frühere Versuche (${histCount})`;
    const histEnabled    = sortCol === 'group';
    histBtn.style.opacity = histEnabled ? '1' : '0.4';
    histBtn.style.cursor  = histEnabled ? 'pointer' : 'not-allowed';
    histBtn.title         = histEnabled ? '' : 'Nur im Semestermodus verfügbar';

    // Highlight when active
    histBtn.style.background    = showHistory && histEnabled ? COLORS.TEAL    : COLORS.WHITE;
    histBtn.style.color         = showHistory && histEnabled ? COLORS.WHITE   : COLORS.TEAL;
  }

  return widget;
}
