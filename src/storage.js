'use strict';

// ---------------------------------------------------------------------------
// QISPlus – chrome.storage.local wrapper
//
// Provides promise-based get/set helpers so the rest of the codebase does not
// have to deal with callback-style storage APIs or repeat error-handling code.
// All functions are safe to call even if chrome.storage is undefined (e.g.
// during unit tests in a non-extension context – they will return fallbacks).
// ---------------------------------------------------------------------------

const _store = () =>
  typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

/**
 * Read one or more keys from chrome.storage.local.
 *
 * @param {string|string[]} keys
 * @returns {Promise<Record<string, unknown>>}
 */
export function storageGet(keys) {
  const store = _store();
  if (!store) return Promise.resolve({});
  return new Promise(resolve => store.get(keys, result => resolve(result || {})));
}

/**
 * Write an object of key→value pairs to chrome.storage.local.
 *
 * @param {Record<string, unknown>} data
 * @returns {Promise<void>}
 */
export function storageSet(data) {
  const store = _store();
  if (!store) return Promise.resolve();
  return new Promise(resolve => store.set(data, () => resolve()));
}

/**
 * Convenience: read a single boolean key with a fallback default.
 *
 * @param {string} key
 * @param {boolean} [defaultValue=true]
 * @returns {Promise<boolean>}
 */
export async function getBool(key, defaultValue = true) {
  const result = await storageGet(key);
  return key in result ? Boolean(result[key]) : defaultValue;
}

/**
 * Convenience: write a single boolean key.
 *
 * @param {string} key
 * @param {boolean} value
 * @returns {Promise<void>}
 */
export function setBool(key, value) {
  return storageSet({ [key]: Boolean(value) });
}

/**
 * Send a message to the currently active tab (used by popup.js).
 * Silently swallows errors if no content script is listening.
 *
 * @param {Record<string, unknown>} message
 * @returns {Promise<void>}
 */
export async function sendToActiveTab(message) {
  if (typeof chrome === 'undefined' || !chrome.tabs) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    // No content script present – ignore.
  }
}
