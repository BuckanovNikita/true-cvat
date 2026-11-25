// The entry points of the hint module (index.ts) over the browser's storage: the limits of policy.ts and the
// counts of mouse uses and hotkey presses they weigh are kept in localStorage, so a page reload does not reset
// them; a held key counts once; a storage that fails or holds something unreadable never breaks the caller.
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
    // presses count where a mounted host says clicks count (host.test.cjs); here, everywhere
    const open = (boundaries) => {
        const hints = loadHints('index.ts', boundaries);
        hints.countPressesWhile(() => true);
        return hints;
    };
    return { storage, open };
}

function mouseTimes(hints, action, times, at) {
    return Array.from({ length: times }, (_, i) => hints.mouseUsed(action, at + i * 1000));
}

test('without a host that says where clicks count, a press counts nothing', (t) => {
    const { storage } = browser(t);
    const hints = loadHints('index.ts');
    hints.shortcutPressed('SWITCH_LOCK', null, START);
    assert.equal(storage.getItem(KEY), null);
    hints.countPressesWhile(() => true);
    hints.countPressesWhile(null);
    hints.shortcutPressed('SWITCH_LOCK', null, START);
    assert.equal(storage.getItem(KEY), null);
});

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
    open().shortcutPressed('SWITCH_LOCK', null, START);
    assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START + DAY), [false, false, false]);
    assert.equal(mouseTimes(open(), 'SWITCH_LOCK', 3, START + 3 * DAY + MINUTE)[2], true);
});

test('the counts of mouse uses and hotkey presses survive page reloads', (t) => {
    const { open } = browser(t);
    mouseTimes(open(), 'SWITCH_LOCK', 2, START);
    // one press against the two mouse uses before the reload, then two against two: neither silences
    open().shortcutPressed('SWITCH_LOCK', null, START + MINUTE);
    open().shortcutPressed('SWITCH_LOCK', null, START + 2 * MINUTE);
    assert.equal(open().mouseUsed('SWITCH_LOCK', START + 3 * MINUTE), true);
    // three presses against three mouse uses is half; the fourth press silences
    open().shortcutPressed('SWITCH_LOCK', null, START + 4 * MINUTE);
    assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(KEY)).silencedUntil, {});
    open().shortcutPressed('SWITCH_LOCK', null, START + 5 * MINUTE);
    assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START + 2 * HOUR), [false, false, false]);
});

// The browser repeats the keydown of a held key many times a second (event.repeat): only the press counts.
test('a held hotkey counts once and writes the storage once', (t) => {
    let writes = 0;
    const real = domWindow().localStorage;
    const { open } = browser(t, {
        getItem: (key) => real.getItem(key),
        setItem: (key, value) => { writes += 1; real.setItem(key, value); },
    });
    const hints = open();
    mouseTimes(hints, 'NEXT_FRAME', 2, START);
    writes = 0;
    hints.shortcutPressed('NEXT_FRAME', { repeat: false }, START + MINUTE);
    for (let i = 1; i <= 200; i += 1) hints.shortcutPressed('NEXT_FRAME', { repeat: true }, START + MINUTE + i * 50);
    assert.equal(writes, 1);
    // one press against two mouse uses: the third mouse use is hinted
    assert.equal(hints.mouseUsed('NEXT_FRAME', START + 2 * MINUTE), true);
});

test('a press without an event counts as a press', (t) => {
    const { open } = browser(t);
    const hints = open();
    hints.shortcutPressed('NEXT_FRAME', undefined, START);
    assert.deepEqual(mouseTimes(hints, 'NEXT_FRAME', 3, START + MINUTE), [false, false, false]);
});

