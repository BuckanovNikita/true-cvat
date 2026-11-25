// The hint on the screen (components/shortcut-hints/shortcut-hint-host.tsx), mounted in a jsdom page over a
// redux store with the person's shortcuts and the open job. Clicks go to the window as a browser sends them;
// shortcuts go through the UI's single shortcut dispatcher (utils/mousetrap-react.tsx, with Mousetrap supplied),
// which also tells the hints that a shortcut was used.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    React, act, dependency, mount,
} = require('../team-analytics-page/helper.cjs');
const { MINUTE, loadHints, loadSource } = require('./helper.cjs');

const { Provider } = dependency('react-redux');
const { createStore } = dependency('redux');

const HOST = 'cvat-ui/src/components/shortcut-hints/shortcut-hint-host.tsx';
const START = Date.parse('2026-11-22T09:00:00Z');

// CVAT's own keymap, as its components register it
const KEY_MAP = {
    SWITCH_LOCK: { name: 'Lock/unlock an object', sequences: ['l'] },
    SAVE_JOB: { name: 'Save the job', sequences: ['ctrl+s'] },
    COPY_SHAPE: { name: 'Copy shape', sequences: ['ctrl+c'] },
    PASTE_SHAPE: { name: 'Paste shape', sequences: ['ctrl+v'] },
    TO_FOREGROUND: { name: 'Move to foreground', sequences: ['+', '='] },
    TO_ONE_LAYER_FORWARD: { name: 'Move one layer forward', sequences: [] },
    CLOCKWISE_ROTATION_STANDARD_CONTROLS: { name: 'Rotate clockwise', sequences: ['ctrl+r'] },
};
// what the shortcuts store shows for them (reducers/shortcuts-reducer.ts, formatShortcuts)
const SHOWN_KEYS = {
    SWITCH_LOCK: '[L]',
    SAVE_JOB: '[Ctrl+S]',
    COPY_SHAPE: '[Ctrl+C]',
    PASTE_SHAPE: '[Ctrl+V]',
    TO_FOREGROUND: '[+, =]',
    TO_ONE_LAYER_FORWARD: '',
    CLOCKWISE_ROTATION_STANDARD_CONTROLS: '[Ctrl+R]',
};

const CANVAS = '<div id="canvas" class="cvat-canvas-container"></div>';
const CONTROLS = `
  <button id="save" class="cvat-annotation-header-save-button"></button>
  <span id="lock" class="cvat-object-item-button-lock"></span>
  <button id="copy" class="cvat-object-item-menu-make-copy"></button>
  <button id="foreground" class="cvat-object-item-menu-to-layer-foreground"></button>
  <button id="layer-forward" class="cvat-object-item-menu-to-one-layer-forward"></button>
  <span id="rotate" class="cvat-rotate-canvas-controls-right"></span>
  <span id="elsewhere"></span>`;

/**
 * The annotation view of `job` for a person whose shortcuts show as `shownKeys`; `bound` are the actions whose
 * shortcuts the open workspace has bound. The hint stays `shownMs` on the screen.
 */
