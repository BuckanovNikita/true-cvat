// What a hint says (content.ts): the name of the action and the keys of its shortcuts, for a control of the
// table, the person's shortcuts and the shortcuts bound right now.
const test = require('node:test');
const assert = require('node:assert/strict');

const { loadHints } = require('./helper.cjs');

const SHORTCUTS = {
    keyMap: { NEXT_FRAME: { name: 'Next frame' }, RARE: {} },
    normalizedKeyMap: { NEXT_FRAME: '[F]', RARE: '[Shift+Arrow Left, Q]', SEQUENCE: '[T L]' },
};
const BOUND = { NEXT_FRAME: {}, RARE: {}, SEQUENCE: {} };

test('a control with a Russian name is named in Russian', () => {
    const { hintOf } = loadHints('content.ts');
    assert.deepEqual(
        hintOf({ selector: '.next', actions: ['NEXT_FRAME'], name: 'Следующий кадр' }, SHORTCUTS, BOUND),
        { action: 'NEXT_FRAME', name: 'Следующий кадр', keys: ['F'] },
    );
});

test('a control without a Russian name is named as CVAT\'s keymap names its action', () => {
    const { hintOf } = loadHints('content.ts');
    assert.equal(hintOf({ selector: '.next', actions: ['NEXT_FRAME'] }, SHORTCUTS, BOUND).name, 'Next frame');
});

test('a control that neither the table nor the keymap names has no hint', () => {
    const { hintOf } = loadHints('content.ts');
    assert.equal(hintOf({ selector: '.rare', actions: ['RARE'] }, SHORTCUTS, BOUND), null);
    assert.equal(hintOf({ selector: '.unknown', actions: ['UNKNOWN'] }, SHORTCUTS, { UNKNOWN: {} }), null);
});

test('of several keys of one shortcut the first is shown, whole', () => {
    const { hintOf } = loadHints('content.ts');
    assert.deepEqual(hintOf({ selector: '.rare', actions: ['RARE'], name: 'Редкое' }, SHORTCUTS, BOUND).keys, [
        'Shift+Arrow Left',
    ]);
    assert.deepEqual(hintOf({ selector: '.all', actions: ['SEQUENCE'], name: 'Все' }, SHORTCUTS, BOUND).keys, ['T L']);
});
