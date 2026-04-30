'use strict';

// ---------------------------------------------------------------------------
// QISPlus – theme module
//
// Defines the light + dark colour palettes as CSS custom properties and
// injects a single <style> block into the host document. The widget and all
// its sub-elements consume these via inline styles like
//   `background: var(--qp-widget-bg)`
// (see CSS_VARS in src/constants.js for the full mapping).
//
// Three modes:
//   • 'auto'  – follow the OS prefers-color-scheme media query (default)
//   • 'light' – force the light palette (data-qp-theme="light")
//   • 'dark'  – force the dark  palette (data-qp-theme="dark")
//
// The CSS is structured so attribute-targeted selectors win over the media
// query (both have specificity (0,2,0) but appear later in the cascade), so
// switching modes is a one-attribute change on the widget root.
// ---------------------------------------------------------------------------

import { WIDGET_ID, THEMES } from '../constants.js';

export const THEME_STYLE_ID = 'qisplus-theme-style';

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

/**
 * Light theme – the historical look.
 * Keep keys in sync with DARK and CSS_VARS in constants.js.
 */
const LIGHT = {
  // Brand palette
  '--qp-orange':           '#ca5116',
  '--qp-orange-hover':     '#a33e0f',
  '--qp-teal':             '#115E67',
  '--qp-teal-light':       '#1a8a96',
  '--qp-green':            '#298836',
  '--qp-red':              '#A50034',

  // Foreground / surfaces
  '--qp-fg':               '#222222',
  '--qp-grey-text':        '#6b7280',
  '--qp-surface':          '#ffffff',
  '--qp-on-accent':        '#ffffff',

  // Widget chrome
  '--qp-widget-bg':        '#f7fbff',
  '--qp-widget-border':    '#ca5116',
  '--qp-shadow':           '0 2px 8px rgba(0,0,0,0.07)',

  // Table / rows
  '--qp-row-border':       '#dee2eb',
  '--qp-group-hdr-bg':     '#dce8f5',
  '--qp-header-divider':   'rgba(255,255,255,0.15)',
  '--qp-passed-row-a':     '#ffffff',
  '--qp-passed-row-b':     '#eef4fb',
  '--qp-ongoing-row-a':    '#fafafa',
  '--qp-ongoing-row-b':    '#f3f3f3',
  '--qp-improve-row-a':    '#fffbea',
  '--qp-improve-row-b':    '#fff8d6',
  '--qp-hist-row-a':       '#fff8f0',
  '--qp-hist-row-b':       '#fff2e5',

  // Progress
  '--qp-progress-track':   '#e0e7ef',
  '--qp-progress-bg':      '#eaf1f8',
  '--qp-progress-label':   '#444444',
  '--qp-progress-grad-a':  '#ca5116',
  '--qp-progress-grad-b':  '#e07040',

  // Reverse calculator
  '--qp-reverse-bg':       '#eef6ff',
  '--qp-reverse-border':   '#b8d4ef',

  // Improve bar
  '--qp-improve-bar-bg':     '#fffbea',
  '--qp-improve-bar-border': '#f0d070',
  '--qp-improve-bar-text':   '#7a5800',

  // Toggle switch (off state)
  '--qp-toggle-off':       '#ccc',

  // Inputs
  '--qp-input-bg':         '#ffffff',
  '--qp-input-fg':         '#222222',

  // Grade brackets
  '--qp-grade-good':       '#298836',
  '--qp-grade-ok':         '#115E67',
  '--qp-grade-warn':       '#ca5116',
  '--qp-grade-bad':        '#A50034',

  // Improvement badge
  '--qp-improving-badge-bg': '#c9a227',
  '--qp-improving-badge-fg': '#ffffff',
};

/**
 * Dark theme – tuned to be readable on a dark host page (or with Dark Reader
 * disabled). Same keys as LIGHT.
 */