async function annotationView(t, {
    job = { dimension: '2d' }, shownKeys = SHOWN_KEYS, bound = Object.keys(KEY_MAP), canvas = true, shownMs = 60000,
    hintOf = null, declined = [],
} = {}) {
    globalThis.localStorage.clear();
    t.mock.timers.enable({ apis: ['Date'], now: START });
    document.body.innerHTML = `${canvas ? CANVAS : ''}${CONTROLS}`;

    const hints = loadHints('index.ts');
    const bindings = {};
    const mousetrap = {
        bind(sequences, callback) { for (const sequence of [].concat(sequences)) bindings[sequence] = callback; },
        unbind(sequences) { for (const sequence of [].concat(sequences)) delete bindings[sequence]; },
        prototype: {},
    };
    const hotkeys = loadSource('cvat-ui/src/utils/mousetrap-react.tsx', {
        mousetrap: { __esModule: true, default: mousetrap },
        'utils/shortcut-hints': hints,
    });
    const { default: ShortcutHintHost } = loadSource(HOST, {
        // `hintOf`, when a test names one, replaces what the hint says (to make drawing it fail)
        'utils/shortcut-hints': hintOf ? { ...hints, hintOf } : hints,
        'utils/mousetrap-react': hotkeys,
        // cvat-core's own enums (DimensionType)
        'cvat-core-wrapper': loadSource('cvat-core/src/enums.ts'),
    });

    const keyMap = Object.fromEntries(Object.entries(KEY_MAP).map(([action, item]) => [
        action, { description: item.name, scope: 0, ...item },
    ]));
    const store = createStore((state, action) => action.state ?? state, {
        shortcuts: { keyMap, normalizedKeyMap: shownKeys },
        annotation: { job: { instance: job } },
    });
    const view = await mount(React.createElement(
        Provider,
        { store },
        React.createElement(hotkeys.default, {
            keyMap: Object.fromEntries(bound.map((action) => [action, keyMap[action]])),
            // a handler returns true to let the browser have the key (Ctrl+C over selected text, say)
            handlers: Object.fromEntries(bound.map((action) => [
                action, () => (declined.includes(action) ? true : undefined),
            ])),
        }),
        React.createElement(ShortcutHintHost, { shownMs }),
        // the rest of the application, beside the hints in the same React tree
        React.createElement('span', { id: 'rest-of-the-application' }),
    ));
    t.after(async () => {
        await view.unmount();
        document.body.innerHTML = '';
    });

    const page = {
        hints,
        store,
        async click(id, times = 1) {
            for (let i = 0; i < times; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await act(async () => {
                    // detail: the number of presses of the mouse button, as a browser sets it
                    document.getElementById(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 1 }));
                });
            }
        },
        /** The click a browser makes of Enter or Space on a focused control: no mouse button was pressed. */
        async keyboardClick(id, times = 1) {
            for (let i = 0; i < times; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await act(async () => {
                    document.getElementById(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 }));
                });
            }
        },
        /** A key press, as Mousetrap passes it to the dispatcher; `init` adds to the event (`repeat`, say). */
        async press(sequence, init = {}) {
            await act(async () => {
                bindings[sequence](new window.KeyboardEvent('keydown', { key: sequence, ...init }), sequence);
            });
        },
        async later(ms) {
            await act(async () => { t.mock.timers.setTime(Date.now() + ms); });
        },
        /** What the hint on the screen says, or null when there is none. */
        hint() {
            const boxes = [...document.querySelectorAll('.cvat-shortcut-hint')];
            assert.ok(boxes.length <= 1, 'at most one hint at a time');
            if (!boxes.length) return null;
            const [box] = boxes;
            return {
                keys: [...box.querySelectorAll('kbd')].map((key) => key.textContent),
                name: box.querySelector('.cvat-shortcut-hint-name').textContent,
                label: box.querySelector('.cvat-shortcut-hint-label').textContent,
                inCanvas: !!box.closest('.cvat-canvas-container'),
            };
        },
    };
    return page;
}

test('the third click on a control shows its shortcut over the canvas, in Russian', async (t) => {
    const page = await annotationView(t);
    await page.click('lock', 2);
    assert.equal(page.hint(), null);
    await page.click('lock');
    assert.deepEqual(page.hint(), {
        keys: ['L'], name: 'Заблокировать или разблокировать объект', label: 'Горячая клавиша', inCanvas: true,
    });
});

test('the hint shows the key the person has set for the shortcut', async (t) => {
    const page = await annotationView(t, { shownKeys: { ...SHOWN_KEYS, SAVE_JOB: '[Alt+W, Ctrl+S]' } });
    await page.click('save', 3);
    assert.deepEqual(page.hint().keys, ['Alt+W']);
});

test('a key that is the plus sign is shown as it is', async (t) => {
    const page = await annotationView(t);
    await page.click('foreground', 3);
    assert.deepEqual(page.hint().keys, ['+']);
});

test('a control that takes two shortcuts shows both keys, in the order they are pressed', async (t) => {
    const page = await annotationView(t);
    await page.click('copy', 3);
    assert.deepEqual(page.hint().keys, ['Ctrl+C', 'Ctrl+V']);
    assert.equal(page.hint().name, 'Сделать копию');
});

test('the hint leaves the screen by itself', async (t) => {
    const page = await annotationView(t, { shownMs: 30 });
    await page.click('lock', 3);
    assert.notEqual(page.hint(), null);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 80)); });
    assert.equal(page.hint(), null);
});

test('a later hint replaces the one on the screen', async (t) => {
    const page = await annotationView(t);
    await page.click('lock', 3);
    await page.later(3 * MINUTE);
    await page.click('save', 3);
    assert.deepEqual(page.hint().keys, ['Ctrl+S']);
});

test('after the person presses the shortcut with no click before it, the clicks are not hinted', async (t) => {
    const page = await annotationView(t);
    await page.press('l');
    await page.click('lock', 5);
    assert.equal(page.hint(), null);
});

// The dispatcher hands the key event on: the repeats of a held key are not counted as presses.
test('a held shortcut counts as one press', async (t) => {
    const page = await annotationView(t);
    await page.click('lock', 2);
    await page.press('l');
    for (let i = 0; i < 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await page.press('l', { repeat: true });
    }
    // one press against two clicks: the third click is hinted
    await page.click('lock');
    assert.deepEqual(page.hint()?.keys, ['L']);
});

