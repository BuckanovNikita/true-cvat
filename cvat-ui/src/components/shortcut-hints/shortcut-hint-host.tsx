// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// Shortcut hints (UI-3) on the screen: mounted once by cvat-app.tsx. It listens to the clicks of the whole
// window and, when a click used a control that a shortcut stands in for (utils/shortcut-hints), shows the
// shortcut in a corner of the 2D canvas for a few seconds. The hint is in Russian (ADR 0011).

import './styles.scss';

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';

import { DimensionType } from 'cvat-core-wrapper';
import { CombinedState } from 'reducers';
import { getApplicationKeyMap } from 'utils/mousetrap-react';
import {
    Hint, Shortcuts, controlOf, countPressesWhile, guarded, hintOf, mouseUsed, switchOff,
} from 'utils/shortcut-hints';
import { hintShown } from 'utils/team-analytics-logging';

// How long a hint stays on the screen.
export const SHOWN_MS = 5000;

const CANVAS = '.cvat-canvas-container';

interface Props {
    shownMs?: number;
}

interface View {
    shortcuts: Shortcuts;
    // an open job with a 2D canvas: the hint is placed over that canvas
    in2DJob: boolean;
}

// The hint itself, drawn into the canvas container the way CVAT's own canvas controls are.
function HintBox({ hint, shownMs }: { hint: Hint; shownMs: number }): JSX.Element | null {
    const canvas = window.document.querySelector(CANVAS);
    if (!canvas) return null;
    return ReactDOM.createPortal(
        <div className='cvat-shortcut-hint' role='status' style={{ animationDuration: `${shownMs}ms` }}>
            <span className='cvat-shortcut-hint-keys'>
                {hint.keys.map((key, index) => (
                    // the keys of one hint keep their order, so the position is their identity
                    <React.Fragment key={index}>
                        {index > 0 && <span className='cvat-shortcut-hint-then'>→</span>}
                        <kbd>{key}</kbd>
                    </React.Fragment>
                ))}
            </span>
            <span className='cvat-shortcut-hint-text'>
                <span className='cvat-shortcut-hint-name'>{hint.name}</span>
                <span className='cvat-shortcut-hint-label'>Горячая клавиша</span>
            </span>
        </div>,
        canvas,
    );
}

// A failure while a hint is drawn stays here: the hint goes, the hints are switched off for the page load,
// and the application around them is not touched.
class Contained extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    public constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { failed: false };
    }

    public static getDerivedStateFromError(): { failed: boolean } {
        return { failed: true };
    }

    public componentDidCatch(error: unknown): void {
        switchOff(error);
    }

    public render(): React.ReactNode {
        const { failed } = this.state;
        const { children } = this.props;
        return failed ? null : children;
    }
}

function ShortcutHintHost({ shownMs = SHOWN_MS }: Props): JSX.Element {
    const shortcuts = useSelector((state: CombinedState) => state.shortcuts);
    const in2DJob = useSelector((state: CombinedState) => (
        state.annotation.job.instance?.dimension === DimensionType.DIMENSION_2D
    ));
    const [hint, setHint] = useState<Hint | null>(null);
    // what the click listener, attached once, reads at the time of a click
    const view = useRef<View>({ shortcuts, in2DJob });
    view.current = { shortcuts, in2DJob };

    useEffect(() => {
        // where clicks are counted; hotkey presses are counted only there too (utils/shortcut-hints)
        const counted = (): boolean => view.current.in2DJob && !!window.document.querySelector(CANVAS);
        const onClick = (event: MouseEvent): void => {
            guarded(undefined, () => {
                // detail 0: the click a browser makes of Enter or Space on a focused control, no mouse use
                if (event.detail === 0) return;
                if (!counted()) return;
                const control = controlOf(event.target);
                if (!control) return;
                const next = hintOf(control, view.current.shortcuts, getApplicationKeyMap());
                if (!next || !mouseUsed(next.action)) return;
                // a new object every time: a hint shown again starts its time on the screen anew
                setHint({ ...next });
                hintShown(next.action); // Team Analytics counts the hints shown (input-summary.ts)
            });
        };
        // capture: a control that stops the click from bubbling is still seen
        window.addEventListener('click', onClick, { capture: true });
        // a press counts where a click on its control would: the same gates, and the control has a hint
        countPressesWhile((control) => (
            counted() && hintOf(control, view.current.shortcuts, getApplicationKeyMap()) !== null
        ));
        return () => {
            window.removeEventListener('click', onClick, { capture: true });
            countPressesWhile(null);
        };
    }, []);

    useEffect(() => {
        if (!hint) return undefined;
        const timer = setTimeout(() => setHint(null), shownMs);
        return () => clearTimeout(timer);
    }, [hint, shownMs]);

    return (
        <Contained>
            {hint && in2DJob ? <HintBox hint={hint} shownMs={shownMs} /> : null}
        </Contained>
    );
}

export default React.memo(ShortcutHintHost);
