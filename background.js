'use strict';

// ---------------------------------------------------------------------------
// QISPlus – background service worker (MV3)
//
// Periodically polls the GitHub Releases API and surfaces a new release as a
// small "!" badge on the toolbar icon. The popup keeps showing its own banner
// when opened; this layer just makes the update visible without the user
// having to open the popup first.
//
// Wiring:
//   • chrome.alarms fires a periodic check (period = UPDATE_TTL_MS).
//   • An immediate check runs on install and on browser startup.
//   • storage.onChanged on the update cache key keeps the badge in sync when
//     the popup itself triggers a fresh check.
//
// The actual GitHub call + caching lives in src/update.js – we just consume
// it. Network/quota errors are swallowed there; here we only react to the
// resulting hasUpdate flag.
// ---------------------------------------------------------------------------

import { getUpdateInfo } from './src/update.js';
import { COLORS, STORAGE_KEYS, UPDATE_TTL_MS } from './src/constants.js';

const ALARM_NAME           = 'qisplus-update-check';
const ALARM_PERIOD_MINUTES = Math.max(1, Math.round(UPDATE_TTL_MS / 60000));

// ---------------------------------------------------------------------------
// Badge rendering
// ---------------------------------------------------------------------------

/**
 * Push the current update state onto the toolbar icon.
 *
 * Pass in an UpdateInfo if you already have one (e.g. from a storage.onChanged
 * event) to avoid a redundant cache read; otherwise we'll fetch it ourselves.
 *
 * @param {import('./src/update.js').UpdateInfo|null} [info]
 * @param {Object} [opts]
 * @param {boolean} [opts.force=false]  Bypass the cache TTL when computing
 *   the state. Used on install/update so a stale cache from a previous build
 *   doesn't keep showing the old "latest" version for up to UPDATE_TTL_MS.
 */
async function refreshBadge(info, { force = false } = {}) {
  try {
    const data      = info === undefined ? await getUpdateInfo({ force }) : info;
    const hasUpdate = !!(data && data.hasUpdate);

    if (hasUpdate) {
      await chrome.action.setBadgeText({ text: '!' });
      await chrome.action.setBadgeBackgroundColor({ color: COLORS.ORANGE });
      // setBadgeTextColor is Chrome 110+ – guard for older builds.
      if (chrome.action.setBadgeTextColor) {
        await chrome.action.setBadgeTextColor({ color: COLORS.WHITE });
      }
      await chrome.action.setTitle({
        title: `QISPlus – Update auf v${data.latest} verfügbar`,
      });
    } else {
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'QISPlus' });
    }
  } catch (err) {
    console.warn('[QISPlus] badge refresh failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Alarm scheduling
// ---------------------------------------------------------------------------

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (existing && existing.periodInMinutes === ALARM_PERIOD_MINUTES) return;
  await chrome.alarms.create(ALARM_NAME, {
    // First fire shortly after startup so we don't wait a full period for the
    // initial sync – getUpdateInfo will still hit the cache first if fresh.
    delayInMinutes:  1,
    periodInMinutes: ALARM_PERIOD_MINUTES,
  });
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  await ensureAlarm();
  // Force a fresh check on install/update: a cached "latest version" from a
  // previous build (e.g. before the dual-source release/tag lookup landed)
  // would otherwise stick around for the full TTL.
  await refreshBadge(undefined, { force: true });
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  await refreshBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  await refreshBadge();
});

// When the popup runs its own update check it writes to UPDATE_CACHE; mirror
// that into the badge so both surfaces stay consistent without a second
// network round-trip.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!(STORAGE_KEYS.UPDATE_CACHE in changes)) return;
  refreshBadge();
});
