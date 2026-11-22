// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// When a shortcut hint is shown. Pure: the state goes in and comes out, the clock is an argument.
//
// - An action is due once it was done by mouse DUE_MOUSE_USES times within WINDOW_MS.
// - A due action is hinted at most once per ACTION_GAP_MS.
// - Whatever the actions, two hints are at least HINT_GAP_MS apart and at most HINTS_PER_WINDOW are
//   shown within WINDOW_MS.
// - A press of the action's hotkey silences its hint for SILENCE_MS; after that the rules above apply again.

export const DUE_MOUSE_USES = 3;
export const WINDOW_MS = 60 * 60 * 1000;
export const ACTION_GAP_MS = 60 * 60 * 1000;
export const HINT_GAP_MS = 2 * 60 * 1000;
export const HINTS_PER_WINDOW = 10;
export const SILENCE_MS = 3 * 24 * 60 * 60 * 1000;

// Times are milliseconds since the epoch.
export interface HintState {
    // action -> its latest mouse uses within the window (at most DUE_MOUSE_USES of them)
    mouseUses: Record<string, number[]>;
    // action -> when its hint was last shown, while that still holds the next one back
    lastShown: Record<string, number>;
    // when hints were shown within the window, oldest first
    shown: number[];
    // action -> until when its hint is silenced
    silencedUntil: Record<string, number>;
}

export function emptyState(): HintState {
    return {
        mouseUses: {}, lastShown: {}, shown: [], silencedUntil: {},
    };
}

function kept<T>(record: Record<string, T>, keep: (value: T) => T | null): Record<string, T> {
    const result: Record<string, T> = {};
    for (const [key, value] of Object.entries(record)) {
        const next = keep(value);
        if (next !== null) result[key] = next;
    }
    return result;
}

// A copy of the state without what no rule needs any more at `now`. A time later than `now` was noted before
// the clock was set back: it says nothing about the time that led up to `now`, so it goes too, and a silence
// never reaches further ahead than a silence lasts.
function current(state: HintState, now: number): HintState {
    const within = (at: number, span: number): boolean => at <= now && now - at < span;
    return {
        mouseUses: kept(state.mouseUses, (uses) => {
            const recent = uses.filter((at) => within(at, WINDOW_MS));
            return recent.length ? recent : null;
        }),
        lastShown: kept(state.lastShown, (at) => (within(at, ACTION_GAP_MS) ? at : null)),
        shown: state.shown.filter((at) => within(at, WINDOW_MS)),
        silencedUntil: kept(state.silencedUntil, (until) => (until > now && until - now <= SILENCE_MS ? until : null)),
    };
}

/** The action was done by mouse at `now`: the state after it, and whether its hint is shown now. */
export function mouseUsed(state: HintState, action: string, now: number): { state: HintState; show: boolean } {
    const next = current(state, now);
    const uses = [...(next.mouseUses[action] ?? []), now].slice(-DUE_MOUSE_USES);
    next.mouseUses[action] = uses;
    const latest = next.shown[next.shown.length - 1];
    const show = uses.length >= DUE_MOUSE_USES &&
        !(action in next.silencedUntil) &&
        !(action in next.lastShown) &&
        next.shown.length < HINTS_PER_WINDOW &&
        (latest === undefined || now - latest >= HINT_GAP_MS);
    if (show) {
        next.lastShown[action] = now;
        next.shown.push(now);
    }
    return { state: next, show };
}

/** The hotkey of the action was pressed at `now`: the state after it. */
export function hotkeyPressed(state: HintState, action: string, now: number): HintState {
    return { ...state, silencedUntil: { ...state.silencedUntil, [action]: now + SILENCE_MS } };
}
