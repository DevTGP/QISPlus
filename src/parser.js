'use strict';

// ---------------------------------------------------------------------------
// QISPlus – DOM parser
//
// Key insight from reverse-engineering the actual QIS HTML:
//   • Row type is determined by  cells[0].className,  NOT  row.className
//   • qis_konto rows: cells[0] has the class (spacer), cells[1] has colspan=2
//     with "Modul: <name>", cells[4] has module-level ECTS
//   • ns_tabelle1_alignleft rows: cells[0] carries the class AND pruefNr
//     → column indices match the spec exactly (0=pruefNr, 1=text, …)
//   • The grades table is reliably identified by cell classes
// ---------------------------------------------------------------------------

import {COL} from './constants.js';
import {cellText, collapseWS, parseGrade, semToNum} from './utils.js';

const CLS_KONTO = 'qis_konto';
const CLS_KONTO_TOP = 'qis_kontoOnTop';
const CLS_DETAIL = 'ns_tabelle1_alignleft';

// ---------------------------------------------------------------------------
// findGradesTable
// ---------------------------------------------------------------------------

function findGradesTable() {
    const tables = Array.from(document.querySelectorAll('table'));

    for (const tbl of tables) {
        for (const row of tbl.querySelectorAll('tr')) {
            const cls = row.cells[0]?.className.trim() ?? '';
            if (cls === CLS_KONTO || cls === CLS_KONTO_TOP || cls === CLS_DETAIL) {
                return tbl;
            }
        }
    }

    // Fallback: second table on the page (matches reference implementation)
    return tables[1] ?? null;
}

function getRows(table) {
    return Array.from(table.querySelectorAll('tr'));
}

// ---------------------------------------------------------------------------
// parseKontoRow
//
// Real DOM layout:
//   cells[0]  class="qis_konto"  – empty spacer cell
//   cells[1]  colspan="2"        – "Modul: <name>"
//   cells[2]                     – module-level grade  (ignored per spec)
//   cells[3]                     – module-level status (ignored per spec)
//   cells[4]                     – module ECTS
// ---------------------------------------------------------------------------

function parseKontoRow(row) {
    const cells = row.cells;
    if (!cells.length) return null;

    const fc = cells[0]?.className.trim() ?? '';
    if (fc !== CLS_KONTO && fc !== CLS_KONTO_TOP) return null;

    const nameCell = cells[1];
    if (!nameCell) return null;
    if (parseInt(nameCell.getAttribute('colspan') ?? '1', 10) < 2) return null;

    const rawText = collapseWS(cellText(nameCell));
    if (!rawText.startsWith('Modul:')) return null;

    const name = collapseWS(rawText.replace(/^Modul:\s*/i, ''));
    const ects = parseInt(cellText(cells[4]), 10) || 0;

    return {name, ects};
}

// ---------------------------------------------------------------------------
// buildAttempt
// ---------------------------------------------------------------------------

function buildAttempt(row, moduleName, moduleEcts) {
    const cells = row.cells;
    const get = (i) => cellText(cells[i]);

    const text = get(COL.TEXT);
    const semRaw = get(COL.SEMESTER);
    const remark = get(COL.VERMERK) || get(COL.FREIV);

    return {
        moduleName,
        moduleEcts,
        pruefNr: get(COL.PRUEF_NR),
        text,
        isSL: text.includes('(Studienleistung)'),
        semester: semRaw,
        semNum: semToNum(semRaw),
        grade: parseGrade(get(COL.NOTE)),
        status: get(COL.STATUS),
        ects: parseInt(get(COL.ECTS), 10) || 0,
        remark,
        attempt: parseInt(get(COL.VERSUCH), 10) || 1,
        date: get(COL.DATUM),
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ExamAttempt
 * @property {string}      moduleName
 * @property {number}      moduleEcts
 * @property {string}      pruefNr
 * @property {string}      text
 * @property {boolean}     isSL
 * @property {string}      semester
 * @property {number}      semNum
 * @property {number|null} grade
 * @property {string}      status
 * @property {number}      ects
 * @property {string}      remark
 * @property {number}      attempt
 * @property {string}      date
 */

/**
 * @typedef {Object} ParseResult
 * @property {ExamAttempt[]} attempts
 * @property {string}        currentSem
 * @property {number}        currentSemNum
 */

export function parseGrades() {
    const table = findGradesTable();
    if (!table) return {attempts: [], currentSem: '', currentSemNum: 0};

    const rows = getRows(table);

    // Pass 1 – currentSem = highest semNum among AN detail rows
    let currentSemNum = 0;
    let currentSem = '';

    for (const row of rows) {
        if ((row.cells[0]?.className.trim() ?? '') !== CLS_DETAIL) continue;
        const status = cellText(row.cells[COL.STATUS]);
        if (status !== 'AN') continue;
        const sn = semToNum(cellText(row.cells[COL.SEMESTER]));
        if (sn > currentSemNum) {
            currentSemNum = sn;
            currentSem = cellText(row.cells[COL.SEMESTER]);
        }
    }

    // Pass 2 – build attempts[]
    let moduleName = '';
    let moduleEcts = 0;
    const attempts = [];

    for (const row of rows) {
        const konto = parseKontoRow(row);
        if (konto) {
            moduleName = konto.name;
            moduleEcts = konto.ects;
            continue;
        }

        if ((row.cells[0]?.className.trim() ?? '') !== CLS_DETAIL) continue;

        const attempt = buildAttempt(row, moduleName, moduleEcts);
        if (attempt.isSL) continue;
        attempts.push(attempt);
    }

    return {attempts, currentSem, currentSemNum};
}