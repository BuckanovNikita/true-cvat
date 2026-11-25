// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// Numbers, durations and dates as the page shows them. The page is in Russian whatever language the
// browser is set to, so nothing here reads the browser's language, and month names are spelled out
// below rather than asked from the browser.

import { Forms, plural } from './plural';

const HOUR_MS = 3600000;

// A non-breaking space: between the groups of a number, and between a number and what it counts,
// so that neither is split over two lines.
export const NBSP = '\u00a0';

// A number in Russian: groups of three split by a non-breaking space, a comma before the decimals
// (1 234 567,5). `decimals` fixes how many decimals are shown; without it the number is shown as it
// is, with three at most.
export function formatNumber(value: number, decimals?: number): string {
    const options = decimals === undefined ? undefined : {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    };
    // whichever space the browser groups with (it changed between versions), the page shows one
    return value.toLocaleString('ru-RU', options).replace(/\s/g, NBSP);
}

// A count with the word it counts: '5 проектов' from 5 and ['проект', 'проекта', 'проектов'].
export function counted(count: number, forms: Forms): string {
    return `${formatNumber(Math.round(count))}${NBSP}${plural(count, forms)}`;
}

// Hours as the page shows them: one decimal, whole hours from 1 000 ч on.
export function formatHours(ms: number): string {
    const hours = ms / HOUR_MS;
    return `${hours >= 1000 ? formatNumber(Math.round(hours)) : formatNumber(hours, 1)}${NBSP}ч`;
}

// A length of time: seconds under a minute, minutes under an hour, then hours.
export function formatDuration(ms: number): string {
    if (ms < 60000) {
        return `${Math.round(ms / 1000)}${NBSP}с`;
    }
    if (ms < HOUR_MS) {
        return `${Math.round(ms / 60000)}${NBSP}мин`;
    }
    return formatHours(ms);
}

export const MISSING = '—';

// Time per operation: seconds, one decimal under ten.
export function formatSeconds(ms: number | null): string {
    if (ms === null) return MISSING;
    const seconds = ms / 1000;
    return `${seconds < 10 ? formatNumber(seconds, 1) : formatNumber(Math.round(seconds))}${NBSP}с`;
}

export function formatCount(value: number): string {
    return formatNumber(Math.round(value));
}

// A count shortened for a tile: 1,23 млн from a million, 123 тыс. from a hundred thousand.
export function shortCount(value: number): string {
    if (value >= 1e6) return `${formatNumber(value / 1e6, 2)}${NBSP}млн`;
    if (value >= 1e5) return `${Math.round(value / 1000)}${NBSP}тыс.`;
    return formatCount(value);
}

// A share of a whole, rounded to a percent.
export function formatShare(share: number | null): string {
    return share === null ? MISSING : `${Math.round(share * 100)}%`;
}

// A project as the page names it: Без проекта for id 0, its name when the project still exists, otherwise its
// identifier (e.g. a deleted project stays in past figures).
export function projectName(id: number, names: Record<number, string>): string {
    if (id === 0) return 'Без проекта';
    return names[id] ?? `Проект #${id}`;
}

// The exact value, for hover text.
export function exactHours(ms: number): string {
    return `${formatNumber(ms / HOUR_MS, 2)}${NBSP}ч`;
}

// Month names in the four forms Russian needs: short and full, after a day number (7 мая) and
// standing alone (май 2026).
const MONTHS_AFTER_DAY = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.',
    'нояб.', 'дек.'];
const MONTHS_ALONE = ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.',
    'нояб.', 'дек.'];
const MONTH_NAMES_AFTER_DAY = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа',
    'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь',
    'Октябрь', 'Ноябрь', 'Декабрь'];

// 'YYYY-MM-DD' (a calendar day the service names) -> '7 нояб.', with the year '7 нояб. 2026'. Read from
// its parts, so the zone the browser runs in cannot move it.
export function dayLabel(day: string, withYear = false): string {
    const [year, month, date] = day.split('-').map(Number);
    return `${date}${NBSP}${MONTHS_AFTER_DAY[month - 1]}${withYear ? ` ${year}` : ''}`;
}

// 'YYYY-MM-DD' -> '7 ноября 2026', the day written out in a sentence.
export function longDayLabel(day: string): string {
    const [year, month, date] = day.split('-').map(Number);
    return `${date}${NBSP}${MONTH_NAMES_AFTER_DAY[month - 1]} ${year}`;
}

// 'YYYY-MM' -> 'Ноябрь 2026', a month as a heading.
export function monthLabel(month: string): string {
    const [year, number] = month.split('-').map(Number);
    return `${MONTH_NAMES[number - 1]} ${year}`;
}

// 'YYYY-MM' or 'YYYY-MM-DD' -> 'нояб. 2026', a month on a chart's scale.
export function shortMonthLabel(month: string): string {
    const [year, number] = month.split('-').map(Number);
    return `${MONTHS_ALONE[number - 1]} ${year}`;
}
