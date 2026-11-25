// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// What a hint says: the name of what the control does and the keys of the shortcuts that do the same.

import { Control } from './controls';

export interface Hint {
    // the action that names the hint: what policy.ts counts and silences
    action: string;
    name: string;
    // one entry per shortcut to press, in order; each as the shortcuts store shows it, e.g. 'Ctrl+S'
    keys: string[];
}

// The part of the shortcuts store (reducers/shortcuts-reducer.ts) a hint is made of.
export interface Shortcuts {
    // action -> CVAT's own (English) name of it
    keyMap: Record<string, { name?: string } | undefined>;
    // action -> the keys the person has now, e.g. '[Ctrl+S]' or '[Q, /]'; '' without a key
    normalizedKeyMap: Record<string, string | undefined>;
}

/**
 * The hint of `control`, or null when there is nothing to say: one of its actions has no key, or its shortcut
 * is not among those `bound` right now (utils/mousetrap-react.tsx, getApplicationKeyMap), or it has no name.
 */
export function hintOf(control: Control, shortcuts: Shortcuts, bound: Record<string, unknown>): Hint | null {
    const keys: string[] = [];
    for (const action of control.actions) {
        const [first] = (shortcuts.normalizedKeyMap[action] ?? '').replace(/^\[(.*)\]$/, '$1').split(', ');
        if (!first || !(action in bound)) return null;
        keys.push(first);
    }
    const [action] = control.actions;
    const name = control.name ?? shortcuts.keyMap[action]?.name;
    return name ? { action, name, keys } : null;
}
