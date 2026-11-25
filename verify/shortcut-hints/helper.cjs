// Shared helper for seam 4 (shortcut hints). The hint sources under cvat-ui/src/utils/shortcut-hints/ are
// transpiled without type checking and evaluated the way the logging suite does (its loadSource): relative
// imports load for real, a boundary the test names wins, every other path alias of the UI build is an inert stub.
const { dependency, domWindow, loadSource } = require('../team-analytics-logging/helper.cjs');

const HINTS = 'cvat-ui/src/utils/shortcut-hints';

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** One file of the hint module, e.g. 'policy.ts'. Every call evaluates fresh module instances. */
function loadHints(file, boundaries = {}) {
    return loadSource(`${HINTS}/${file}`, boundaries);
}

module.exports = {
    DAY, HOUR, MINUTE, dependency, domWindow, loadHints, loadSource,
};
