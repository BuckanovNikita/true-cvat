// When a hint is shown (policy.ts): an action is hinted from its third mouse use within an hour, then at most
// once an hour; overall at most one hint per two minutes and ten per hour; a press of the action's hotkey
// silences its hint for three days when, counting that press, more than half of the action's uses within the
// last hour were hotkey presses.
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

test('a press of the hotkey with no mouse use within the hour silences the hint of its action for three days', () => {
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

test('a press of the hotkey of an action done mostly by mouse does not silence its hint', () => {
    const annotator = person();
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START), [false, false, true]);
    // one press against three mouse uses: a quarter of the uses within the hour
    annotator.hotkey('SWITCH_LOCK', START + MINUTE);
    assert.deepEqual(annotator.state().silencedUntil, {});
    // an hour after its hint the action is still done by mouse, and is hinted again
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START + 61 * MINUTE), [false, false, true]);
});

test('a press silences only once hotkey presses are more than half of the uses within the hour', () => {
    const annotator = person();
    annotator.mouseTimes('SWITCH_LOCK', 2, START);
    annotator.hotkey('SWITCH_LOCK', START + MINUTE);
    annotator.hotkey('SWITCH_LOCK', START + 2 * MINUTE);
    // two presses and two mouse uses: exactly half does not silence
    assert.deepEqual(annotator.state().silencedUntil, {});
    annotator.hotkey('SWITCH_LOCK', START + 3 * MINUTE);
    // three presses and two mouse uses
    assert.deepEqual(annotator.state().silencedUntil, { SWITCH_LOCK: START + 3 * MINUTE + 3 * DAY });
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 4, START + 2 * HOUR), [false, false, false, false]);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START + 3 * DAY + 4 * MINUTE), [false, false, true]);
});

test('with exactly half of the uses by hotkey, the next mouse use that is due is hinted', () => {
    const annotator = person();
    annotator.mouseTimes('SWITCH_LOCK', 2, START);
    annotator.hotkey('SWITCH_LOCK', START + MINUTE);
    annotator.hotkey('SWITCH_LOCK', START + 2 * MINUTE);
    assert.equal(annotator.mouse('SWITCH_LOCK', START + 3 * MINUTE), true);
});

test('uses older than an hour do not count in the share', () => {
    const annotator = person();
    annotator.mouseTimes('SWITCH_LOCK', 30, START);
    // two hours on, the thirty mouse uses are out of the hour: one press is all there is
    annotator.hotkey('SWITCH_LOCK', START + 2 * HOUR);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START + 2 * HOUR + MINUTE), [false, false, false]);
});

test('mouse uses during a silence count in the share', () => {
    const annotator = person();
    annotator.hotkey('SWITCH_LOCK', START);
    annotator.mouseTimes('SWITCH_LOCK', 3, START + DAY);
    // one press against three mouse uses does not renew the silence: it ends three days after the first press
    annotator.hotkey('SWITCH_LOCK', START + DAY + MINUTE);
    assert.deepEqual(annotator.state().silencedUntil, { SWITCH_LOCK: START + 3 * DAY });
});

test('a person silenced once who goes back to the mouse is hinted again after the three days', () => {
    const annotator = person();
    annotator.hotkey('SWITCH_LOCK', START);
    for (const day of [1, 2]) {
        // mostly by mouse, with a press now and then: never more than half of the uses within the hour
        annotator.mouseTimes('SWITCH_LOCK', 3, START + day * DAY);
        annotator.hotkey('SWITCH_LOCK', START + day * DAY + MINUTE);
        annotator.mouseTimes('SWITCH_LOCK', 2, START + day * DAY + 2 * MINUTE);
        annotator.hotkey('SWITCH_LOCK', START + day * DAY + 3 * MINUTE);
    }
    // a press that does not pass leaves the silence as it is: it still holds
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START + 2 * DAY + 4 * MINUTE), [false, false, false]);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START + 3 * DAY + MINUTE), [false, false, true]);
});

