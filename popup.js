const ENABLED_KEY = 'qisplus_enabled';
const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

// Load current state
chrome.storage.local.get(ENABLED_KEY, (result) => {
  const enabled = result[ENABLED_KEY] !== false; // default: on
  toggle.checked = enabled;
  updateStatus(enabled);
});

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;

  // Persist
  chrome.storage.local.set({ [ENABLED_KEY]: enabled });
  updateStatus(enabled);

  // Tell the active tab's content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId == null) return;
    chrome.tabs.sendMessage(tabId, { type: 'qisplus_toggle', enabled }, () => {
      // Ignore "no receiver" errors (e.g. page not loaded yet)
      void chrome.runtime.lastError;
    });
  });
});

function updateStatus(enabled) {
  status.textContent = enabled ? 'Aktiv' : 'Deaktiviert';
  status.style.color = enabled ? '#298836' : '#888';
}
