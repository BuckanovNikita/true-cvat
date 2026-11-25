// Which shortcut does what a click did (controls.ts, resolve.ts): a click is traced to a control by the class
// names CVAT's own components give their controls. The page below is written the way those components render.
const test = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const { domWindow, loadHints } = require('./helper.cjs');

const PAGE = `<!doctype html><html><body>
  <div class="cvat-annotation-header">
    <button id="save" class="cvat-annotation-header-save-button cvat-annotation-header-button"><span class="anticon"><svg id="save-icon"></svg></span></button>
    <button id="saving" class="cvat-annotation-header-save-button cvat-annotation-disabled-header-button"></button>
    <button id="undo" class="cvat-annotation-header-undo-button cvat-annotation-header-button" disabled><span id="undo-icon"></span></button>
    <span id="next-filtered" class="anticon cvat-player-next-button-filtered"></span>
    <span id="frame-text">128</span>
  </div>
  <div class="cvat-canvas-controls-sidebar">
    <span id="merge" class="anticon cvat-merge-control cvat-active-canvas-control"></span>
    <span id="merge-disabled" class="anticon cvat-merge-control cvat-disabled-canvas-control"></span>
  </div>
  <div class="ant-popover">
    <button id="draw-polygon" class="ant-btn cvat-draw-polygon-shape-button"><span id="draw-polygon-text">Shape</span></button>
    <button id="draw-track" class="ant-btn cvat-draw-rectangle-track-button">Track</button>
  </div>
  <div class="cvat-objects-sidebar">
    <div class="cvat-objects-sidebar-states-header"><span id="lock-all" class="anticon anticon-unlock"></span></div>
    <span id="lock" class="anticon cvat-object-item-button-lock"><svg id="lock-icon"></svg></span>
    <span id="next-keyframe" class="anticon cvat-object-item-button-next-keyframe"></span>
    <span id="keyframe" class="anticon cvat-object-item-button-keyframe cvat-object-item-button-keyframe-enabled"></span>
    <div id="item-text">1 RECTANGLE SHAPE</div>
  </div>
  <div class="ant-dropdown">
    <button id="copy" class="ant-btn cvat-object-item-menu-make-copy">Make a copy</button>
    <button id="remove" class="ant-btn cvat-object-item-menu-remove-object">Remove</button>
  </div>
  <div class="cvat-canvas-selected-objects-quick-actions">
    <button id="selection-lock" class="ant-btn cvat-object-item-button-lock-enabled" aria-label="Unlock selection"></button>
    <button id="selection-delete" class="ant-btn" aria-label="Delete selection"><span id="selection-delete-icon"></span></button>
  </div>
</body></html>`;

function page() {
    const { controlOf } = loadHints('resolve.ts');
    const { document } = domWindow(PAGE);
    return { actions: (id) => controlOf(document.getElementById(id))?.actions ?? null };
}

test('a click on a control, or on the icon inside it, is traced to the shortcut action of the control', () => {
    const { actions } = page();
    assert.deepEqual(actions('save'), ['SAVE_JOB']);
    assert.deepEqual(actions('save-icon'), ['SAVE_JOB']);
    assert.deepEqual(actions('lock-icon'), ['SWITCH_LOCK']);
    assert.deepEqual(actions('merge'), ['SWITCH_MERGE_MODE_STANDARD_CONTROLS']);
    assert.deepEqual(actions('next-filtered'), ['NEXT_FRAME']);
    assert.deepEqual(actions('lock-all'), ['SWITCH_ALL_LOCK']);
});

test('controls that share a name stem are told apart', () => {
    const { actions } = page();
    assert.deepEqual(actions('keyframe'), ['SWITCH_KEYFRAME']);
    assert.deepEqual(actions('next-keyframe'), ['NEXT_KEY_FRAME']);
});

