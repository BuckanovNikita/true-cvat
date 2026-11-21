// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';

import { longDayLabel } from './format';
import { hasNoJobWork } from './operations';
import { OperationsFigures } from './service';

// Shown for a legacy period: it ends before the cutover to the new activity logging (the first shape-tagged
// event on the instance), so missing figures are not zeros.
export default function LegacyNotice(): JSX.Element {
    return (
        <div className='cvat-team-analytics-legacy-notice' role='note'>
            <div className='cvat-team-analytics-legacy-notice-title'>
                Этот период записан до перехода на новый учёт действий
            </div>
            <div>
                Старые события не указывают, какая фигура была изменена, поэтому операции и время ниже
                относятся ко всем фигурам. Смены класса и использование горячих клавиш не записывались и
                учитываются со дня запуска нового учёта действий. Проекты, сессии, рабочее время и число
                сохранённых боксов учтены полностью.
            </div>
        </div>
    );
}

// The cutover's calendar day for the viewer, e.g. "2 ноября 2026". The en-CA date is only the YYYY-MM-DD
// key of the day in the viewer's zone; the words come from longDayLabel.
export function cutoverDay(cutover: string, timeZone?: string): string {
    const day = new Date(cutover).toLocaleDateString('en-CA', timeZone ? { timeZone } : undefined);
    return longDayLabel(day);
}

// Shown for a partly legacy period: the cutover falls inside it, so some figures cover only the part after it.
export function PartlyLegacyNotice({ cutover, timeZone }: { cutover: string; timeZone?: string }): JSX.Element {
    return (
        <div className='cvat-team-analytics-legacy-notice cvat-team-analytics-partly-legacy-notice' role='note'>
            <div className='cvat-team-analytics-legacy-notice-title'>
                {`Новый учёт действий начался ${cutoverDay(cutover, timeZone)}`}
            </div>
            <div>
                Показатели по боксам, смены класса и использование горячих клавиш охватывают только дни после
                этой даты; в режиме «Все фигуры» операции до неё тоже учтены. Проекты, сессии, рабочее время
                и число сохранённых боксов охватывают весь период.
            </div>
        </div>
    );
}

// The notice the shown period needs: legacy, partly legacy (naming the cutover day), or none. A period with no
// job work in the scope shows only the empty state, so neither notice.
export function LegacyNotices({ operations, timeZone }: {
    operations?: OperationsFigures;
    timeZone?: string;
}): JSX.Element | null {
    if (!operations || hasNoJobWork(operations)) return null;
    if (operations.legacy) return <LegacyNotice />;
    if (operations.partly_legacy && operations.cutover) {
        return <PartlyLegacyNotice cutover={operations.cutover} timeZone={timeZone} />;
    }
    return null;
}
