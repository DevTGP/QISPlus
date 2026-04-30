'use strict';

// ---------------------------------------------------------------------------
// QISPlus – statistics engine
//
// Pure functions only. No DOM access, no side effects, no imports of render
// or widget code.  All inputs are plain JS objects produced by parser.js.
// ---------------------------------------------------------------------------

import { DEFAULT_TOTAL_ECTS }      from './constants.js';
import { groupBy, minBy, maxBy }   from './utils.js';

// ---------------------------------------------------------------------------
// Reason-label lookup
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const REMARK_LABELS = {
  RT:  'Abgemeldet',
  AT:  'Rücktritt (Attest)',
  RM:  'Rücktritt (anerkannt)',
  NE:  'Nicht erschienen',
  NZ:  'Nicht zugelassen',
  ZW5: 'Zwangsfünf',
  NA5: 'Nicht angetreten',
  PNV: 'Notenverbesserungsversuch',
  FNB: 'Freiversuch (nicht bestanden)',
  PFV: 'Potenzieller Freiversuch',
  PVB: 'Potenz. Freiversuch (Notenverbess.)',
  NVN: 'Keine Notenverbesserung erreicht',
};

/**
 * Human-readable label for a given status + remark combination.
 *
 * @param {string} status  "BE" | "NB" | "EN" | "AN"
 * @param {string} remark  Contents of cells[6] || cells[7]
 * @returns {string}
 */
export function getReasonLabel(status, remark) {
  if (status === 'NB') return 'Nicht bestanden';
  if (status === 'EN') return 'Endgültig nicht bestanden';
  if (status === 'AN') return REMARK_LABELS[remark] ?? 'Angemeldet';
  return '';
}

// ---------------------------------------------------------------------------
// ModuleInfo builder
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ModuleInfo
 * @property {string}      name
 * @property {number}      ects
 * @property {number|null} passedGrade
 * @property {string|null} passedSem        Semester of the passing attempt
 * @property {number}      passedSemNum
 * @property {string|null} improvementSem   Semester of the active PNV attempt
 * @property {string|null} ongoingSem       Semester of the active first-try AN
 * @property {boolean}     isOngoing
 * @property {boolean}     isImproving
 * @property {boolean}     [improvable]   – set later by markImprovable()
 */

/**
 * Build a Map<moduleName, ModuleInfo> from a flat ExamAttempt array.
 *
 * Key correctness rules:
 *  • passedGrade = grade of the **lowest-numbered** (= best) BE attempt.
 *    If a retake produced a new BE, use the most recent BE's grade.
 *    If a PNV attempt in currentSem already has a grade (BE), use that.
 *  • ects        = ECTS of the same passing attempt. Note + ECTS always
 *    come from one consistent source. The Konto-header ECTS are only a
 *    fallback for modules that have no BE attempt yet, because QIS writes
 *    the header ECTS as 0 whenever an attempt is still pending (Status PV)
 *    – even if a previous attempt already passed.
 *  • isOngoing   = AN, no remark, currentSem, no prior BE
 *  • isImproving = AN, remark = PNV, currentSem, prior BE exists
 *
 * @param {import('./parser.js').ExamAttempt[]} attempts
 * @param {string} currentSem
 * @param {number} currentSemNum
 * @returns {Map<string, ModuleInfo>}
 */
