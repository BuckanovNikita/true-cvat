// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// The hint state in the browser's localStorage, so that the limits of policy.ts hold across page reloads and
// between tabs. The storage is a convenience: when it cannot be read or written (private mode, blocked or full
// storage) or holds something else, the caller gets null or nothing happens, and keeps its state in memory.

import { HintState, UseCount } from './policy';

export const STORAGE_KEY = 'shortcutHints';
// 2: the counts of uses (`uses`) were added; a state of version 1 is unreadable and the browser starts over
const VERSION = 2;

function isTime(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isTimes(value: unknown): value is number[] {
    return Array.isArray(value) && value.every(isTime);
}

function isCount(value: unknown): value is number {
    return isTime(value) && value >= 0;
}

function isUseCounts(value: unknown): value is UseCount[] {
    return Array.isArray(value) &&
        value.every((item) => Array.isArray(item) && item.length === 3 && item.every(isCount));
}

function isRecord<T>(value: unknown, isValue: (item: unknown) => item is T): value is Record<string, T> {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(isValue);
}

function stateOf(stored: unknown): HintState | null {
    if (!stored || typeof stored !== 'object') return null;
    const {
        version, mouseUses, lastShown, shown, silencedUntil, uses,
    } = stored as Record<string, unknown>;
    if (version !== VERSION || !isRecord(mouseUses, isTimes) || !isRecord(lastShown, isTime) ||
        !isTimes(shown) || !isRecord(silencedUntil, isTime) || !isRecord(uses, isUseCounts)) return null;
    return {
        mouseUses, lastShown, shown, silencedUntil, uses,
    };
}

/** The stored state, or null when there is none that can be read. */
export function readState(): HintState | null {
    try {
        const text = globalThis.localStorage.getItem(STORAGE_KEY);
        return text === null ? null : stateOf(JSON.parse(text));
    } catch {
        // no storage, a storage that refuses, or text that is not JSON
        return null;
    }
}

/** Stores the state; false when it could not be stored, so that what the storage holds is older. */
export function writeState(state: HintState): boolean {
    try {
        globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...state }));
        return true;
    } catch {
        // no storage, or one that refuses or is full: the caller's copy in memory is what holds
        return false;
    }
}
