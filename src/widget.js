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

import { WIDGET_ID, STORAGE_KEYS, CSS_VARS, BORDER_RADIUS, DEFAULT_TOTAL_ECTS } from './constants.js';
import {
  buildModuleMap,
  buildSemesterGroups,
  calcGlobalStats,
  calcSemStats,
  calcNeededAvg,
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
  injectThemeStyles,
  applyTheme,
} from './render/index.js';
import { getBool, setBool, getTotalEcts, getTheme } from './storage.js';

// ---------------------------------------------------------------------------
// markImprovable – tag every module whose grade gets replaced by 1.0 in the
// improvement simulation.
// ---------------------------------------------------------------------------

/**
 * Tag modules that are subject to the "improvement" simulation, i.e. whose
 * grade is replaced by 1.0 when the toggle is on.
 *
 * Two disjoint sources qualify a module as `improvable`:
 *
 *  1. **Active improvement** – `isImproving === true`. The user has already
 *     registered a PNV retake this semester, so this is the strongest
 *     possible "I am actually improving this" signal.
 *
 *  2. **Speculative candidate** – the module is from the most recent fully
 *     passed semester (the typical "what if I retake last semester?" case).
 *     Active and ongoing modules are excluded from the search for that
 *     semester since they don't yet have a settled grade.
 *
 * Returns the label of the speculative semester (for the subtitle in the
 * improvement bar). If no speculative candidates exist – e.g. only active
 * improvements – the empty string is returned.
 *
 * @param {import('./stats.js').SemesterGroup[]} groups
 * @returns {string}  semLabel of the speculative semester, or ''
 */