const DARK = {
  // Brand palette – brightened so contrast on dark surface stays AA
  '--qp-orange':           '#ff7f4d',
  '--qp-orange-hover':     '#e05d24',
  '--qp-teal':             '#5dc8d4',
  '--qp-teal-light':       '#7fdce6',
  '--qp-green':            '#4cd06a',
  '--qp-red':              '#ff6088',

  // Foreground / surfaces
  '--qp-fg':               '#e6e9ef',
  '--qp-grey-text':        '#9ca3af',
  '--qp-surface':          '#1f2937',
  '--qp-on-accent':        '#0d1117',

  // Widget chrome
  '--qp-widget-bg':        '#11161f',
  '--qp-widget-border':    '#ff7f4d',
  '--qp-shadow':           '0 2px 12px rgba(0,0,0,0.6)',

  // Table / rows
  '--qp-row-border':       '#2a3344',
  '--qp-group-hdr-bg':     '#1d2638',
  '--qp-header-divider':   'rgba(0,0,0,0.25)',
  '--qp-passed-row-a':     '#162033',
  '--qp-passed-row-b':     '#1b273e',
  '--qp-ongoing-row-a':    '#11161f',
  '--qp-ongoing-row-b':    '#161c27',
  '--qp-improve-row-a':    '#2a2415',
  '--qp-improve-row-b':    '#332c1b',
  '--qp-hist-row-a':       '#2a1d15',
  '--qp-hist-row-b':       '#33231b',

  // Progress
  '--qp-progress-track':   '#2a3344',
  '--qp-progress-bg':      '#1a2231',
  '--qp-progress-label':   '#cbd2dd',
  '--qp-progress-grad-a':  '#ff7f4d',
  '--qp-progress-grad-b':  '#ff9d6e',

  // Reverse calculator
  '--qp-reverse-bg':       '#172238',
  '--qp-reverse-border':   '#3a577a',

  // Improve bar
  '--qp-improve-bar-bg':     '#2a2415',
  '--qp-improve-bar-border': '#7a5800',
  '--qp-improve-bar-text':   '#ffd97a',

  // Toggle switch (off state)
  '--qp-toggle-off':       '#3a4252',

  // Inputs
  '--qp-input-bg':         '#1f2937',
  '--qp-input-fg':         '#e6e9ef',

  // Grade brackets
  '--qp-grade-good':       '#4cd06a',
  '--qp-grade-ok':         '#5dc8d4',
  '--qp-grade-warn':       '#ff7f4d',
  '--qp-grade-bad':        '#ff6088',

  // Improvement badge
  '--qp-improving-badge-bg': '#a8862a',
  '--qp-improving-badge-fg': '#0d1117',
};

// ---------------------------------------------------------------------------
// CSS builder
// ---------------------------------------------------------------------------

/**
 * Render a key→value object as a CSS declaration block.
 * @param {Record<string,string>} vars
 * @returns {string}
 */
function declarations(vars) {
  return Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('');
}

/**
 * Build the full theme stylesheet. Always emits all three blocks – the active
 * mode is selected by the `data-qp-theme` attribute on the widget root, with
 * the media query covering "auto" (no attribute or attribute === "auto").
 *
 *   1. `:root` defaults  → also scoped to #qisplus-widget so we don't
 *                          pollute the host page's `--qp-*` namespace.
 *   2. `@media (prefers-color-scheme: dark)`
 *        ⇒ applies dark vars iff data-qp-theme is missing OR === 'auto'
 *   3. `[data-qp-theme="light"]` → force light
 *   4. `[data-qp-theme="dark"]`  → force dark
 *
 * The selector specificity is: 1 < 2 < 3 = 4, so manual overrides always win
 * over the auto media query. Light defaults at the bottom so a forced-light
 * widget on a dark OS still resolves correctly.
 *
 * @returns {string}
 */
export function buildThemeCss() {
  const id    = `#${WIDGET_ID}`;
  const light = declarations(LIGHT);
  const dark  = declarations(DARK);

  return [
    // Light defaults – every widget gets these, regardless of mode
    `${id}{${light}}`,

    // Auto: dark when OS asks for dark and user hasn't forced light
    `@media (prefers-color-scheme: dark){`,
      `${id}:not([data-qp-theme="light"]):not([data-qp-theme="dark"]),`,
      `${id}[data-qp-theme="auto"]{${dark}}`,
    `}`,

    // Manual overrides – attribute selectors beat the media query
    `${id}[data-qp-theme="dark"]{${dark}}`,
    `${id}[data-qp-theme="light"]{${light}}`,
  ].join('');
}

// ---------------------------------------------------------------------------
// DOM injection / theme application
// ---------------------------------------------------------------------------

/**
 * Inject the theme stylesheet into <head>. Idempotent – safe to call more
 * than once; subsequent calls just refresh the contents.
 *
 * @param {Document} [doc=document]  Allows the popup to inject into its own document.
 */
export function injectThemeStyles(doc = document) {
  let style = /** @type {HTMLStyleElement|null} */ (doc.getElementById(THEME_STYLE_ID));
  if (!style) {
    style = doc.createElement('style');
    style.id = THEME_STYLE_ID;
    (doc.head || doc.documentElement).appendChild(style);
  }
  style.textContent = buildThemeCss();
}

/**
 * Apply the chosen theme mode to a target element by setting the
 * `data-qp-theme` attribute. 'auto' clears the attribute so the media query
 * takes over.
 *
 * @param {HTMLElement|null} target
 * @param {('auto'|'light'|'dark')} mode
 */
export function applyTheme(target, mode) {
  if (!target) return;
  const valid = mode === THEMES.LIGHT || mode === THEMES.DARK || mode === THEMES.AUTO;
  const m = valid ? mode : THEMES.AUTO;
  if (m === THEMES.AUTO) {
    target.removeAttribute('data-qp-theme');
  } else {
    target.setAttribute('data-qp-theme', m);
  }
}
