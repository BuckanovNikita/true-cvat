// The entry points of the hint module (index.ts) over the browser's storage: the limits of policy.ts are kept
// in localStorage, so a page reload does not reset them; a storage that fails or holds something unreadable
// never breaks the caller.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DAY, HOUR, MINUTE, domWindow, loadHints,
} = require('./helper.cjs');

const START = Date.parse('2026-11-22T09:00:00Z');
const KEY = 'shortcutHints';

/** A browser whose localStorage is `storage`; `open()` loads the hint module anew, as a page load does. */
function browser(t, storage = domWindow().localStorage) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => storage });
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
        else delete globalThis.localStorage;
    });
    return { storage, open: (boundaries) => loadHints('index.ts', boundaries) };
}

function mouseTimes(hints, action, times, at) {
    return Array.from({ length: times }, (_, i) => hints.mouseUsed(action, at + i * 1000));
}

test('mouse uses before a page reload count after it', (t) => {
    const { open } = browser(t);
    assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 2, START), [false, false]);
    assert.equal(open().mouseUsed('SWITCH_LOCK', START + MINUTE), true);
});

test('a hint shown before a page reload holds the next one back after it', (t) => {
    const { open } = browser(t);
    assert.equal(mouseTimes(open(), 'SWITCH_LOCK', 3, START)[2], true);
    const reloaded = open();
    assert.deepEqual(mouseTimes(reloaded, 'SWITCH_LOCK', 3, START + 10 * MINUTE), [false, false, false]);
    assert.deepEqual(mouseTimes(reloaded, 'SWITCH_HIDDEN', 3, START + MINUTE), [false, false, false]);
});

test('a hotkey press before a page reload silences the hint after it', (t) => {
    const { open } = browser(t);
    open().shortcutPressed('SWITCH_LOCK', START);
    assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START + DAY), [false, false, false]);
    assert.equal(mouseTimes(open(), 'SWITCH_LOCK', 3, START + 3 * DAY + MINUTE)[2], true);
});

test('a held hotkey does not write the storage on every press', (t) => {
    let writes = 0;
    const real = domWindow().localStorage;
    const { open } = browser(t, {
        getItem: (key) => real.getItem(key),
        setItem: (key, value) => { writes += 1; real.setItem(key, value); },
    });
    const hints = open();
    for (let i = 0; i < 200; i += 1) hints.shortcutPressed('NEXT_FRAME', START + i * 50);
    assert.equal(writes, 1);
    // an hour on, the silence is renewed
    hints.shortcutPressed('NEXT_FRAME', START + HOUR + MINUTE);
    assert.equal(writes, 2);
    assert.deepEqual(mouseTimes(hints, 'NEXT_FRAME', 3, START + 3 * DAY + 30 * MINUTE), [false, false, false]);
});

// A silence noted before the clock was set back ends too far ahead to hold (policy.ts drops it): the press
// after the clock change has to note its own.
test('a hotkey press after the clock was set back silences the hint anew', (t) => {
    const { open } = browser(t);
    const hints = open();
    hints.shortcutPressed('SWITCH_LOCK', START);
    hints.shortcutPressed('SWITCH_LOCK', START - 2 * HOUR);
    assert.deepEqual(mouseTimes(hints, 'SWITCH_LOCK', 3, START - 2 * HOUR + MINUTE), [false, false, false]);
});

test('the hotkey of an action no control stands for is not remembered', (t) => {
    const { open, storage } = browser(t);
    open().shortcutPressed('SWITCH_SHORTCUTS', START);
    assert.equal(storage.getItem(KEY), null);
});

test('a storage that cannot be used keeps the limits in memory, for this page load', (t) => {
    const { open } = browser(t, {
        getItem() { throw new Error('storage is blocked'); },
        setItem() { throw new Error('storage is blocked'); },
    });
    const hints = open();
    assert.deepEqual(mouseTimes(hints, 'SWITCH_LOCK', 3, START), [false, false, true]);
    assert.deepEqual(mouseTimes(hints, 'SWITCH_LOCK', 3, START + MINUTE), [false, false, false]);
});

// A full storage still answers reads: what it holds is then older than what the page knows.
test('a storage that stops taking writes does not bring old state back: the limits still hold', (t) => {
    const real = domWindow().localStorage;
    let full = false;
    const { open } = browser(t, {
        getItem: (key) => real.getItem(key),
        setItem: (key, value) => {
            if (full) throw new Error('QuotaExceededError');
            real.setItem(key, value);
        },
    });
    const hints = open();
    assert.deepEqual(mouseTimes(hints, 'SWITCH_LOCK', 2, START), [false, false]);
    full = true;
    // the third use is hinted once; the stored state (two uses, no hint shown) must not decide the next ones
    assert.deepEqual(mouseTimes(hints, 'SWITCH_LOCK', 5, START + MINUTE), [true, false, false, false, false]);
    assert.deepEqual(mouseTimes(hints, 'SWITCH_HIDDEN', 3, START + MINUTE + 10000), [false, false, false]);
    hints.shortcutPressed('SWITCH_PINNED', START + 2 * MINUTE);
    assert.deepEqual(mouseTimes(hints, 'SWITCH_PINNED', 3, START + 5 * MINUTE), [false, false, false]);
});

test('once the storage takes writes again, it is written and read as before', (t) => {
    const real = domWindow().localStorage;
    let full = true;
    const { open } = browser(t, {
        getItem: (key) => real.getItem(key),
        setItem: (key, value) => {
            if (full) throw new Error('QuotaExceededError');
            real.setItem(key, value);
        },
    });
    const hints = open();
    assert.deepEqual(mouseTimes(hints, 'SWITCH_LOCK', 2, START), [false, false]);
    full = false;
    assert.equal(hints.mouseUsed('SWITCH_LOCK', START + MINUTE), true);
    // a page load later the hint shown is known
    assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START + 2 * MINUTE), [false, false, false]);
});

test('no storage at all keeps the limits in memory too', (t) => {
    const { open } = browser(t, undefined);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => undefined });
    assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START), [false, false, true]);
});

for (const [what, stored] of [
    ['is not JSON', '{"version": 1, "mouseUses"'],
    ['is of another version', JSON.stringify({
        version: 99, mouseUses: {}, lastShown: {}, shown: [], silencedUntil: { SWITCH_LOCK: START + 10 * DAY },
    })],
    ['has another shape', JSON.stringify({
        version: 1, mouseUses: { SWITCH_LOCK: 'twice' }, lastShown: [], shown: {}, silencedUntil: null,
    })],
    ['is not an object', '"none"'],
]) {
    test(`a stored state that ${what} is started over`, (t) => {
        const { open, storage } = browser(t);
        storage.setItem(KEY, stored);
        assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START), [false, false, true]);
        assert.equal(JSON.parse(storage.getItem(KEY)).version, 1);
    });
}

test('a failure inside the hint code never reaches the caller, and switches the hints off', (t) => {
    const { open } = browser(t);
    let asked = 0;
    const warnings = [];
    const real = loadHints('policy.ts');
    t.mock.method(console, 'warn', (...args) => { warnings.push(args); });
    const hints = open({
        './policy': {
            ...real,
            mouseUsed() { asked += 1; throw new Error('a defect'); },
        },
    });
    assert.equal(hints.mouseUsed('SWITCH_LOCK', START), false);
    assert.equal(hints.mouseUsed('SWITCH_LOCK', START + 1000), false);
    hints.shortcutPressed('SWITCH_LOCK', START + 2000);
    assert.equal(asked, 1);
    assert.equal(hints.switchedOff(), true);
});