test('the draw buttons of every shape are traced to the draw mode shortcut', () => {
    const { actions } = page();
    assert.deepEqual(actions('draw-polygon-text'), ['SWITCH_DRAW_MODE_STANDARD_CONTROLS']);
    assert.deepEqual(actions('draw-track'), ['SWITCH_DRAW_MODE_STANDARD_CONTROLS']);
});

test('the quick actions of a selection are traced like the buttons of one object', () => {
    const { actions } = page();
    assert.deepEqual(actions('selection-lock'), ['SWITCH_LOCK']);
    assert.deepEqual(actions('selection-delete-icon'), ['DELETE_OBJECT_STANDARD_WORKSPACE']);
});

test('making a copy takes two shortcuts, in the order they are pressed', () => {
    const { actions } = page();
    assert.deepEqual(actions('copy'), ['COPY_SHAPE', 'PASTE_SHAPE']);
});

test('a disabled control does nothing, so it is traced to nothing', () => {
    const { actions } = page();
    assert.equal(actions('saving'), null);
    assert.equal(actions('undo-icon'), null);
    assert.equal(actions('merge-disabled'), null);
});

test('a click elsewhere, and what is not an element, is traced to nothing', () => {
    const { actions } = page();
    const { controlOf } = loadHints('resolve.ts');
    assert.equal(actions('frame-text'), null);
    assert.equal(actions('item-text'), null);
    assert.equal(controlOf(null), null);
    assert.equal(controlOf({}), null);
});

// CVAT gives "Remove" and "Run annotation action" of the object menu the same class: a click on either cannot
// be told from the other, so neither is hinted.
test('the object menu items CVAT gives one class to are traced to nothing', () => {
    const { actions } = page();
    assert.equal(actions('remove'), null);
});

// --- the table against CVAT's own sources ----------------------------------------------------------------------

const uiSrc = path.resolve(__dirname, '../../cvat-ui/src');
const OWN = path.join(uiSrc, 'utils', 'shortcut-hints');

function sources(directory) {
    return readdirSync(directory).flatMap((name) => {
        const entry = path.join(directory, name);
        if (statSync(entry).isDirectory()) return entry === OWN ? [] : sources(entry);
        return /\.tsx?$/.test(name) ? [readFileSync(entry, 'utf8')] : [];
    });
}

test('every class name and shortcut action of the table still exists in CVAT\'s sources', () => {
    const { CONTROLS } = loadHints('controls.ts');
    const text = sources(uiSrc).join('\n');
    const missing = [];
    for (const control of CONTROLS) {
        const names = control.selector.match(/cvat-[a-z0-9-]*[a-z0-9]/g) ?? [];
        for (const name of names) {
            // `cvat-draw-` stands for the classes CVAT builds per shape
            const present = name === 'cvat-draw' ?
                // eslint-disable-next-line no-template-curly-in-string
                ['cvat-draw-${shapeType}-shape-button', 'cvat-draw-${shapeType}-track-button']
                    .every((built) => text.includes(built)) :
                new RegExp(`${name}(?![a-z0-9-])`).test(text);
            if (!present) missing.push(name);
        }
        for (const label of control.selector.match(/aria-label="[^"]+"/g) ?? []) {
            if (!text.includes(label.replace(/"/g, "'"))) missing.push(label);
        }
        for (const action of control.actions) {
            if (!new RegExp(`\\b${action}: \\{`).test(text)) missing.push(action);
        }
        assert.ok(names.length > 0, `${control.selector} names a class of CVAT`);
    }
    assert.deepEqual(missing, []);
});

test('every control of the table has a Russian name', () => {
    const { CONTROLS } = loadHints('controls.ts');
    assert.ok(CONTROLS.length >= 35, `the table lists ${CONTROLS.length} controls`);
    for (const control of CONTROLS) {
        assert.match(control.name ?? '', /^[А-ЯЁ][а-яё ,/«»-]+$/, `the name of ${control.actions[0]}`);
    }
});