for (const [why, options, control] of [
    ['the action has no key', {}, 'layer-forward'],
    ['one of the two actions has no key', { shownKeys: { ...SHOWN_KEYS, PASTE_SHAPE: '' } }, 'copy'],
    ['the workspace has not bound the shortcut', { bound: ['SWITCH_LOCK', 'SAVE_JOB'] }, 'rotate'],
    ['the job is a 3D job', { job: { dimension: '3d' } }, 'lock'],
    ['no job is open', { job: null }, 'lock'],
    ['there is no canvas on the page', { canvas: false }, 'lock'],
]) {
    test(`no hint is shown when ${why}, and such clicks do not count`, async (t) => {
        const page = await annotationView(t, options);
        await page.click(control, 5);
        assert.equal(page.hint(), null);
        assert.equal(globalThis.localStorage.getItem('shortcutHints'), null);
    });
}

// The share weighs presses against clicks: where clicks are not counted, presses are not either, or one press
// there would weigh as all the uses and silence the hint.
for (const [why, options] of [
    ['in a 3D job', { job: { dimension: '3d' } }],
    ['with no job open', { job: null }],
    ['with no canvas on the page', { canvas: false }],
]) {
    test(`a press ${why} is not counted, as the clicks there are not`, async (t) => {
        const page = await annotationView(t, options);
        await page.click('lock', 5);
        await page.press('l');
        assert.equal(globalThis.localStorage.getItem('shortcutHints'), null);
    });
}

// "Make a copy" takes two shortcuts and is hinted under the first: Ctrl+C counts only where a click on it would.
for (const [why, options] of [
    ['the paste shortcut is not bound in the workspace', {
        bound: Object.keys(KEY_MAP).filter((action) => action !== 'PASTE_SHAPE'),
    }],
    ['the paste shortcut has no key', { shownKeys: { ...SHOWN_KEYS, PASTE_SHAPE: '' } }],
]) {
    test(`Ctrl+C is not counted when ${why}`, async (t) => {
        const page = await annotationView(t, options);
        await page.click('copy', 5);
        await page.press('ctrl+c');
        assert.equal(globalThis.localStorage.getItem('shortcutHints'), null);
    });
}

// A handler that returns true leaves the key to the browser (Ctrl+C over selected text copies the text): the
// action was not done, so the press is not counted. One that takes the key is.
for (const [why, declined, counted] of [
    ['the copy handler lets the browser have the key', ['COPY_SHAPE'], false],
    ['the copy handler takes the key', [], true],
]) {
    test(`Ctrl+C is ${counted ? '' : 'not '}counted when ${why}`, async (t) => {
        const page = await annotationView(t, { declined });
        await page.press('ctrl+c');
        assert.equal(globalThis.localStorage.getItem('shortcutHints') !== null, counted);
    });
}

test('a press in a 3D job does not silence the hint in a 2D job', async (t) => {
    const page = await annotationView(t, { job: { dimension: '3d' } });
    await page.press('l');
    await act(async () => {
        const twoD = { annotation: { job: { instance: { dimension: '2d' } } } };
        page.store.dispatch({ type: 'job', state: { ...page.store.getState(), ...twoD } });
    });
    await page.click('lock', 3);
    assert.deepEqual(page.hint()?.keys, ['L']);
});

test('a control used from the keyboard (Enter or Space on it) is no mouse use', async (t) => {
    const page = await annotationView(t);
    await page.keyboardClick('save', 5);
    assert.equal(page.hint(), null);
    assert.equal(globalThis.localStorage.getItem('shortcutHints'), null);
    await page.click('save', 3);
    assert.notEqual(page.hint(), null, 'three clicks of the mouse are hinted as usual');
});

test('a click on something that is no control shows nothing', async (t) => {
    const page = await annotationView(t);
    await page.click('elsewhere', 5);
    assert.equal(page.hint(), null);
});

test('a failure while handling a click stays inside the hints and switches them off', async (t) => {
    const page = await annotationView(t);
    const failures = [];
    const onError = (event) => { failures.push(event); };
    window.addEventListener('error', onError);
    t.after(() => window.removeEventListener('error', onError));
    t.mock.method(console, 'warn', () => {});
    await act(async () => {
        page.store.dispatch({
            type: 'set',
            state: {
                shortcuts: { keyMap: {}, get normalizedKeyMap() { throw new Error('a defect'); } },
                annotation: { job: { instance: { dimension: '2d' } } },
            },
        });
    });
    await page.click('lock', 3);
    assert.equal(page.hint(), null);
    assert.deepEqual(failures, []);
    assert.equal(page.hints.switchedOff(), true);
});

test('a failure while the hint is drawn takes the hint away and leaves the rest of the page', async (t) => {
    const broken = { action: 'SWITCH_LOCK', name: 'Заблокировать объект', keys: null };
    const page = await annotationView(t, { hintOf: () => broken });
    t.mock.method(console, 'error', () => {});
    t.mock.method(console, 'warn', () => {});
    await page.click('lock', 3);
    assert.equal(page.hint(), null);
    assert.notEqual(document.getElementById('rest-of-the-application'), null, 'what React draws beside the hints stays');
    assert.equal(page.hints.switchedOff(), true);
    // and nothing more is tried
    await page.later(3 * MINUTE);
    await page.click('save', 3);
    assert.equal(page.hint(), null);
});
