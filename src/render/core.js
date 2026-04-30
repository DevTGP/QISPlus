'use strict';

// ---------------------------------------------------------------------------
// QISPlus – render core
//
// Three tiny, composable primitives used everywhere else in the render layer.
// No state, no event wiring, no imports from stats or parser.
// ---------------------------------------------------------------------------

import { CSS_VARS } from '../constants.js';

// ---------------------------------------------------------------------------
// el() – element factory
// ---------------------------------------------------------------------------

/**
 * Create an HTMLElement, apply inline styles, and optionally set innerHTML.
 *
 * Usage:
 *   el('div', { color: 'red', fontWeight: 'bold' }, 'Hello <b>world</b>')
 *   el('span', {})                // empty element
 *
 * @param {string} tag           HTML tag name
 * @param {Partial<CSSStyleDeclaration>} [styles]  Inline styles (camelCase keys)
 * @param {string} [html]        Optional innerHTML
 * @returns {HTMLElement}
 */
export function el(tag, styles = {}, html) {
  const node = document.createElement(tag);

  // Apply styles one by one so TypeScript / JSDoc stays happy and
  // we never clobber the style object reference.
  for (const [prop, value] of Object.entries(styles)) {
    node.style[prop] = value;
  }

  if (html !== undefined) node.innerHTML = html;

  return node;
}

// ---------------------------------------------------------------------------
// fmt() – grade formatter
// ---------------------------------------------------------------------------

/**
 * Format a grade number as a string with exactly 2 decimal places,
 * always using '.' as the decimal separator.
 *
 * Examples:
 *   fmt(1.7)  → "1.70"
 *   fmt(2.3)  → "2.30"
 *   fmt(1.0)  → "1.00"
 *
 * @param {number} n
 * @returns {string}
 */
export function fmt(n) {
  return n.toFixed(2);
}

// ---------------------------------------------------------------------------
// gradeColor() – semantic colour by grade value
// ---------------------------------------------------------------------------

/**
 * Return a CSS custom-property reference that semantically represents the
 * given grade. Returning a `var(--qp-grade-…)` string means the colour
 * automatically tracks the active theme without re-render.
 *
 *   ≤ 1.5 → --qp-grade-good
 *   ≤ 2.5 → --qp-grade-ok
 *   ≤ 3.5 → --qp-grade-warn
 *   > 3.5 → --qp-grade-bad
 *
 * @param {number} g
 * @returns {string}  CSS `var(--qp-grade-…)` reference
 */
export function gradeColor(g) {
  if (g <= 1.5) return CSS_VARS.GRADE_GOOD;
  if (g <= 2.5) return CSS_VARS.GRADE_OK;
  if (g <= 3.5) return CSS_VARS.GRADE_WARN;
  return CSS_VARS.GRADE_BAD;
}
