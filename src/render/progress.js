'use strict';

// ---------------------------------------------------------------------------
// QISPlus – progress bar + badge builders
// ---------------------------------------------------------------------------

import { COLORS, TOTAL_ECTS, BORDER_RADIUS } from '../constants.js';
import { el, fmt, gradeColor }               from './core.js';

// ---------------------------------------------------------------------------
// buildBadge
// ---------------------------------------------------------------------------

/**
 * Create a small pill-shaped badge.
 *
 * @param {string} html       Badge innerHTML
 * @param {string} bgColor    Background colour
 * @param {Partial<CSSStyleDeclaration>} [extraStyles]
 * @returns {HTMLSpanElement}
 */
export function buildBadge(html, bgColor, extraStyles = {}) {
  return /** @type {HTMLSpanElement} */ (el('span', {
    display:       'inline-block',
    backgroundColor: bgColor,
    color:         COLORS.WHITE,
    fontSize:      '0.78em',
    fontWeight:    '600',
    padding:       '2px 8px',
    borderRadius:  '10px',
    lineHeight:    '1.5',
    verticalAlign: 'middle',
    whiteSpace:    'nowrap',
    ...extraStyles,
  }, html));
}

// ---------------------------------------------------------------------------
// buildProgressBar
// ---------------------------------------------------------------------------

/**
 * Build the ECTS progress bar widget.
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │  X / 180 ECTS erreicht         Y verbleibend · Z% │
 *   │  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
 *   └──────────────────────────────────────────────────┘
 *
 * @param {number} earnedEcts
 * @param {number} remaining
 * @param {number} [totalEcts]  Defaults to TOTAL_ECTS constant
 * @returns {HTMLElement}
 */
export function buildProgressBar(earnedEcts, remaining, totalEcts = TOTAL_ECTS) {
  const pct     = totalEcts > 0 ? Math.min(100, (earnedEcts / totalEcts) * 100) : 0;
  const pctStr  = pct.toFixed(1);

  // --- top label row --------------------------------------------------
  const labels = el('div', {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:   '4px',
    fontSize:       '0.85em',
    color:          '#444',
  });

  const leftLabel = el('span', { fontWeight: '600' });
  leftLabel.textContent = `${earnedEcts} / ${totalEcts} ECTS erreicht`;

  const rightLabel = el('span', { color: COLORS.GREY_TEXT });
  rightLabel.textContent = `${remaining} verbleibend · ${pctStr}%`;

  labels.append(leftLabel, rightLabel);

  // --- bar track ------------------------------------------------------
  const track = el('div', {
    width:        '100%',
    height:       '10px',
    borderRadius: '5px',
    background:   '#e0e7ef',
    overflow:     'hidden',
  });

  const fill = el('div', {
    height:     '100%',
    width:      `${pct}%`,
    background: `linear-gradient(90deg, ${COLORS.ORANGE}, #e07040)`,
    borderRadius: '5px',
    transition:   'width 0.4s ease',
  });

  track.append(fill);

  // --- wrapper --------------------------------------------------------
  const wrapper = el('div', {
    marginBottom: '10px',
    padding:      '8px 10px',
    background:   '#eaf1f8',
    borderRadius: BORDER_RADIUS,
  });

  wrapper.append(labels, track);
  return wrapper;
}

// ---------------------------------------------------------------------------
// buildStatBadges
// ---------------------------------------------------------------------------

/**
 * Build the pair of summary badges shown beneath the progress bar:
 *   [ Ø 1.70 ]   [ 30 ECTS ]
 *
 * @param {number|null} avg   Global weighted average (null if no passed modules)
 * @param {number}      ects  Total earned ECTS
 * @returns {HTMLElement}
 */
export function buildStatBadges(avg, ects) {
  const wrapper = el('div', {
    display:      'flex',
    gap:          '8px',
    flexWrap:     'wrap',
    marginBottom: '10px',
  });

  if (avg !== null) {
    wrapper.append(buildBadge(`Ø&thinsp;${fmt(avg)}`, gradeColor(avg)));
  } else {
    wrapper.append(buildBadge('Ø&thinsp;–', COLORS.GREY_TEXT));
  }

  wrapper.append(buildBadge(`${ects}&thinsp;ECTS`, COLORS.TEAL));

  return wrapper;
}
