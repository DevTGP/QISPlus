'use strict';

// ---------------------------------------------------------------------------
// QISPlus – progress bar + badge builders
// ---------------------------------------------------------------------------

import { CSS_VARS, DEFAULT_TOTAL_ECTS, BORDER_RADIUS } from '../constants.js';
import { el, fmt, gradeColor }                  from './core.js';

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
    color:         CSS_VARS.ON_ACCENT,
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
export function buildProgressBar(earnedEcts, remaining, totalEcts = DEFAULT_TOTAL_ECTS) {
  const pct     = totalEcts > 0 ? Math.min(100, (earnedEcts / totalEcts) * 100) : 0;
  const pctStr  = pct.toFixed(1);

  // --- top label row --------------------------------------------------
  const labels = el('div', {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:   '4px',
    fontSize:       '0.85em',
    color:          CSS_VARS.PROGRESS_LABEL,
  });

  const leftLabel = el('span', { fontWeight: '600' });
  leftLabel.textContent = `${earnedEcts} / ${totalEcts} ECTS erreicht`;

  const rightLabel = el('span', { color: CSS_VARS.GREY_TEXT });
  rightLabel.textContent = `${remaining} verbleibend · ${pctStr}%`;

  labels.append(leftLabel, rightLabel);

  // --- bar track ------------------------------------------------------
  const track = el('div', {
    width:        '100%',
    height:       '10px',
    borderRadius: '5px',
    background:   CSS_VARS.PROGRESS_TRACK,
    overflow:     'hidden',
  });

  const fill = el('div', {
    height:     '100%',
    width:      `${pct}%`,
    background: `linear-gradient(90deg, ${CSS_VARS.PROGRESS_GRAD_A}, ${CSS_VARS.PROGRESS_GRAD_B})`,
    borderRadius: '5px',
    transition:   'width 0.4s ease',
  });

  track.append(fill);

  // --- wrapper --------------------------------------------------------
  const wrapper = el('div', {
    marginBottom: '10px',
    padding:      '8px 10px',
    background:   CSS_VARS.PROGRESS_BG,
    borderRadius: BORDER_RADIUS,
  });

  wrapper.append(labels, track);
  return wrapper;
}

// ---------------------------------------------------------------------------
// buildStatBadges
// ---------------------------------------------------------------------------

/**
 * Build the row of summary badges shown beneath the progress bar:
 *   [ Ø 1.70 ]   [ 30 ECTS ]   [ Bestm. Ø 1.45 ]
 *
 * The "best achievable" badge is rendered with a subtle dashed border so
 * it reads as a *projection* rather than a hard fact, but lives next to
 * the other key numbers so it is visible at a glance.
 *
 * @param {number|null}      avg             Global weighted average (null if no passed modules)
 * @param {number}           ects            Total earned ECTS
 * @param {number|null}      [bestAchievable] Best achievable global average (omit/null to hide)
 * @returns {HTMLElement}
 */
export function buildStatBadges(avg, ects, bestAchievable = null) {
  const wrapper = el('div', {
    display:      'flex',
    gap:          '8px',
    flexWrap:     'wrap',
    alignItems:   'center',
    marginBottom: '10px',
  });

  if (avg !== null) {
    wrapper.append(buildBadge(`Ø&thinsp;${fmt(avg)}`, gradeColor(avg)));
  } else {
    wrapper.append(buildBadge('Ø&thinsp;–', CSS_VARS.GREY_TEXT));
  }

  wrapper.append(buildBadge(`${ects}&thinsp;ECTS`, CSS_VARS.TEAL));

  if (bestAchievable !== null && Number.isFinite(bestAchievable)) {
    const bestBadge = buildBadge(
      `Bestm.&thinsp;Ø&thinsp;${fmt(bestAchievable)}`,
      gradeColor(bestAchievable),
      { border: `1px dashed ${CSS_VARS.ON_ACCENT}` }
    );
    bestBadge.title = 'Bestmöglicher Notenschnitt – verbleibende Module mit 1,0 angenommen';
    wrapper.append(bestBadge);
  }

  return wrapper;
}
