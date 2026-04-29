'use strict';

// ---------------------------------------------------------------------------
// QISPlus – update checker
//
// Checks the GitHub Releases API for a newer published release and caches
// the result in chrome.storage.local so the popup does not hammer GitHub
// on every open. The cache TTL is configurable via UPDATE_TTL_MS in
// constants.js (default 6 h).
//
// Public surface:
//   getUpdateInfo({ force? }) → Promise<UpdateInfo|null>
//
// "null" is only returned when no version information could be obtained at
// all (no cache, no network). Callers should treat that as "unknown" and
// simply not display anything.
// ---------------------------------------------------------------------------

import { GITHUB, STORAGE_KEYS, UPDATE_TTL_MS } from './constants.js';
import { storageGet, storageSet }               from './storage.js';

/**
 * @typedef {Object} CachedRelease
 * @property {string} version       e.g. "0.7.0" (no leading "v")
 * @property {string} url           html_url of the release page
 * @property {string} downloadUrl   First asset's browser_download_url, or html_url
 * @property {string} publishedAt   ISO 8601 timestamp from GitHub
 * @property {number} checkedAt     Date.now() when the cache was written
 */

/**
 * @typedef {Object} UpdateInfo
 * @property {string}  current     Version from manifest.json
 * @property {string}  latest      Latest release tag (no leading "v")
 * @property {boolean} hasUpdate   true ⇔ latest > current
 * @property {string}  url         Release page URL
 * @property {string}  downloadUrl Best download link (asset or release page)
 * @property {string}  publishedAt ISO 8601
 * @property {number}  checkedAt   ms since epoch when the data was fetched
 */

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

/**
 * Compare two semver-ish version strings.
 *
 * Both arguments may include a leading "v" (it is stripped). Missing
 * components are treated as 0, so "1.2" === "1.2.0".
 *
 *   compareVersions('1.2.3', '1.2.4')  → -1
 *   compareVersions('v0.7',  '0.6.9')  →  1
 *   compareVersions('0.6.0', '0.6.0')  →  0
 *
 * Pre-release suffixes (e.g. "1.0.0-rc1") are NOT supported beyond stripping
 * the suffix – they compare as equal to their base version. If you ever
 * publish pre-releases, expand this function.
 *
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 */
export function compareVersions(a, b) {
  const norm = (s) => String(s).trim().replace(/^v/i, '').split(/[-+]/, 1)[0];
  const pa = norm(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = norm(b).split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Release fetcher
// ---------------------------------------------------------------------------

const GH_HEADERS = {
  'Accept':               'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

/**
 * Fetch the latest formal Release from GitHub.
 *
 * Returns null when the repo has no published releases yet (HTTP 404 from
 * /releases/latest is GitHub's documented "no release" signal – not an
 * error condition). Throws on every other non-OK response so genuine
 * problems are still surfaced to the caller.
 *
 * @returns {Promise<CachedRelease|null>}
 */
async function fetchLatestRelease() {
  const response = await fetch(GITHUB.API_LATEST, { headers: GH_HEADERS });

  if (response.status === 404) return null;     // no published release yet
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const tag  = String(data.tag_name ?? '').replace(/^v/i, '');
  if (!tag) return null;

  // Pick the first uploaded asset as primary download; fall back to the
  // release page if no assets exist (which is fine – user can still install).
  const firstAsset = Array.isArray(data.assets) ? data.assets[0] : null;
  const downloadUrl = firstAsset?.browser_download_url ?? data.html_url;

  return {
    version:     tag,
    url:         data.html_url,
    downloadUrl,
    publishedAt: data.published_at ?? '',
    checkedAt:   Date.now(),
  };
}

/**
 * Fallback: fetch the most recent Git tag and treat it as the "latest version".
 * Used when no formal Release exists. Picks the highest semver-comparable
 * tag rather than relying on GitHub's tag ordering, which is by commit date
 * and can be wrong when tags are created out of order.
 *
 * @returns {Promise<CachedRelease|null>}
 */
async function fetchLatestTag() {
  const response = await fetch(GITHUB.API_TAGS, { headers: GH_HEADERS });

  if (response.status === 404) return null;     // repo missing or empty
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText}`);
  }

  const tags = await response.json();
  if (!Array.isArray(tags) || !tags.length) return null;

  // Keep only semver-shaped tags, then pick the maximum.
  const semverTags = tags
    .map(t => ({ name: String(t.name ?? ''), version: String(t.name ?? '').replace(/^v/i, '') }))
    .filter(t => /^\d+(\.\d+)+/.test(t.version));
  if (!semverTags.length) return null;

  semverTags.sort((a, b) => compareVersions(b.version, a.version));
  const top = semverTags[0];

  return {
    version:     top.version,
    url:         `https://github.com/${GITHUB.OWNER}/${GITHUB.REPO}/releases/tag/${encodeURIComponent(top.name)}`,
    downloadUrl: `https://github.com/${GITHUB.OWNER}/${GITHUB.REPO}/archive/refs/tags/${encodeURIComponent(top.name)}.zip`,
    publishedAt: '',
    checkedAt:   Date.now(),
  };
}

/**
 * Resolve the latest version by trying /releases/latest first, then falling
 * back to /tags. Returns null if both come up empty.
 *
 * @returns {Promise<CachedRelease|null>}
 */
async function fetchLatestVersion() {
  const fromRelease = await fetchLatestRelease();
  if (fromRelease) return fromRelease;
  return await fetchLatestTag();
}

// ---------------------------------------------------------------------------
// Cache plumbing
// ---------------------------------------------------------------------------

async function readCache() {
  const result = await storageGet(STORAGE_KEYS.UPDATE_CACHE);
  return /** @type {CachedRelease|null} */ (result[STORAGE_KEYS.UPDATE_CACHE] ?? null);
}

async function writeCache(release) {
  await storageSet({ [STORAGE_KEYS.UPDATE_CACHE]: release });
}

// ---------------------------------------------------------------------------
// Manifest version
// ---------------------------------------------------------------------------

/**
 * Read the running extension's version from its manifest.
 * Falls back to '0.0.0' in non-extension contexts (tests).
 *
 * @returns {string}
 */
export function getCurrentVersion() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getManifest) return '0.0.0';
  return chrome.runtime.getManifest().version ?? '0.0.0';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the UpdateInfo result from a cached release record.
 */
