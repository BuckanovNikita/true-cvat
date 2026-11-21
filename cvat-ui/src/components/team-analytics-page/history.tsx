// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// Processed history: the progress bar while history is processed, which periods may be offered, the
// notice shown instead of a period's figures until all of it is processed, and the notice that stands
// in for trends until three complete weeks are ready. A status that is not known disables nothing.

import React from 'react';

import { HistoryStatus } from './service';
import { NBSP, dayLabel, formatNumber } from './format';
import { plural } from './plural';

export const NOT_PROCESSED = 'Ещё не обработано';

// Whether period `key` (a period of address.ts) is wholly processed.
export function periodAvailable(history: HistoryStatus | null | undefined, key: string): boolean {
    if (!history || history.complete) return true;
    return !!history.periods[key];
}

// Whether calendar month `month` (YYYY-MM) is wholly processed.
export function monthAvailable(history: HistoryStatus | null | undefined, month: string): boolean {
    if (!history || history.complete) return true;
    // YYYY-MM strings compare in calendar order
    return !!history.earliest_month && month >= history.earliest_month;
}

export function HistoryProgress({ history }: { history?: HistoryStatus | null }): JSX.Element | null {
    if (!history || history.complete) return null;
    const { days_ready: daysReady, days_total: daysTotal, ready_from_day: readyFromDay } = history;
    // A status without the day counts (an older server) shows the percentage alone.
    const counted = typeof daysReady === 'number' && typeof daysTotal === 'number';
    const percent = history.percent ?? 0;
    const ready = readyFromDay ? `Готово с ${dayLabel(readyFromDay, true)}` : 'Пока ничего не готово';
    let days = '';
    if (counted) {
        const of = `${formatNumber(daysReady as number)} из ${formatNumber(daysTotal as number)}${NBSP}`;
        days = plural(daysTotal as number, [`${of}дня`, `${of}дней`, `${of}дней`]);
    }
    return (
        <div className='cvat-team-analytics-history'>
            <div className='cvat-team-analytics-history-head'>
                <span className='cvat-team-analytics-history-title'>Обработка истории</span>
                {counted && <span>{`${ready} · ${days}`}</span>}
                <span className='cvat-team-analytics-history-percent'>{`${percent}%`}</span>
            </div>
            <div
                className='cvat-team-analytics-history-bar'
                role='progressbar'
                aria-label='Обработанная история'
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
            >
                <div className='cvat-team-analytics-history-fill' style={{ width: `${percent}%` }} />
            </div>
            <div className='cvat-team-analytics-history-note'>
                Сначала обрабатываются последние дни. Периоды «Две недели» и «Год» и более ранние месяцы
                становятся доступны по мере обработки; страница никогда не показывает период, обработанный
                лишь частично.
            </div>
        </div>
    );
}

// Shown instead of the figures of a period that is not wholly processed.
export function NotProcessedNotice(): JSX.Element {
    return (
        <div className='cvat-team-analytics-not-processed' role='status'>
            <div className='cvat-team-analytics-notice-title'>Этот период ещё не обработан</div>
            <div>
                Показатели появятся, когда будет обработан каждый день периода, поэтому неполный итог не
                показывается. А пока выберите более короткий период.
            </div>
        </div>
    );
}

// by the number of complete weeks: 0, 1, 2
const WEEKS_READY = [
    'Для динамики нужно не менее трёх полных недель. Пока нет ни одной.',
    'Для динамики нужно не менее трёх полных недель. Пока готова одна.',
    'Для динамики нужно не менее трёх полных недель. Пока готовы две.',
];

// Trends need three complete weeks of processed history; until then this notice stands in for them.
// The trends card renders as `children` and appears once they are ready.
export function TrendsGate({ history, children = null }: {
    history?: HistoryStatus | null;
    children?: React.ReactNode;
}): JSX.Element | null {
    if (!history || history.trends_ready) return children ? <>{children}</> : null;
    const ready = WEEKS_READY[Math.min(history.complete_weeks, 2)];
    return (
        <div className='cvat-team-analytics-card cvat-team-analytics-trends-pending'>
            <div className='cvat-team-analytics-notice-title'>Динамика появится по мере обработки истории</div>
            <div>{ready}</div>
        </div>
    );
}
