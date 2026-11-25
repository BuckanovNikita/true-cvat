// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// Shortcut hints (UI-3): after a person does by mouse what a shortcut does, a hint names the shortcut.
//
//   controlOf(target)              the control of the table (controls.ts) a click on `target` used, or null
//   hintOf(control, ...)           what the hint of that control says, or null when it has none now (content.ts)
//   mouseUsed(action)              that hint's action was just done by mouse: true when the hint is shown now
//   shortcutPressed(action, event) the shortcut dispatcher is about to run the handler of `action` for the key
//                                  event `event`; a repeat of a held key is no press
//   countPressesWhile(when)        presses count only while `when()` holds (null: never), set by the host to
//                                  where it counts clicks
//   switchedOff()                  a failure switched the hints off for this page load (guard.ts)
//   switchOff(error)               a failure outside the entry points (while a hint is drawn) does the same
//
// When a hint is shown is decided in policy.ts; what the person has done is kept in the browser (store.ts).

import { CONTROLS } from './controls';
import { guarded } from './guard';
import {
    HintState, emptyState, hotkeyPressed, mouseUsed as decide,
} from './policy';
import { readState, writeState } from './store';

export type { Control } from './controls';
export type { Hint, Shortcuts } from './content';
export { hintOf } from './content';
export { controlOf } from './resolve';
export { guarded, switchOff, switchedOff } from './guard';

const HINTED: ReadonlySet<string> = new Set(CONTROLS.map((control) => control.actions[0]));

// The share of policy.ts weighs presses against clicks, so both are counted under the same conditions: the host
// counts a click only where a hint can be shown (an open 2D job with its canvas, ...) and tells here where that
// is. A press anywhere else, a 3D job say, would weigh against clicks that are never counted there. Until a host
// says so, no press counts, as no click does.
let counting: (() => boolean) | null = null;

export function countPressesWhile(when: (() => boolean) | null): void {
    counting = when;
}

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

export function shortcutPressed(
    action: string, event?: { repeat?: boolean } | null, now: number = Date.now(),
): void {
    guarded(undefined, () => {
        if (!HINTED.has(action)) return;
        // A held key counts once: the browser repeats its keydown many times a second (`repeat`), and each
        // repeat is ignored, so that a held key never writes the storage on every repeat. Team Analytics counts
        // every frame a held frame navigation key moves; the hint counts the press the person made, on purpose.
        if (event?.repeat) return;
        if (!counting?.()) return;
        keep(hotkeyPressed(state(), action, now));
    });
}