export function buildModuleMap(attempts, currentSem, currentSemNum) {
  const byModule = groupBy(attempts, a => a.moduleName);

  /** @type {Map<string, ModuleInfo>} */
  const map = new Map();

  for (const [name, group] of byModule) {
    const firstAttempt   = group[0];
    const headerEcts     = firstAttempt.moduleEcts;  // fallback only

    // All BE (passed) attempts for this module
    const beAttempts = group.filter(a => a.status === 'BE');

    // All AN rows in the current semester for this module
    const currentAN  = group.filter(a =>
      a.status === 'AN' && a.semNum === currentSemNum
    );

    // PNV registration in currentSem
    const pnvRow = currentAN.find(a => a.remark === 'PNV') ?? null;

    // Plain registration (no remark) in currentSem
    const plainAN = currentAN.find(a => a.remark === '') ?? null;

    // --- Determine the authoritative passing attempt ----------------
    // The grade AND ects always come from the same attempt so the two
    // values stay in sync (this is what fixes the IT-Sicherheit case
    // where the Konto-header reported 0 ECTS while a previous BE row
    // still held the real ECTS).
    let passedAttempt = null;

    if (beAttempts.length > 0) {
      // If a PNV row in the current semester already produced a BE,
      // that retake supersedes the previous result (same pruefNr).
      const pnvBE = pnvRow
        ? beAttempts.find(a =>
            a.pruefNr === pnvRow.pruefNr && a.semNum === currentSemNum
          )
        : null;

      // Otherwise pick the best (lowest) grade among all BE attempts.
      passedAttempt = pnvBE ?? minBy(beAttempts, a => a.grade ?? Infinity);
    }

    const passedGrade  = passedAttempt?.grade   ?? null;
    const passedSem    = passedAttempt?.semester ?? null;
    const passedSemNum = passedAttempt?.semNum   ?? 0;

    // ECTS: prefer the passing attempt's own ECTS (always > 0 for BE
    // rows in QIS). Fall back to the Konto-header value for modules
    // that have no BE yet (display column shows "–" anyway in that case,
    // but keeping the value lets future code use it for planning views).
    const ects = (passedAttempt && passedAttempt.ects > 0)
      ? passedAttempt.ects
      : headerEcts;

    const hasBE       = passedGrade !== null;
    const isImproving = hasBE && pnvRow !== null;
    const isOngoing   = !hasBE && plainAN !== null;

    /** @type {ModuleInfo} */
    const info = {
      name,
      ects,
      passedGrade,
      passedSem,
      passedSemNum,
      improvementSem: isImproving ? (pnvRow.semester || currentSem) : null,
      ongoingSem:     isOngoing   ? (plainAN.semester || currentSem) : null,
      isOngoing,
      isImproving,
    };

    map.set(name, info);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Semester group builder
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} HistEntry
 * @property {string}      moduleName
 * @property {string}      semester
 * @property {number}      semNum
 * @property {number|null} grade
 * @property {string}      status
 * @property {string}      remark
 * @property {string}      reasonLabel
 */

/**
 * @typedef {Object} SemesterGroup
 * @property {string}      semLabel
 * @property {number}      semNum
 * @property {ModuleInfo[]} passed
 * @property {ModuleInfo[]} ongoing
 * @property {ModuleInfo[]} improving
 * @property {HistEntry[]} historical
 */

/**
 * Organise modules and historical attempts into semester groups.
 *
 * Placement rules:
 *  • Passed module → group of passedSem.
 *  • Improving module → also appears in improving[] of the current sem group.
 *  • Ongoing module  → ongoing[] of the current sem group.
 *  • Historical      → historical[] of their own semester (only when showHistory).
 *    Includes: NB, EN, AN+remark (past sem), plain AN in past semesters.
 *
 * @param {import('./parser.js').ExamAttempt[]} attempts
 * @param {Map<string, ModuleInfo>}             moduleMap
 * @param {number}                              currentSemNum
 * @param {boolean}                             showHistory
 * @returns {SemesterGroup[]}
 */
export function buildSemesterGroups(attempts, moduleMap, currentSemNum, showHistory) {
  /** @type {Map<number, SemesterGroup>} */
  const groups = new Map();

  // Helper: get-or-create a group
  const getGroup = (semNum, semLabel) => {
    if (!groups.has(semNum)) {
      groups.set(semNum, {
        semLabel: semLabel || String(semNum),
        semNum,
        passed:    [],
        ongoing:   [],
        improving: [],
        historical: [],
      });
    }
    return groups.get(semNum);
  };

  // ------------------------------------------------------------------
  // Place each module into the correct group(s)
  // ------------------------------------------------------------------
  for (const [, info] of moduleMap) {
    // Passed module (has a BE grade)
    if (info.passedGrade !== null && info.passedSem) {
      const g = getGroup(info.passedSemNum, info.passedSem);
      if (!g.passed.includes(info)) g.passed.push(info);
    }

    // Improving module also appears in the current-semester improving list
    if (info.isImproving) {
      const currentGroup = getGroup(currentSemNum, info.improvementSem ?? '');
      currentGroup.improving.push(info);
    }

    // Ongoing module
    if (info.isOngoing) {
      // Find the semester label from one of the AN rows
      const anAttempt = attempts.find(
        a => a.moduleName === info.name && a.status === 'AN' && a.semNum === currentSemNum
      );
      const g = getGroup(currentSemNum, anAttempt?.semester ?? '');
      g.ongoing.push(info);
    }
  }

  // ------------------------------------------------------------------
  // Historical entries (NB, EN, withdrawn AN, past plain AN)
  // ------------------------------------------------------------------
  if (showHistory) {
    for (const a of attempts) {
      const isHistorical =
        a.status === 'NB' ||
        a.status === 'EN' ||
        (a.status === 'AN' && a.remark !== '' && a.semNum !== currentSemNum) ||
        (a.status === 'AN' && a.remark === '' && a.semNum !== currentSemNum);

      if (!isHistorical) continue;

      /** @type {HistEntry} */
      const entry = {
        moduleName:  a.moduleName,
        semester:    a.semester,
        semNum:      a.semNum,
        grade:       a.grade,
        status:      a.status,
        remark:      a.remark,
        reasonLabel: getReasonLabel(a.status, a.remark),
      };

      const g = getGroup(a.semNum, a.semester);
      g.historical.push(entry);
    }
  }

  // ------------------------------------------------------------------
  // Sort groups by semNum ascending; within groups sort passed by name
  // ------------------------------------------------------------------
  const sorted = Array.from(groups.values()).sort((a, b) => a.semNum - b.semNum);

  for (const g of sorted) {
    g.passed.sort((a, b) => a.name.localeCompare(b.name));
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Stat calculators
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ReverseCalcResult
 * @property {number}  needed      Required average grade in the remaining ECTS
 * @property {boolean} feasible    true when 1.0 ≤ needed ≤ 4.0
 * @property {boolean} trivial     true when needed > 4.0 (target already guaranteed)
 * @property {boolean} impossible  true when needed < 1.0 (target unachievable)
 */

/**
 * Calculate the weighted-average grade needed in the remaining ECTS to reach a
 * desired overall final grade ("Notenziel-Reverse-Calculator").
 *
 * Formula:  needed = (target × totalEcts − weightedSum) / remaining
 *
 * Returns null when there are no remaining ECTS (degree already complete).
 *
 * @param {number} targetGrade   Desired final weighted average, e.g. 1.7
 * @param {number} weightedSum   Σ (grade × ects) across all passed modules
 * @param {number} remaining     ECTS not yet earned (totalEcts − earnedEcts)
 * @param {number} totalEcts     Degree ECTS target (user-configurable)
 * @returns {ReverseCalcResult|null}
 */
export function calcNeededAvg(targetGrade, weightedSum, remaining, totalEcts) {
  if (remaining <= 0) return null;
  const needed = (targetGrade * totalEcts - weightedSum) / remaining;
  return {
    needed,
    feasible:   needed >= 1.0 && needed <= 4.0,
    trivial:    needed > 4.0,
    impossible: needed < 1.0,
  };
}

/**
 * Compute the weighted average and ECTS total for an array of ModuleInfo.
 * Returns null when the array is empty (no passed modules to average).
 *
 * @param {ModuleInfo[]} items  Passed modules only.
 * @returns {{ avg: number, ects: number }|null}
 */
export function calcSemStats(items) {
  if (!items || !items.length) return null;

  let weightedSum = 0;
  let totalEcts   = 0;

  for (const m of items) {
    if (m.passedGrade === null || m.ects <= 0) continue;
    weightedSum += m.passedGrade * m.ects;
    totalEcts   += m.ects;
  }

  if (totalEcts === 0) return null;

  return {
    avg:  Math.round((weightedSum / totalEcts) * 100) / 100,
    ects: totalEcts,
  };
}

/**
 * @typedef {Object} GlobalStats
 * @property {number}      earnedEcts
 * @property {number}      weightedSum
 * @property {number|null} currentAvg
 * @property {number}      bestAchievable
 * @property {number}      remaining
 */

/**
 * Aggregate stats across all semester groups.
 *
 * Only `passed` modules count.  If `withImprovement` is true, modules flagged
 * as improvable use a grade of 1.0 for the weightedSum (optimistic scenario).
 * Ongoing / improving modules are never counted in the ECTS or average.
 *
 * @param {SemesterGroup[]} semGroups
 * @param {boolean}         withImprovement
 * @param {number}          currentSemNum   (unused here but kept for API symmetry)
 * @param {number}          [totalEcts]     Degree target; defaults to DEFAULT_TOTAL_ECTS
 * @returns {GlobalStats}
 */
export function calcGlobalStats(semGroups, withImprovement, currentSemNum, totalEcts = DEFAULT_TOTAL_ECTS) {
  let earnedEcts  = 0;
  let weightedSum = 0;

  for (const group of semGroups) {
    for (const m of group.passed) {
      if (m.passedGrade === null) continue;

      const grade = withImprovement && m.improvable ? 1.0 : m.passedGrade;
      earnedEcts  += m.ects;
      weightedSum += grade * m.ects;
    }
  }

  const remaining      = Math.max(0, totalEcts - earnedEcts);
  const currentAvg     = earnedEcts > 0
    ? weightedSum / earnedEcts
    : null;

  // Best achievable = (current weighted sum + all remaining credits at 1.0)
  //                   / totalEcts
  const bestAchievable = totalEcts > 0
    ? (weightedSum + remaining * 1.0) / totalEcts
    : 0;

  return { earnedEcts, weightedSum, currentAvg, bestAchievable, remaining };
}
