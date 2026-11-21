// The time chart: working time per day of the period, or per week for Year.
const assert = require('node:assert/strict');
const test = require('node:test');
const { loadPage, render, text } = require('./helper.cjs');

const View = loadPage('team-analytics-view.tsx').default;
const HOUR = 3600000;

function days(first, count, hours = () => 1) {
    const [year, month, day] = first.split('-').map(Number);
    return Array.from({ length: count }, (_, i) => {
        const date = new Date(Date.UTC(year, month - 1, day + i));
        return { start: date.toISOString().slice(0, 10), working_time_ms: hours(i) * HOUR };
    });
}

function chart(series) {
    const html = render(View, {
        organization: 'team-org',
        state: { kind: 'ready', overview: { by_annotator: { rows: [] }, time_series: series } },
    });
    const card = html.match(/<section class="cvat-team-analytics-card cvat-team-analytics-time-chart">.*?<\/section>/s);
    assert.ok(card, 'the time chart is shown');
    const bars = [...card[0].matchAll(/<div class="cvat-team-analytics-time-bar"[^>]*title="([^"]*)"[^>]*>(.*?)<\/div><\/div>/gs)]
        .map((match) => ({ title: match[1], caption: text(match[2]) }));
    const labels = [...card[0].matchAll(/<span class="cvat-team-analytics-time-label">([^<]*)<\/span>/g)].map((m) => m[1]);
    return { html: card[0], text: text(card[0]), bars, labels };
}

test('a week shows one bar per day with every value and every day readable without hovering', () => {
    const { text: shown, bars, labels } = chart({ unit: 'day', buckets: days('2026-11-07', 7, (i) => [0, 0, 2.5, 8, 7.25, 6, 1][i]) });
    assert.match(shown, /Рабочее время по дням/);
    assert.deepEqual(bars.map((bar) => bar.caption), ['0,0', '0,0', '2,5', '8,0', '7,3', '6,0', '1,0']);
    assert.deepEqual(labels, ['7\u00a0нояб.', '8\u00a0нояб.', '9\u00a0нояб.', '10\u00a0нояб.', '11\u00a0нояб.', '12\u00a0нояб.', '13\u00a0нояб.']);
    assert.equal(bars[3].title, '10\u00a0нояб.: 8,00\u00a0ч');
});

test('two weeks still show values on the bars and label every other day, today included', () => {
    const { bars, labels } = chart({ unit: 'day', buckets: days('2026-10-31', 14) });
    assert.equal(bars.length, 14);
    assert.ok(bars.every((bar) => bar.caption === '1,0'));
    assert.deepEqual(labels, ['1\u00a0нояб.', '3\u00a0нояб.', '5\u00a0нояб.', '7\u00a0нояб.', '9\u00a0нояб.', '11\u00a0нояб.', '13\u00a0нояб.']);
});

test('a month has too many bars for values: they move to the hover text and labels thin out', () => {
    const { bars, labels } = chart({ unit: 'day', buckets: days('2026-10-01', 31, (i) => i) });
    assert.equal(bars.length, 31);
    assert.ok(bars.every((bar) => bar.caption === ''));
    assert.equal(bars[30].title, '31\u00a0окт.: 30,00\u00a0ч');
    assert.deepEqual(labels, ['1\u00a0окт.', '6\u00a0окт.', '11\u00a0окт.', '16\u00a0окт.', '21\u00a0окт.', '26\u00a0окт.', '31\u00a0окт.']);
});

test('a year shows weeks instead of days', () => {
    const weeks = [{ start: '2025-11-14', working_time_ms: 3 * HOUR }];
    for (let i = 0; i < 52; i += 1) {
        const date = new Date(Date.UTC(2025, 10, 17 + 7 * i));
        weeks.push({ start: date.toISOString().slice(0, 10), working_time_ms: 40 * HOUR });
    }
    const { text: shown, bars, labels } = chart({ unit: 'week', buckets: weeks });
    assert.match(shown, /Рабочее время по неделям/);
    assert.doesNotMatch(shown, /Рабочее время по дням/);
    assert.equal(bars.length, 53);
    assert.equal(bars[0].title, 'Неделя с 14\u00a0нояб.: 3,00\u00a0ч');
    assert.equal(bars[52].title, 'Неделя с 9\u00a0нояб.: 40,00\u00a0ч');
    assert.ok(bars.every((bar) => bar.caption === ''));
    assert.equal(labels.length, 7);
    assert.equal(labels[labels.length - 1], '9\u00a0нояб.');
});

test('bar heights follow the values against a shared scale', () => {
    const { html } = chart({ unit: 'day', buckets: days('2026-11-07', 7, (i) => [0, 1, 2, 4, 8, 2, 1][i]) });
    const heights = [...html.matchAll(/cvat-team-analytics-time-fill" style="height:([\d.]+)%/g)].map((m) => Number(m[1]));
    assert.equal(heights.length, 7);
    assert.equal(heights[0], 0);
    assert.equal(heights[4] / heights[3], 2);
    assert.ok(heights[4] <= 100);
});

test('dates are the service days, whatever the zone the page runs in', () => {
    // run this file under TZ=America/Los_Angeles too: a date string must not move a day
    const { labels } = chart({ unit: 'day', buckets: days('2026-11-01', 7) });
    assert.equal(labels[0], '1\u00a0нояб.');
});