test('a press during a silence with more than half of the uses by hotkey renews it', () => {
    const annotator = person();
    annotator.hotkey('SWITCH_LOCK', START);
    annotator.mouse('SWITCH_LOCK', START + 2 * DAY);
    annotator.hotkey('SWITCH_LOCK', START + 2 * DAY + MINUTE);
    annotator.hotkey('SWITCH_LOCK', START + 2 * DAY + 2 * MINUTE);
    assert.deepEqual(annotator.state().silencedUntil, { SWITCH_LOCK: START + 5 * DAY + 2 * MINUTE });
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 4, START + 3 * DAY + MINUTE), [false, false, false, false]);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START + 5 * DAY + 3 * MINUTE), [false, false, true]);
});

test('the share of one action is not counted with the uses of another', () => {
    const annotator = person();
    annotator.mouseTimes('SWITCH_HIDDEN', 2, START);
    annotator.hotkey('SWITCH_LOCK', START + MINUTE);
    annotator.mouseTimes('SWITCH_LOCK', 2, START + 2 * MINUTE);
    annotator.hotkey('SWITCH_HIDDEN', START + 3 * MINUTE);
    // SWITCH_LOCK: one press, no mouse use before it; SWITCH_HIDDEN: one press against two mouse uses
    assert.deepEqual(annotator.state().silencedUntil, { SWITCH_LOCK: START + MINUTE + 3 * DAY });
});

test('a press does not change the state it is given', () => {
    const policy = loadHints('policy.ts');
    const before = policy.mouseUsed(policy.emptyState(), 'SWITCH_LOCK', START).state;
    const copy = JSON.parse(JSON.stringify(before));
    policy.hotkeyPressed(before, 'SWITCH_LOCK', START + 1000);
    policy.mouseUsed(before, 'SWITCH_LOCK', START + 2000);
    assert.deepEqual(before, copy);
});

test('the uses are counted per minute, and only those of the last hour are kept', () => {
    const annotator = person();
    // a mouse use every ten seconds for two hours, and a press each minute
    for (let at = START; at < START + 2 * HOUR; at += 10000) {
        annotator.mouse('SWITCH_LOCK', at);
        if ((at - START) % MINUTE === 0) annotator.hotkey('SWITCH_LOCK', at);
    }
    assert.deepEqual(annotator.state().uses, {
        SWITCH_LOCK: Array.from({ length: 60 }, (_, i) => [START + (60 + i) * MINUTE, 6, 1]),
    });
});

// The clock of a computer can be set back (a correction, another time zone set by hand): what was noted at a
// time that is now in the future says nothing about the last hour.
test('after the clock is set back, a hint shown "in the future" holds no hint back', () => {
    const annotator = person();
    assert.equal(annotator.mouseTimes('SWITCH_LOCK', 3, START)[2], true);
    assert.deepEqual(annotator.mouseTimes('SWITCH_LOCK', 3, START - DAY), [false, false, true]);
    assert.equal(annotator.mouseTimes('SWITCH_HIDDEN', 3, START - DAY + 3 * MINUTE)[2], true);
});

test('after the clock is set back, uses noted "in the future" do not count in the share', () => {
    const annotator = person();
    for (let i = 0; i < 5; i += 1) annotator.hotkey('SWITCH_LOCK', START + i * MINUTE);
    const earlier = START - 2 * HOUR;
    annotator.mouseTimes('SWITCH_LOCK', 2, earlier);
    // one press against two mouse uses: the five presses "in the future" are dropped
    annotator.hotkey('SWITCH_LOCK', earlier + MINUTE);
    assert.deepEqual(annotator.state().uses, { SWITCH_LOCK: [[earlier, 2, 0], [earlier + MINUTE, 0, 1]] });
    assert.equal(annotator.mouse('SWITCH_LOCK', earlier + 2 * MINUTE), true);
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
    assert.deepEqual(state.uses, { SWITCH_LOCK: [[START + 5 * DAY, 1, 0]] });
});