// A silence noted before the clock was set back ends too far ahead to hold (policy.ts drops it): the press
// after the clock change has to note its own.
// Every press counts, a press during a silence too: nothing between the dispatcher and the rules skips one.
// One module instance for all presses, as within one page load.
test('a hotkey press while the hint is silenced is counted', (t) => {
    const { open, storage } = browser(t);
    const hints = open();
    hints.shortcutPressed('SWITCH_LOCK', null, START);
    hints.shortcutPressed('SWITCH_LOCK', null, START + MINUTE);
    assert.deepEqual(JSON.parse(storage.getItem(KEY)).uses.SWITCH_LOCK, [[START, 0, 1], [START + MINUTE, 0, 1]]);
});

test('presses during a silence that keep the share above half renew it', (t) => {
    const { open } = browser(t);
    const hints = open();
    hints.shortcutPressed('SWITCH_LOCK', null, START);
    hints.shortcutPressed('SWITCH_LOCK', null, START + 30 * MINUTE);
    hints.shortcutPressed('SWITCH_LOCK', null, START + 31 * MINUTE);
    mouseTimes(hints, 'SWITCH_LOCK', 2, START + 40 * MINUTE);
    // three presses against two mouse uses within the hour: more than half, the silence runs from this press
    hints.shortcutPressed('SWITCH_LOCK', null, START + 65 * MINUTE);
    assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START + 3 * DAY + 10 * MINUTE), [false, false, false]);
});

test('a hotkey press after the clock was set back silences the hint anew', (t) => {
    const { open } = browser(t);
    const hints = open();
    hints.shortcutPressed('SWITCH_LOCK', null, START);
    hints.shortcutPressed('SWITCH_LOCK', null, START - 2 * HOUR);
    assert.deepEqual(mouseTimes(hints, 'SWITCH_LOCK', 3, START - 2 * HOUR + MINUTE), [false, false, false]);
});

test('the hotkey of an action no control stands for is not remembered', (t) => {
    const { open, storage } = browser(t);
    open().shortcutPressed('SWITCH_SHORTCUTS', null, START);
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
    hints.shortcutPressed('SWITCH_PINNED', null, START + 2 * MINUTE);
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

const SILENCED = { SWITCH_LOCK: START + DAY };
for (const [what, stored] of [
    ['is not JSON', '{"version": 2, "mouseUses"'],
    ['is of another version', JSON.stringify({
        version: 99, mouseUses: {}, lastShown: {}, shown: [], silencedUntil: SILENCED, uses: {},
    })],
    // the first version had no counts of the uses
    ['is of the first version', JSON.stringify({
        version: 1, mouseUses: {}, lastShown: {}, shown: [], silencedUntil: SILENCED,
    })],
    ['has another shape', JSON.stringify({
        version: 2, mouseUses: { SWITCH_LOCK: 'twice' }, lastShown: [], shown: {}, silencedUntil: null, uses: {},
    })],
    ['has no counts of the uses', JSON.stringify({
        version: 2, mouseUses: {}, lastShown: {}, shown: [], silencedUntil: SILENCED,
    })],
    ...[
        ['a count that is not a triple', [[START, 1]]],
        ['a negative count', [[START, -1, 0]]],
        ['a count that is not a number', [[START, '1', 0]]],
        ['counts that are not a list', { [START]: [1, 0] }],
    ].map(([how, counts]) => [`holds ${how}`, JSON.stringify({
        version: 2, mouseUses: {}, lastShown: {}, shown: [], silencedUntil: SILENCED, uses: { SWITCH_LOCK: counts },
    })]),
    ['is not an object', '"none"'],
]) {
    test(`a stored state that ${what} is started over`, (t) => {
        const { open, storage } = browser(t);
        storage.setItem(KEY, stored);
        assert.deepEqual(mouseTimes(open(), 'SWITCH_LOCK', 3, START), [false, false, true]);
        assert.equal(JSON.parse(storage.getItem(KEY)).version, 2);
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
    hints.shortcutPressed('SWITCH_LOCK', null, START + 2000);
    assert.equal(asked, 1);
    assert.equal(hints.switchedOff(), true);
});
