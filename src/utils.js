'use strict';

// ---------------------------------------------------------------------------
// QISPlus – shared utility functions
// Pure functions only. No DOM access, no side effects.
// ---------------------------------------------------------------------------

/**
 * Convert a QIS semester label into a sortable numeric value.
 *
 * Mapping:
 *   "WiSe 24/25"  → 2024.5
 *   "SoSe 25"     → 2025
 *   "SoSe 2025"   → 2025   (long-form year also supported)
 *   anything else → 0
 *
 * @param {string} s  Raw semester string from the DOM (may have extra whitespace)
 * @returns {number}
 */
export function semToNum(s) {
  if (!s) return 0;

  // WiSe YY/YY  e.g. "WiSe 24/25"
  const wise = s.match(/WiSe\s+(\d{2})\/\d{2}/);
  if (wise) return 2000 + parseInt(wise[1], 10) + 0.5;

  // SoSe YY or SoSe YYYY  e.g. "SoSe 25" | "SoSe 2025"
  const sose = s.match(/SoSe\s+(\d{2,4})/);
  if (sose) {
    const y = parseInt(sose[1], 10);
    return y < 100 ? 2000 + y : y;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/**
 * Collapse all internal whitespace runs to a single space and trim ends.
 *
 * @param {string} s
 * @returns {string}
 */
export function collapseWS(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Return the trimmed textContent of a DOM element (or '' if null).
 *
 * @param {Element|null|undefined} el
 * @returns {string}
 */
export function cellText(el) {
  return el ? el.textContent.trim() : '';
}

// ---------------------------------------------------------------------------
// Number helpers
// ---------------------------------------------------------------------------

/**
 * Parse a German decimal string ("1,7" or "1.7") to a float.
 * Returns null if the value is empty or not a valid number.
 *
 * @param {string} s
 * @returns {number|null}
 */
export function parseGrade(s) {
  if (!s) return null;
  const cleaned = s.replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Clamp a number between min and max (inclusive).
 *
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Array helpers
// ---------------------------------------------------------------------------

/**
 * Group an array by a key function.
 *
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => string} keyFn
 * @returns {Map<string, T[]>}
 */
export function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

/**
 * Return the item in arr for which valueFn returns the maximum value.
 * Returns undefined if arr is empty.
 *
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => number} valueFn
 * @returns {T|undefined}
 */
export function maxBy(arr, valueFn) {
  if (!arr.length) return undefined;
  return arr.reduce((best, cur) => valueFn(cur) > valueFn(best) ? cur : best);
}

/**
 * Return the item in arr for which valueFn returns the minimum value.
 * Returns undefined if arr is empty.
 *
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => number} valueFn
 * @returns {T|undefined}
 */
export function minBy(arr, valueFn) {
  if (!arr.length) return undefined;
  return arr.reduce((best, cur) => valueFn(cur) < valueFn(best) ? cur : best);
}

/**
 * Deduplicate an array by a key function (first occurrence wins).
 *
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => unknown} keyFn
 * @returns {T[]}
 */
export function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
