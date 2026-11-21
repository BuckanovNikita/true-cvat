// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// The page is in Russian, where a word next to a number takes one of three forms:
// 1 проект, 2 проекта, 5 проектов (and 21 проект, 22 проекта, 11 проектов).

const RULES = new Intl.PluralRules('ru');

// The forms for 1, for 2 to 4 and for 5 and more, in that order. A form may be a whole phrase:
// a verb or an adjective that agrees with the count belongs in it.
export type Forms = readonly [one: string, few: string, many: string];

// The form of `forms` that goes with the whole number `count`.
export function plural(count: number, forms: Forms): string {
    const rule = RULES.select(Math.abs(count));
    if (rule === 'one') return forms[0];
    if (rule === 'few') return forms[1];
    return forms[2];
}
