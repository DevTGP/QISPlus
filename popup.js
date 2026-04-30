'use strict';

// ---------------------------------------------------------------------------
// QISPlus – popup script (ES module)
//
// Loaded as <script type="module">, so it can import shared code from src/.
// Responsibilities:
//   1. Render and persist the global on/off toggle.
//   2. Render the current extension version (single source of truth: manifest).
//   3. Check GitHub for newer releases and show a banner if one exists.
// ---------------------------------------------------------------------------

import { STORAGE_KEYS, GITHUB, THEMES }             from './src/constants.js';
import { storageGet, storageSet, sendToActiveTab,
         getTotalEcts, setTotalEcts,
         getTheme, setTheme }                       from './src/storage.js';
import { getUpdateInfo, getCurrentVersion }          from './src/update.js';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const toggle     = /** @type {HTMLInputElement} */ (document.getElementById('qp-toggle'));
const statusEl   = /** @type {HTMLElement} */      (document.getElementById('qp-status'));
const versionEl  = /** @type {HTMLElement} */      (document.getElementById('qp-version'));
const updateEl   = /** @type {HTMLElement} */      (document.getElementById('qp-update'));
const ectsInput  = /** @type {HTMLInputElement} */ (document.getElementById('qp-total-ects'));
const ectsMinus  = /** @type {HTMLButtonElement} */ (document.getElementById('qp-ects-minus'));
const ectsPlus   = /** @type {HTMLButtonElement} */ (document.getElementById('qp-ects-plus'));
const themeSeg   = /** @type {HTMLElement} */      (document.getElementById('qp-theme-seg'));

const ECTS_MIN = 1;
const ECTS_MAX = 999;

// ---------------------------------------------------------------------------
// Toggle (Notenübersicht ein/aus)
// ---------------------------------------------------------------------------

function setStatus(on) {
  if (on) {
    statusEl.textContent = 'Aktiv';
    statusEl.className   = 'qp-status active';
  } else {
    statusEl.textContent = 'Deaktiviert';
    statusEl.className   = 'qp-status inactive';
  }
}

async function initToggle() {
  const result    = await storageGet(STORAGE_KEYS.ENABLED);
  const enabled   = result[STORAGE_KEYS.ENABLED] !== false; // default: true
  toggle.checked  = enabled;
  setStatus(enabled);
}

toggle.addEventListener('change', async () => {
  const enabled = toggle.checked;
  await storageSet({ [STORAGE_KEYS.ENABLED]: enabled });
  setStatus(enabled);
  await sendToActiveTab({ type: 'qisplus_toggle', enabled });
});

// ---------------------------------------------------------------------------
// Version label – always reflects the running manifest, so there is no risk
// of popup.html and manifest.json drifting apart again.
// ---------------------------------------------------------------------------

function renderVersion() {
  versionEl.textContent = `v${getCurrentVersion()}`;
}

// ---------------------------------------------------------------------------
// Update banner
// ---------------------------------------------------------------------------

/**
 * Render the update banner if a newer version is available, else hide it.
 * Always silent on failure – the popup must remain usable even if GitHub
 * is unreachable or rate-limits us.
 */
async function renderUpdateBanner() {
  let info;
  try {
    info = await getUpdateInfo();
  } catch (err) {
    console.warn('[QISPlus] update check threw:', err);
    return;
  }

  if (!info || !info.hasUpdate) {
    updateEl.style.display = 'none';
    return;
  }

  // Build the banner DOM directly so we don't have to escape user-controlled
  // strings into innerHTML. The version strings come from GitHub but it's
  // still cleaner to use textContent / setAttribute throughout.
  updateEl.replaceChildren();

  const title = document.createElement('div');
  title.className   = 'qp-update-title';
  title.textContent = '⬆ Update verfügbar';

  const body = document.createElement('div');
  body.className = 'qp-update-body';
  body.append(
    'Neue Version ',
    Object.assign(document.createElement('b'), { textContent: `v${info.latest}` }),
    ` (du nutzt v${info.current}).`,
  );

  const btn = document.createElement('a');
  btn.className   = 'qp-update-btn';
  btn.href        = info.downloadUrl || info.url || GITHUB.RELEASES_URL;
  btn.target      = '_blank';
  btn.rel         = 'noopener noreferrer';
  btn.textContent = 'Download';

  updateEl.append(title, body, btn);
  updateEl.style.display = 'block';
}

// ---------------------------------------------------------------------------
// Gesamt-ECTS input
// ---------------------------------------------------------------------------

function updateStepperButtons() {
  const v = parseInt(ectsInput.value, 10);
  ectsMinus.disabled = !Number.isFinite(v) || v <= ECTS_MIN;
  ectsPlus.disabled  = !Number.isFinite(v) || v >= ECTS_MAX;
}

async function initEctsInput() {
  const stored = await getTotalEcts();
  ectsInput.value = String(stored);
  updateStepperButtons();
}

async function commitEcts(raw) {
  if (!Number.isFinite(raw) || raw < ECTS_MIN || raw > ECTS_MAX) {
    // Reset to the currently stored value so the field doesn't show garbage
    ectsInput.value = String(await getTotalEcts());
    updateStepperButtons();
    return;
  }
  ectsInput.value = String(raw);
  updateStepperButtons();
  await setTotalEcts(raw);
  // storage.onChanged in widget.js will pick this up automatically
}

ectsInput.addEventListener('change', () => {
  commitEcts(parseInt(ectsInput.value, 10));
});

ectsInput.addEventListener('input', updateStepperButtons);

ectsMinus.addEventListener('click', () => {
  const v = parseInt(ectsInput.value, 10) || 0;
  commitEcts(Math.max(ECTS_MIN, v - 1));
});

ectsPlus.addEventListener('click', () => {
  const v = parseInt(ectsInput.value, 10) || 0;
  commitEcts(Math.min(ECTS_MAX, v + 1));
});

// ---------------------------------------------------------------------------
// Theme picker (Auto / Hell / Dunkel)
//
// The popup is a separate document so it carries its own CSS variables
// (defined inline in popup.html). The widget picks up the same theme via
// chrome.storage.onChanged → applyTheme(). 'auto' clears the attribute so
// the prefers-color-scheme media query takes over.
// ---------------------------------------------------------------------------

function paintThemeButtons(active) {
  for (const btn of themeSeg.querySelectorAll('button')) {
    const isOn = btn.dataset.theme === active;
    btn.classList.toggle('is-active', isOn);
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  }
}

function applyPopupTheme(mode) {
  if (mode === THEMES.AUTO) {
    document.documentElement.removeAttribute('data-qp-theme');
  } else {
    document.documentElement.setAttribute('data-qp-theme', mode);
  }
  paintThemeButtons(mode);
}

async function initThemePicker() {
  const stored = await getTheme();
  applyPopupTheme(stored);
}

themeSeg.addEventListener('click', async (ev) => {
  const btn = /** @type {HTMLElement|null} */ (ev.target instanceof HTMLElement
    ? ev.target.closest('button[data-theme]')
    : null);
  if (!btn) return;
  const mode = btn.dataset.theme;
  if (mode !== THEMES.AUTO && mode !== THEMES.LIGHT && mode !== THEMES.DARK) return;
  applyPopupTheme(mode);
  await setTheme(mode);
  // widget.js listens on chrome.storage.onChanged for STORAGE_KEYS.THEME
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

renderVersion();
initToggle();
initEctsInput();
initThemePicker();
renderUpdateBanner();
