// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import './definitions.scss';

import React, { useEffect, useId, useState } from 'react';
import Tooltip from 'antd/lib/tooltip';

export type TermName = 'session' | 'working_time' | 'time_per_operation' | 'model';

// The term as the page writes it when the words that carry the definition are not given.
export const TERM_LABELS: Record<TermName, string> = {
    session: 'Сессия',
    working_time: 'Рабочее время',
    time_per_operation: 'Время на операцию',
    model: 'Модель',
};

// Worded from GLOSSARY.md, in Russian. Session inlines the session gap (five minutes); Time per
// operation inlines the idle pause (100 seconds).
export const DEFINITIONS: Record<TermName, string> = {
    session: 'Один непрерывный интервал работы одного человека в заданиях, не длиннее суток. Пауза дольше ' +
        'пяти минут завершает сессию. Для отдельного проекта сессия учитывается, если она затронула этот ' +
        'проект, а её длина — только время, проведённое в нём.',
    working_time: 'Время, которое сервер считает отработанным, — тот же показатель, что показывает Grafana. ' +
        'Это единственный итог: любая разбивка времени в сумме даёт его.',
    time_per_operation: 'Время от предыдущего действия человека до конца операции, поэтому поиск, решение и ' +
        'наведение входят в него. Пауза дольше 100 секунд перед действием не относится ни к одной операции.',
    model: 'Создано без рисования человеком: сохранено технической учётной записью или получено встроенным ' +
        'детектором. У боксов модели есть количество, но нет времени.',
};

interface Props {
    // the term whose definition is shown
    name: TermName;
    // the words on the page that carry it (default: the term's name)
    children?: React.ReactNode;
}

// Words of the overview that carry a definition: dotted underline, focusable, the definition in a tooltip on
// hover, on keyboard focus and on a tap; Escape hides it, wherever the focus is. The tooltip is rendered (hidden)
// from the start, outside any scrolling table, so that the words are described by it (aria-describedby) before it
// first opens.
export function Term({ name, children }: Props): JSX.Element {
    const id = `${useId()}-definition`;
    const [open, setOpen] = useState(false);
    // the hidden tooltip is rendered once the page is in the document (a portal cannot be rendered before)
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    // while the tooltip is open (by hover too, with the focus elsewhere), Escape anywhere hides it. The listener
    // runs in the capture phase, before a selector or modal that stops the key, and leaves the key to them (an
    // open selector or modal closes on the same press).
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [open]);
    return (
        <Tooltip
            title={DEFINITIONS[name]}
            trigger={['hover', 'focus']}
            open={open}
            onOpenChange={setOpen}
            id={id}
            forceRender={mounted}
            overlayClassName='cvat-team-analytics-term-tooltip'
        >
            {/* a button, so that keyboard users reach the definition and a tap shows it on a touch screen */}
            <button
                type='button'
                className='cvat-team-analytics-term'
                aria-describedby={id}
                onClick={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape' && open) {
                        event.stopPropagation();
                        setOpen(false);
                    }
                }}
            >
                {children ?? TERM_LABELS[name]}
            </button>
        </Tooltip>
    );
}
