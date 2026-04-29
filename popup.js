'use strict';

// ---------------------------------------------------------------------------
// QISPlus – popup script
//
// Runs in the extension popup context (NOT as a content script).
// Does NOT use ES module syntax because popup scripts are loaded as classic
// scripts via a plain <script src="popup.js"> tag.
//
// Storage key must match STORAGE_KEYS.ENABLED in src/constants.js.
// ---------------------------------------------------------------------------

const ENABLED_KEY = 'qisplus_enabled';

const toggle    = /** @type {HTMLInputElement} */   (document.getElementById('qp-toggle'));
const statusEl  = /** @type {HTMLElement} */        (document.getElementById('qp-status'));

// ---------------------------------------------------------------------------
// Update the status label below the toggle
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

// ---------------------------------------------------------------------------
// Send a toggle message to the currently active tab's content script
// ---------------------------------------------------------------------------
async function notifyTab(enabled) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      await chrome.tabs.sendMessage(tab.id, { type: 'qisplus_toggle', enabled });
    }
  } catch {
    // Content script may not be present on this tab – silently ignore.
  }
}

// ---------------------------------------------------------------------------
// Initialise toggle state from storage
// ---------------------------------------------------------------------------
chrome.storage.local.get(ENABLED_KEY, res => {
  const enabled   = res[ENABLED_KEY] !== false; // default: true
  toggle.checked  = enabled;
  setStatus(enabled);
});

// ---------------------------------------------------------------------------
// Wire toggle interaction
// ---------------------------------------------------------------------------
toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ [ENABLED_KEY]: enabled });
  setStatus(enabled);
  notifyTab(enabled);
});
