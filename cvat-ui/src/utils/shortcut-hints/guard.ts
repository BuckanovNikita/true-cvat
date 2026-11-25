// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// A hint is never worth a broken annotation view: every entry point of the hints runs through `guarded`.
// A failure does not reach the caller, which gets the fallback instead, and switches the hints off for the
// rest of the page's life (every entry point then returns its fallback without trying).

let off = false;

export function switchedOff(): boolean {
    return off;
}

export function switchOff(error: unknown): void {
    off = true;
    try {
        console.warn('Shortcut hints failed and are switched off', error);
    } catch {
        // nothing to do
    }
}

export function guarded<T>(fallback: T, work: () => T): T {
    if (off) return fallback;
    try {
        return work();
    } catch (error: unknown) {
        switchOff(error);
        return fallback;
    }
}
