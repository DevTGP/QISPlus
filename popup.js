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

import { STORAGE_KEYS, GITHUB }                     from './src/constants.js';
import { storageGet, storageSet, sendToActiveTab,
         getTotalEcts, setTotalEcts }               from './src/storage.js';
import { getUpdateInfo, getCurrentVersion }          from './src/update.js';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const toggle     = /** @type {HTMLInputElement} */ (document.getElementById('qp-toggle'));
const statusEl   = /** @type {HTMLElement} */      (document.getElementById('qp-status'));
const versionEl  = /** @type {HTMLElement} */      (document.getElementById('qp-version'));
const updateEl   = /** @type {HTMLElement} */      (document.getElementById('qp-update'));
const ectsInput  = /** @type {HTMLInputElement} */ (document.getElementById('qp-total-ects'));

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

async function initEctsInput() {
  const stored = await getTotalEcts();
  ectsInput.value = String(stored);
}

ectsInput.addEventListener('change', async () => {
  const raw = parseInt(ectsInput.value, 10);
  if (!Number.isFinite(raw) || raw < 1 || raw > 999) {
    // Reset to the currently stored value so the field doesn't show garbage
    ectsInput.value = String(await getTotalEcts());
    return;
  }
  await setTotalEcts(raw);
  // storage.onChanged in widget.js will pick this up automatically
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

renderVersion();
initToggle();
initEctsInput();
renderUpdateBanner();