function markImprovable(groups) {
  // ---- 1. Find the latest fully-passed semester (skip ongoing/improving)
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

  // ---- 2. Mark improvable: active improvement OR latest passed semester
  for (const g of groups) {
    for (const m of g.passed) {
      const isLatestPassed =
        !m.isImproving && !m.isOngoing && m.passedSemNum === maxSemNum;
      m.improvable = m.isImproving || isLatestPassed;
    }
  }

  return maxSemNum === -Infinity ? '' : maxLabel;
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
  let sortCol     = 'group';          // 'group'|'name'|'grade'|'ects'|'semester'
  let sortDir     = 1;                // 1 = asc, -1 = desc
  let improve     = false;
  let showHistory = false;
  let totalEcts   = DEFAULT_TOTAL_ECTS;
  let targetGrade = null;             // Notenziel-Reverse-Calculator input (null = no input)
  let lastGStats  = null;             // last calcGlobalStats result, used by updateReverseCalc
  /** @type {Map<string, number>} */
  const whatIfGrades = new Map();     // moduleName → hypothetical grade

  // ------------------------------------------------------------------
  // Build the stable module map (does not change with UI state)
  // ------------------------------------------------------------------
  const moduleMap = buildModuleMap(attempts, currentSem, currentSemNum);

  // ------------------------------------------------------------------
  // Inject theme stylesheet (once per page) – defines all --qp-* CSS
  // custom properties for the light/dark palettes the widget consumes.
  // ------------------------------------------------------------------
  injectThemeStyles();

  // ------------------------------------------------------------------
  // Widget shell
  // ------------------------------------------------------------------
  const widget = el('div', {
    id:           WIDGET_ID,
    background:   CSS_VARS.WIDGET_BG,
    color:        CSS_VARS.WIDGET_FG,
    border:       `2px solid ${CSS_VARS.WIDGET_BORDER}`,
    borderRadius: BORDER_RADIUS,
    padding:      '14px 16px',
    margin:       '16px 0',
    fontFamily:   'sans-serif',
    fontSize:     '14px',
    lineHeight:   '1.5',
    boxShadow:    CSS_VARS.WIDGET_SHADOW,
  });
  widget.id = WIDGET_ID;

  // --- Title -----------------------------------------------------------
  const title = el('div', {
    fontWeight:   '700',
    fontSize:     '1.05em',
    color:        CSS_VARS.TEAL,
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

  // --- Reverse calculator (built once, result updated reactively) -----
  const reverseCalcBox = buildReverseCalcBox();

  // --- Improve bar ----------------------------------------------------
  const improveBar = buildImproveBar();

  // --- Control bar ----------------------------------------------------
  const ctrlBar = buildCtrlBar();

  // --- Table box (replaced each render) --------------------------------
  const tableBox = el('div', { marginTop: '8px', overflowX: 'auto' });

  widget.append(title, progressBox, badgesBox, reverseCalcBox, improveBar, ctrlBar, tableBox);

  // ------------------------------------------------------------------
  // Restore persisted toggle states + configurable ECTS target + theme
  // ------------------------------------------------------------------
  Promise.all([
    getBool(STORAGE_KEYS.IMPROVE,  false),
    getBool(STORAGE_KEYS.HISTORY,  false),
    getTotalEcts(),
    getTheme(),
  ]).then(([imp, hist, ects, theme]) => {
    improve     = imp;
    showHistory = hist;
    totalEcts   = ects;
    applyTheme(widget, theme);
    syncImproveToggle();
    render();
  });

  // React to popup changes (TOTAL_ECTS / THEME written by popup.js) so the
  // widget updates live while the popup is open.
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (STORAGE_KEYS.TOTAL_ECTS in changes) {
        const newVal = Number(changes[STORAGE_KEYS.TOTAL_ECTS].newValue);
        if (Number.isFinite(newVal) && newVal >= 1) {
          totalEcts = newVal;
          render();
        }
      }
      if (STORAGE_KEYS.THEME in changes) {
        applyTheme(widget, changes[STORAGE_KEYS.THEME].newValue);
      }
    });
  }

  // Run an initial render immediately (with default state) so the
  // widget is visible before storage resolves.
  render();

  // ------------------------------------------------------------------
  // applyWhatIf – clone semester groups and override passedGrade for
  // modules with a hypothetical "what-if" entry. The overrides flow
  // transparently through calcSemStats / calcGlobalStats / sortModules
  // and cascade into the Notenziel-Reverse-Calculator and Bestm.-Ø.
  // Modules with a what-if value are also marked improvable=false so
  // the global improvement toggle does not also stomp on the user's
  // explicit per-module input.
  // ------------------------------------------------------------------
  function applyWhatIf(groups) {
    if (whatIfGrades.size === 0) return groups;
    const overrideOne = (m) => {
      if (whatIfGrades.has(m.name) && m.passedGrade !== null) {
        return {
          ...m,
          passedGrade: whatIfGrades.get(m.name),
          improvable:  false,
          _isWhatIf:   true,
          _origGrade:  m.passedGrade,
        };
      }
      return m;
    };
    return groups.map(g => ({
      ...g,
      passed:    g.passed.map(overrideOne),
      improving: g.improving.map(overrideOne),
    }));
  }

  // ------------------------------------------------------------------
  // What-if change handler – fed to every passed-row's grade cell
  // ------------------------------------------------------------------
  function onWhatIfChange(name, value, commit) {
    if (value === null || !Number.isFinite(value)) {
      whatIfGrades.delete(name);
    } else {
      whatIfGrades.set(name, value);
    }
    if (commit) {
      render();
    } else {
      updateStatsOnly();
    }
  }

  // ------------------------------------------------------------------
  // updateStatsOnly – cheap re-calc that updates progress / badges /
  // reverse-calculator without rebuilding the table. Used for live
  // preview while the user types in a per-module what-if input so the
  // input keeps focus.
  // ------------------------------------------------------------------
  function updateStatsOnly() {
    const groups   = buildSemesterGroups(attempts, moduleMap, currentSemNum, showHistory);
    markImprovable(groups);
    const eff      = applyWhatIf(groups);
    const gStats   = calcGlobalStats(eff, improve, currentSemNum, totalEcts);
    lastGStats     = gStats;

    progressBox.innerHTML = '';
    progressBox.append(buildProgressBar(gStats.earnedEcts, gStats.remaining, totalEcts));

    badgesBox.innerHTML = '';
    badgesBox.append(buildStatBadges(
      gStats.currentAvg,
      gStats.earnedEcts,
      gStats.currentAvg !== null ? gStats.bestAchievable : null,
    ));

    updateReverseCalc();
    updateCtrlBar();
  }

  // ------------------------------------------------------------------
  // render()
  // ------------------------------------------------------------------
  function render() {
    const groups  = buildSemesterGroups(attempts, moduleMap, currentSemNum, showHistory);
    const impSem  = markImprovable(groups);
    const eff     = applyWhatIf(groups);
    const gStats  = calcGlobalStats(eff, improve, currentSemNum, totalEcts);
    lastGStats    = gStats;

    // Update progress bar
    progressBox.innerHTML = '';
    progressBox.append(buildProgressBar(gStats.earnedEcts, gStats.remaining, totalEcts));

    // Update badges (Ø, ECTS, bestmöglicher Schnitt)
    badgesBox.innerHTML = '';
    badgesBox.append(buildStatBadges(
      gStats.currentAvg,
      gStats.earnedEcts,
      gStats.currentAvg !== null ? gStats.bestAchievable : null,
    ));

    // Update improve-bar subtitle
    const subtitle = widget.querySelector('#qp-imp-subtitle');
    if (subtitle) {
      subtitle.textContent = impSem
        ? `Letzte abgeschlossene Semester: ${impSem}`
        : 'Keine verbesserbaren Module gefunden';
    }

    // Update reverse calculator result
    updateReverseCalc();

    // Update control bar button states
    updateCtrlBar();

    // Rebuild table
    tableBox.innerHTML = '';
    const { table, tbody } = buildTable(sortCol, sortDir, onHeaderClick);

    if (sortCol === 'group') {
      renderGrouped(tbody, eff);
    } else {
      renderFlat(tbody, eff);
    }

    tableBox.append(table);
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
        tbody.append(buildModuleRow(m, passedIdx++, improve, 'passed', sortCol, { onWhatIfChange }));
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
      tbody.append(buildModuleRow(m, i, improve, 'passed', sortCol, { onWhatIfChange }));
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
  // Reverse calculator box (built once; result div updated reactively)
  // ------------------------------------------------------------------

  /**
   * Build the "Notenziel-Reverse-Calculator" section.
   * The box is created once; only the result <div> changes when the user
   * types a target grade or when the global stats change.
   */
  function buildReverseCalcBox() {
    const box = el('div', {
      background:   CSS_VARS.REVERSE_BG,
      border:       `1px solid ${CSS_VARS.REVERSE_BORDER}`,
      borderRadius: BORDER_RADIUS,
      padding:      '6px 10px',
      marginBottom: '8px',
    });

    // --- top row: label + input -----------------------------------
    const topRow = el('div', {
      display:     'flex',
      alignItems:  'center',
      gap:         '8px',
      marginBottom: '3px',
    });

    const lbl = el('span', {
      fontWeight: '600',
      fontSize:   '0.88em',
      color:      CSS_VARS.TEAL,
      whiteSpace: 'nowrap',
    }, '🎯 Ziel-Schnitt:');

    const input = document.createElement('input');
    input.type        = 'number';
    input.min         = '1.0';
    input.max         = '4.0';
    input.step        = '0.1';
    input.placeholder = 'z.B. 1.7';
    input.id          = 'qp-target-grade';
    Object.assign(input.style, {
      width:        '72px',
      padding:      '2px 6px',
      border:       `1px solid ${CSS_VARS.REVERSE_BORDER}`,
      borderRadius: '4px',
      fontSize:     '0.88em',
      fontFamily:   'inherit',
      color:        CSS_VARS.INPUT_FG,
      background:   CSS_VARS.INPUT_BG,
      textAlign:    'right',
      outline:      'none',
    });

    input.addEventListener('focus', () => {
      input.style.borderColor = CSS_VARS.TEAL;
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = CSS_VARS.REVERSE_BORDER;
    });

    topRow.append(lbl, input);

    // --- result line -----------------------------------------------
    const resultEl = el('div', {
      fontSize:  '0.80em',
      color:     CSS_VARS.GREY_TEXT,
      fontStyle: 'italic',
    });
    resultEl.id          = 'qp-reverse-result';
    resultEl.textContent = 'Ziel-Schnitt eingeben, um den benötigten Durchschnitt zu sehen.';

    box.append(topRow, resultEl);

    // Update targetGrade and re-run calculator on every keystroke
    input.addEventListener('input', () => {
      const raw = parseFloat(input.value);
      targetGrade = (Number.isFinite(raw) && raw >= 1.0 && raw <= 4.0) ? raw : null;
      updateReverseCalc();
    });

    return box;
  }

  /**
   * Refresh the reverse calculator result display.
   * Reads the current `targetGrade` and `lastGStats` closure variables.
   * Safe to call before the first render (lastGStats is null → no-op).
   */
  function updateReverseCalc() {
    const resultEl = /** @type {HTMLElement|null} */ (
      widget.querySelector('#qp-reverse-result')
    );
    if (!resultEl) return;

    // Helper to set result appearance in one call
    const setResult = (text, color, italic = false) => {
      resultEl.textContent  = text;
      resultEl.style.color  = color;
      resultEl.style.fontStyle = italic ? 'italic' : 'normal';
    };

    if (targetGrade === null) {
      setResult(
        'Ziel-Schnitt eingeben, um den benötigten Durchschnitt zu sehen.',
        CSS_VARS.GREY_TEXT, true
      );
      return;
    }

    if (!lastGStats) return;

    const { weightedSum, remaining, earnedEcts, currentAvg } = lastGStats;

    if (earnedEcts === 0) {
      setResult('Noch keine bestandenen Module vorhanden.', CSS_VARS.GREY_TEXT, true);
      return;
    }

    // Degree already complete (earnedEcts ≥ totalEcts)
    if (remaining <= 0) {
      if (currentAvg !== null) {
        const met = currentAvg <= targetGrade;
        setResult(
          met
            ? `Ziel erreicht – dein Schnitt (${fmt(currentAvg)}) liegt bei oder unter ${fmt(targetGrade)}.`
            : `Ziel verfehlt – dein Schnitt (${fmt(currentAvg)}) liegt über ${fmt(targetGrade)}.`,
          met ? CSS_VARS.GREEN : CSS_VARS.RED
        );
      }
      return;
    }

    const result = calcNeededAvg(targetGrade, weightedSum, remaining, totalEcts);
    if (!result) {
      setResult('Keine Daten verfügbar.', CSS_VARS.GREY_TEXT, true);
      return;
    }

    if (result.impossible) {
      setResult(
        `Nicht mehr erreichbar – selbst mit 1,0 in allen verbleibenden ${remaining} ECTS.`,
        CSS_VARS.RED
      );
    } else if (result.trivial) {
      setResult(
        `Bereits sicher – das Ziel ist selbst bei schlechten Restleistungen erreichbar.`,
        CSS_VARS.GREEN
      );
    } else {
      setResult(
        `→ Du brauchst Ø ${fmt(result.needed)} in den verbleibenden ${remaining} ECTS.`,
        gradeColor(result.needed)
      );
    }
  }

  // ------------------------------------------------------------------
  // Improve bar builder (called once, state synced via syncImproveToggle)
  // ------------------------------------------------------------------
  function buildImproveBar() {
    const bar = el('div', {
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      background:     CSS_VARS.IMPROVE_BAR_BG,
      border:         `1px solid ${CSS_VARS.IMPROVE_BAR_BORDER}`,
      borderRadius:   BORDER_RADIUS,
      padding:        '6px 10px',
      marginBottom:   '8px',
      gap:            '10px',
    });

    const textCol = el('div', { flex: '1' });
    const label   = el('div', {
      fontWeight: '600',
      fontSize:   '0.88em',
      color:      CSS_VARS.IMPROVE_BAR_TEXT,
    }, '✨ Notenverbesserung simulieren');

    const subtitle = el('div', {
      fontSize: '0.78em',
      color:    CSS_VARS.GREY_TEXT,
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
      background:   CSS_VARS.TOGGLE_OFF,
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
      background:   CSS_VARS.SURFACE,
      borderRadius: '50%',
      transition:   'transform 0.2s',
    });
    slider.append(knob);

    checkbox.addEventListener('change', () => {
      improve = checkbox.checked;
      slider.style.background = improve ? CSS_VARS.ORANGE : CSS_VARS.TOGGLE_OFF;
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
    improveBar._slider.style.background = improve ? CSS_VARS.ORANGE : CSS_VARS.TOGGLE_OFF;
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
      border:       `1px solid ${CSS_VARS.ORANGE}`,
      background:   CSS_VARS.SURFACE,
      color:        CSS_VARS.ORANGE,
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
      border:       `1px solid ${CSS_VARS.TEAL}`,
      background:   CSS_VARS.SURFACE,
      color:        CSS_VARS.TEAL,
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

    // What-If Reset button (only visible when ≥1 hypothetical grade is set)
    const whatIfBtn = el('button', {
      border:       `1px solid ${CSS_VARS.TEAL_LIGHT}`,
      background:   CSS_VARS.SURFACE,
      color:        CSS_VARS.TEAL_LIGHT,
      borderRadius: '4px',
      padding:      '3px 10px',
      fontSize:     '0.80em',
      cursor:       'pointer',
      transition:   'opacity 0.15s',
      display:      'none',
    });
    whatIfBtn.id = 'qp-whatif-reset';

    whatIfBtn.addEventListener('click', () => {
      if (whatIfGrades.size === 0) return;
      whatIfGrades.clear();
      render();
    });

    bar.append(resetBtn, histBtn, whatIfBtn);
    bar._resetBtn  = resetBtn;
    bar._histBtn   = histBtn;
    bar._whatIfBtn = whatIfBtn;

    return bar;
  }

  function updateCtrlBar() {
    const resetBtn  = ctrlBar._resetBtn;
    const histBtn   = ctrlBar._histBtn;
    const whatIfBtn = ctrlBar._whatIfBtn;
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
    histBtn.style.background    = showHistory && histEnabled ? CSS_VARS.TEAL    : CSS_VARS.SURFACE;
    histBtn.style.color         = showHistory && histEnabled ? CSS_VARS.SURFACE   : CSS_VARS.TEAL;

    // What-If reset button visibility / label
    if (whatIfBtn) {
      const n = whatIfGrades.size;
      if (n > 0) {
        whatIfBtn.style.display = '';
        whatIfBtn.textContent   = `↺ Was-wäre-wenn zurücksetzen (${n})`;
        whatIfBtn.title         = `${n} hypothetische Note(n) aktiv`;
      } else {
        whatIfBtn.style.display = 'none';
      }
    }
  }

  return widget;
}