function buildInfo(current, release) {
  return /** @type {UpdateInfo} */ ({
    current,
    latest:      release.version,
    hasUpdate:   compareVersions(release.version, current) > 0,
    url:         release.url,
    downloadUrl: release.downloadUrl,
    publishedAt: release.publishedAt,
    checkedAt:   release.checkedAt,
  });
}

/**
 * Get the current update status, using the cache when fresh.
 *
 *   • Cache hit (within TTL) → returned immediately, no network call.
 *   • Cache stale or missing → fetch GitHub, update cache, return.
 *   • Fetch fails            → return last cached value if available, else null.
 *
 * @param {Object}  [opts]
 * @param {boolean} [opts.force=false]  Bypass the TTL and always re-fetch
 * @returns {Promise<UpdateInfo|null>}
 */
export async function getUpdateInfo({ force = false } = {}) {
  const current = getCurrentVersion();
  const cached  = await readCache();

  const isFresh = cached && (Date.now() - cached.checkedAt) < UPDATE_TTL_MS;
  if (!force && isFresh) return buildInfo(current, cached);

  try {
    const fresh = await fetchLatestVersion();

    // No release AND no tag – repo just hasn't published anything yet.
    // This is a normal state, not an error: stay quiet and re-use the
    // previous cache if we have one.
    if (!fresh) {
      return cached ? buildInfo(current, cached) : null;
    }

    await writeCache(fresh);
    return buildInfo(current, fresh);
  } catch (err) {
    // Genuine failure (network down, 5xx, malformed JSON, …). Log once and
    // degrade gracefully to the last known result.
    console.warn('[QISPlus] update check failed:', err);
    return cached ? buildInfo(current, cached) : null;
  }
}
