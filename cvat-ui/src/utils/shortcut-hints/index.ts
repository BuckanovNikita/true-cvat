// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// Shortcut hints (UI-3): after a person does by mouse what a shortcut does, a hint names the shortcut.
//
//   controlOf(target)             the control of the table (controls.ts) a click on `target` used, or null
//   hintOf(control, ...)          what the hint of that control says, or null when it has none now (content.ts)
//   mouseUsed(action)             that hint's action was just done by mouse: true when the hint is shown now
//   shortcutPressed(action)       the shortcut dispatcher is about to run the handler of `action`
//   switchedOff()                 a failure switched the hints off for this page load (guard.ts)
//   switchOff(error)              a failure outside the entry points (while a hint is drawn) does the same
//
// When a hint is shown is decided in policy.ts; what the person has done is kept in the browser (store.ts).

import { CONTROLS } from './controls';
import { guarded } from './guard';
import {
    HintState, SILENCE_MS, emptyState, hotkeyPressed, mouseUsed as decide,
} from './policy';
import { readState, writeState } from './store';

export type { Control } from './controls';
export type { Hint, Shortcuts } from './content';
export { hintOf } from './content';
export { controlOf } from './resolve';
export { guarded, switchOff, switchedOff } from './guard';

// A held key runs its shortcut many times a second: the silence of an action is renewed at most this often.
const RENEW_MS = 60 * 60 * 1000;

const HINTED: ReadonlySet<string> = new Set(CONTROLS.map((control) => control.actions[0]));

// the state as last read or written: what holds when the storage cannot be used
let memory: HintState = emptyState();
// the last write did not reach the storage (it is full, say): what it holds is older than `memory`, and
// reading it back would undo what was decided since
let unsaved = false;

function state(): HintState {
    if (!unsaved) memory = readState() ?? memory;
    return memory;
}

function keep(next: HintState): void {
    memory = next;
    unsaved = !writeState(next);
}

export function mouseUsed(action: string, now: number = Date.now()): boolean {
    return guarded(false, () => {
        const result = decide(state(), action, now);
        keep(result.state);
        return result.show;
    });
}

export function shortcutPressed(action: string, now: number = Date.now()): void {
    guarded(undefined, () => {
        if (!HINTED.has(action)) return;
        // how much of the silence is left; more than a whole silence was noted before the clock was set back,
        // and the rules drop it (policy.ts), so it does not count as renewed
        const left = (memory.silencedUntil[action] ?? 0) - now;
        const renewed = left > SILENCE_MS - RENEW_MS && left <= SILENCE_MS;
        if (!renewed) keep(hotkeyPressed(state(), action, now));
    });
}
