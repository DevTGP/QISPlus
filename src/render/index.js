'use strict';

// ---------------------------------------------------------------------------
// QISPlus – render barrel
//
// Single import point for all render helpers.
// Import from this file instead of the individual sub-modules to keep
// consumer import lists short:
//
//   import { el, fmt, buildProgressBar, buildTable, … } from './render/index.js';
// ---------------------------------------------------------------------------

export { el, fmt, gradeColor }                          from './core.js';
export { buildBadge, buildProgressBar, buildStatBadges } from './progress.js';
export { buildTable }                                    from './table.js';
export { buildGroupHeader, buildModuleRow, buildHistoricalRow } from './rows.js';
