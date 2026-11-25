// The working-time-by-annotator card: each annotator's working time for the week, largest first.
const assert = require('node:assert/strict');
const test = require('node:test');
const { loadPage, render, text } = require('./helper.cjs');

const View = loadPage('team-analytics-view.tsx').default;

function ready(rows) {
    return { organization: 'team-org', state: { kind: 'ready', overview: { by_annotator: { rows } } } };
}

test('lists annotators in the order the service gives, with hours and bar widths', () => {
    const html = render(View, ready([
        { user_id: 12, user_name: 'bob', working_time_ms: 3 * 3600000 },
        { user_id: 11, user_name: 'alice', working_time_ms: 5400000 },
        { user_id: 13, user_name: 'carol', working_time_ms: 60000 },
    ]));
    assert.match(text(html), /Рабочее время по аннотаторам/);
    assert.match(text(html), /За 7 дней/);
    const rows = [...html.matchAll(/<button[^>]*class="cvat-team-analytics-annotator-row[ "][^>]*>(.*?)<\/button>/g)]
        .map((match) => text(match[1]));
    assert.deepEqual(rows, ['bob 3,0 ч', 'alice 1,5 ч', 'carol 0,0 ч']);
    const widths = [...html.matchAll(/cvat-team-analytics-bar-fill" style="width:([\d.]+)%/g)].map((m) => Number(m[1]));
    assert.deepEqual(widths, [100, 50, 60000 / (3 * 3600000) * 100]);
    assert.match(html, /title="bob: 3,00\u00a0ч"/);
});

test('a long name is shortened with the full name on hover', () => {
    const name = 'a-very-long-annotator-name-that-would-break-the-layout';
    const html = render(View, ready([{ user_id: 1, user_name: name, working_time_ms: 3600000 }]));
    assert.match(html, new RegExp(`class="cvat-team-analytics-name" title="${name}"`));
});

test('a week without job work says so', () => {
    const html = render(View, ready([]));
    assert.match(text(html), /В этом периоде нет работы в заданиях/);
    assert.doesNotMatch(html, /cvat-team-analytics-annotator-row/);
});

test('large totals keep one decimal and digit grouping', () => {
    const html = render(View, ready([{ user_id: 1, user_name: 'x', working_time_ms: 1234.5 * 3600000 }]));
    assert.match(text(html), /x 1 235 ч/);
});
