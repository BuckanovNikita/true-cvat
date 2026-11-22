// When a hint is shown (policy.ts): an action is hinted from its third mouse use within an hour, then at most
// once an hour; overall at most one hint per two minutes and ten per hour; a press of the action's hotkey
// silences its hint for three days.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DAY, HOUR, MINUTE, loadHints,
} = require('./helper.cjs');

const START = Date.parse('2026-11-22T09:00:00Z');

/** The rules over one person's state: `mouse(action, at)` says whether that mouse use is hinted. */
function person() {
    const policy = loadHints('policy.ts');
    let state = policy.emptyState();
    return {
        mouse(action, at) {
            const result = policy.mouseUsed(state, action, at);
            state = result.state;
            return result.show;
        },
        hotkey(action, at) {
            state = policy.hotkeyPressed(state, action, at);
        },
        /** `times` mouse uses a second apart starting at `at`; the answers. */
        mouseTimes(action, times, at) {
            return Array.from({ length: times }, (_, i) => this.mouse(action, at + i * 1000));
        },
        state: () => state,
    };
}

test('the third mouse use of an action within an hour is hinted, the first two are not', () => {
    const annotator = person();
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START), [false, false, true]);
});

test('three mouse uses spread over more than an hour are not hinted', () => {
    const annotator = person();
    assert.equal(annotator.mouse('SAVE_JOB', START), false);
    assert.equal(annotator.mouse('SAVE_JOB', START + 40 * MINUTE), false);
    assert.equal(annotator.mouse('SAVE_JOB', START + 80 * MINUTE), false);
});

test('an action is hinted at most once an hour', () => {
    const annotator = person();
    annotator.mouseTimes('SWITCH_LOCK', 3, START);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 5, START + 30 * MINUTE), [false, false, false, false, false]);
    // an hour after its hint, the action is still done by mouse: three uses within the last hour
    assert.equal(annotator.mouse('SWITCH_LOCK', START + 61 * MINUTE), true);
});

test('an hour after its hint, an action no longer done by mouse three times an hour is not hinted', () => {
    const annotator = person();
    annotator.mouseTimes('SWITCH_LOCK', 3, START);
    assert.equal(annotator.mouse('SWITCH_LOCK', START + 90 * MINUTE), false);
});

test('two hints are at least two minutes apart, whatever the actions', () => {
    const annotator = person();
    assert.equal(annotator.mouseTimes('SWITCH_LOCK', 3, START)[2], true);
    assert.deepEqual(annotator.mouseTimes('SWITCH_HIDDEN', 3, START + MINUTE), [false, false, false]);
    // the action is still due: its next mouse use after the two minutes is hinted
    assert.equal(annotator.mouse('SWITCH_HIDDEN', START + 2 * MINUTE + 3000), true);
});

test('no more than ten hints are shown within an hour', () => {
    const annotator = person();
    const shown = [];
    for (let i = 0; i < 11; i += 1) {
        shown.push(annotator.mouseTimes(`ACTION_${i}`, 3, START + i * 3 * MINUTE)[2]);
    }
    assert.deepEqual(shown, [true, true, true, true, true, true, true, true, true, true, false]);
    // the first hint is over an hour old: there is room for one more
    assert.equal(annotator.mouse('ACTION_10', START + 61 * MINUTE), true);
});

test('a press of the hotkey silences the hint of its action for three days', () => {
    const annotator = person();
    annotator.hotkey('SWITCH_LOCK', START);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 4, START + MINUTE), [false, false, false, false]);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 4, START + 3 * DAY - MINUTE), [false, false, false, false]);
    // other actions are not silenced
    assert.equal(annotator.mouseTimes('SWITCH_HIDDEN', 3, START + 2 * HOUR)[2], true);
});

test('three days after the hotkey press, an action done by mouse again is hinted again', () => {
    const annotator = person();
    annotator.hotkey('SWITCH_LOCK', START);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START + 3 * DAY + MINUTE), [false, false, true]);
});

// The clock of a computer can be set back (a correction, another time zone set by hand): what was noted at a
// time that is now in the future says nothing about the last hour.
test('after the clock is set back, a hint shown "in the future" holds no hint back', () => {
    const annotator = person();
    assert.equal(annotator.mouseTimes('SWITCH_LOCK', 3, START)[2], true);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START - DAY), [false, false, true]);
    assert.equal(annotator.mouseTimes('SWITCH_HIDDEN', 3, START - DAY + 3 * MINUTE)[2], true);
});

test('after the clock is set back, a silence never lasts longer than three days', () => {
    const annotator = person();
    annotator.hotkey('SWITCH_LOCK', START);
    // ten days earlier the silence would end in thirteen days: it is dropped instead
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START - 10 * DAY), [false, false, true]);
});

test('the state keeps only what the rules still need', () => {
    const annotator = person();
    annotator.mouseTimes('SWITCH_LOCK', 50, START);
    annotator.hotkey('SAVE_JOB', START);
    for (let i = 0; i < 12; i += 1) annotator.mouseTimes(`ACTION_${i}`, 3, START + DAY + i * 3 * MINUTE);
    annotator.mouse('SWITCH_LOCK', START + 5 * DAY);
    const state = annotator.state();
    assert.deepEqual(state.mouseUses, { SWITCH_LOCK: [START + 5 * DAY] });
    assert.deepEqual(state.shown, []);
    assert.deepEqual(state.silencedUntil, {});
    assert.deepEqual(state.lastShown, {});
});
