// Seam 4: shortcut hints (UI-3), the hint an annotator sees after doing by mouse what a hotkey does.
// Run after installing cvat's dependencies and the harness's own (npm ci --prefix verify):
//   node --test verify/shortcut_hints.cjs
// Without the harness's dependencies the suite fails and names what is missing (browser-environment.cjs).
// Each topic is one file under verify/shortcut-hints/ (`*.test.cjs`), sharing helper.cjs.
const { readdirSync } = require('node:fs');
const path = require('node:path');

const directory = path.join(__dirname, 'shortcut-hints');
for (const file of readdirSync(directory).filter((name) => name.endsWith('.test.cjs')).sort()) {
    require(path.join(directory, file));
}
