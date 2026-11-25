// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// From what was clicked to the control of the table (controls.ts) that the click used, if any.

import { CONTROLS, Control } from './controls';

// How CVAT and antd mark a control that does nothing when clicked.
const DISABLED = [
    '[disabled]', '[aria-disabled="true"]', '.ant-btn-disabled',
    '.cvat-disabled-canvas-control', '.cvat-annotation-disabled-header-button',
].join(', ');

interface Closest {
    closest(selectors: string): Closest | null;
}

function isElement(target: unknown): target is Closest {
    return !!target && typeof (target as Closest).closest === 'function';
}

/** The control a click on `target` used: the first of the table that `target` is, or is inside of. */
export function controlOf(target: unknown): Control | null {
    if (!isElement(target)) return null;
    for (const control of CONTROLS) {
        const element = target.closest(control.selector);
        if (element) return element.closest(DISABLED) ? null : control;
    }
    return null;
}
