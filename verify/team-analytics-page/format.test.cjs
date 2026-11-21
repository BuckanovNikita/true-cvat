// The page's number, duration, date and plural helpers (format.ts, plural.ts): the page is in Russian, with
// groups of digits split by a non-breaking space (U+00A0) and a number joined to its unit by one too.
const assert = require('node:assert/strict');
const test = require('node:test');
const { loadPage } = require('./helper.cjs');

const {
    NBSP, MISSING, formatNumber, counted, formatHours, formatDuration, formatSeconds, formatCount, shortCount,
    formatShare, exactHours, dayLabel, longDayLabel, monthLabel, shortMonthLabel, projectName,
} = loadPage('format.ts');
const { plural } = loadPage('plural.ts');

const HOUR = 3600000;
const MINUTE = 60000;
const FORMS = ['проект', 'проекта', 'проектов'];

test('the non-breaking space is U+00A0', () => {
    assert.equal(NBSP, '\u00a0');
    assert.equal(MISSING, '—');
});

test('plural picks one / few / many by the Russian rules', () => {
    const expected = {
        0: 'проектов', 1: 'проект', 2: 'проекта', 4: 'проекта', 5: 'проектов', 11: 'проектов', 12: 'проектов',
        14: 'проектов', 21: 'проект', 22: 'проекта', 25: 'проектов', 101: 'проект', 111: 'проектов',
    };
    for (const [count, form] of Object.entries(expected)) {
        assert.equal(plural(Number(count), FORMS), form, `count ${count}`);
    }
});

test('plural reads the size of a negative count, and a form may be a whole phrase', () => {
    assert.equal(plural(-1, FORMS), 'проект');
    assert.equal(plural(-5, FORMS), 'проектов');
    assert.equal(plural(3, ['{n} осталась', '{n} остались', '{n} осталось']), '{n} остались');
});

test('formatNumber groups by a non-breaking space and writes a decimal comma', () => {
    assert.equal(formatNumber(0), '0');
    assert.equal(formatNumber(999), '999');
    assert.equal(formatNumber(1234), '1\u00a0234');
    assert.equal(formatNumber(1234567), '1\u00a0234\u00a0567');
    assert.equal(formatNumber(1234567.5), '1\u00a0234\u00a0567,5');
    assert.equal(formatNumber(-1234.5), '-1\u00a0234,5');
    assert.match(formatNumber(1234567), /^\d{1,3}(\u00a0\d{3})+$/, 'only non-breaking spaces between groups');
});

test('formatNumber with decimals shows exactly that many', () => {
    assert.equal(formatNumber(12.5, 1), '12,5');
    assert.equal(formatNumber(12, 1), '12,0');
    assert.equal(formatNumber(12.345, 2), '12,35');
    assert.equal(formatNumber(1234.5, 2), '1\u00a0234,50');
    assert.equal(formatNumber(0.04, 0), '0');
    assert.equal(formatNumber(1.23456), '1,235', 'without decimals: three at most');
});

test('formatCount rounds to a whole number and groups it', () => {
    assert.equal(formatCount(0), '0');
    assert.equal(formatCount(1200), '1\u00a0200');
    assert.equal(formatCount(1234567), '1\u00a0234\u00a0567');
    assert.equal(formatCount(12.6), '13');
    assert.equal(formatCount(999.4), '999');
});

test('counted joins the number to its word with a non-breaking space', () => {
    assert.equal(counted(1, FORMS), '1\u00a0проект');
    assert.equal(counted(2, FORMS), '2\u00a0проекта');
    assert.equal(counted(5, FORMS), '5\u00a0проектов');
    assert.equal(counted(21, FORMS), '21\u00a0проект');
    assert.equal(counted(1200, FORMS), '1\u00a0200\u00a0проектов');
    assert.equal(counted(0, FORMS), '0\u00a0проектов');
    assert.equal(counted(111, FORMS), '111\u00a0проектов');
});

test('formatHours: one decimal under 1000 h, whole hours from 1000 h', () => {
    assert.equal(formatHours(0), '0,0\u00a0ч');
    assert.equal(formatHours(12.5 * HOUR), '12,5\u00a0ч');
    assert.equal(formatHours(HOUR), '1,0\u00a0ч');
    assert.equal(formatHours(999.94 * HOUR), '999,9\u00a0ч');
    assert.equal(formatHours(1000 * HOUR), '1\u00a0000\u00a0ч');
    assert.equal(formatHours(1234.6 * HOUR), '1\u00a0235\u00a0ч');
    assert.equal(formatHours(12345 * HOUR), '12\u00a0345\u00a0ч');
});

test('formatDuration: seconds under a minute, minutes under an hour, then hours', () => {
    assert.equal(formatDuration(0), '0\u00a0с');
    assert.equal(formatDuration(45000), '45\u00a0с');
    assert.equal(formatDuration(59 * 1000 + 400), '59\u00a0с');
    assert.equal(formatDuration(MINUTE), '1\u00a0мин');
    assert.equal(formatDuration(38 * MINUTE), '38\u00a0мин');
    assert.equal(formatDuration(59.6 * MINUTE), '60\u00a0мин');
    assert.equal(formatDuration(HOUR), '1,0\u00a0ч');
    assert.equal(formatDuration(2.5 * HOUR), '2,5\u00a0ч');
    assert.equal(formatDuration(1500 * HOUR), '1\u00a0500\u00a0ч');
});

test('formatSeconds: one decimal under ten seconds, whole seconds from ten, a dash for none', () => {
    assert.equal(formatSeconds(null), '—');
    assert.equal(formatSeconds(0), '0,0\u00a0с');
    assert.equal(formatSeconds(3800), '3,8\u00a0с');
    assert.equal(formatSeconds(9940), '9,9\u00a0с');
    assert.equal(formatSeconds(10000), '10\u00a0с');
    assert.equal(formatSeconds(12400), '12\u00a0с');
    assert.equal(formatSeconds(125000), '125\u00a0с');
    assert.equal(formatSeconds(1234000), '1\u00a0234\u00a0с');
});

test('shortCount: млн from a million, тыс. from a hundred thousand, plain below', () => {
    assert.equal(shortCount(0), '0');
    assert.equal(shortCount(1200), '1\u00a0200');
    assert.equal(shortCount(99999), '99\u00a0999');
    assert.equal(shortCount(100000), '100\u00a0тыс.');
    assert.equal(shortCount(123456), '123\u00a0тыс.');
    assert.equal(shortCount(999499), '999\u00a0тыс.');
    assert.equal(shortCount(1000000), '1,00\u00a0млн');
    assert.equal(shortCount(1234567), '1,23\u00a0млн');
    assert.equal(shortCount(12345678), '12,35\u00a0млн');
});

test('exactHours is the hover value: two decimals', () => {
    assert.equal(exactHours(0), '0,00\u00a0ч');
    assert.equal(exactHours(12.5 * HOUR), '12,50\u00a0ч');
    assert.equal(exactHours(HOUR / 3), '0,33\u00a0ч');
    assert.equal(exactHours(1234.567 * HOUR), '1\u00a0234,57\u00a0ч');
});

test('formatShare is a whole percent, a dash for none', () => {
    assert.equal(formatShare(null), '—');
    assert.equal(formatShare(0), '0%');
    assert.equal(formatShare(0.756), '76%');
    assert.equal(formatShare(1), '100%');
    assert.equal(formatShare(2 / 3), '67%');
});

test('projectName: no project, the project\'s name, or its number', () => {
    assert.equal(projectName(0, {}), 'Без проекта');
    assert.equal(projectName(0, { 0: 'ignored' }), 'Без проекта');
    assert.equal(projectName(7, { 7: 'Street scenes' }), 'Street scenes');
    assert.equal(projectName(8, { 7: 'Street scenes' }), 'Проект #8');
});

test('dayLabel: day, abbreviated month, the year on request', () => {
    assert.equal(dayLabel('2026-11-07'), '7\u00a0нояб.');
    assert.equal(dayLabel('2026-11-07', true), '7\u00a0нояб. 2026');
    assert.equal(dayLabel('2026-05-07'), '7\u00a0мая');
    assert.equal(dayLabel('2026-05-07', true), '7\u00a0мая 2026');
    assert.equal(dayLabel('2026-01-31'), '31\u00a0янв.');
    assert.equal(dayLabel('2026-02-01'), '1\u00a0февр.');
    assert.equal(dayLabel('2026-03-09'), '9\u00a0мар.');
    assert.equal(dayLabel('2026-12-24', true), '24\u00a0дек. 2026');
});

test('every month has its short form after a day number', () => {
    const expected = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
    expected.forEach((name, index) => {
        assert.equal(dayLabel(`2026-${String(index + 1).padStart(2, '0')}-15`), `15\u00a0${name}`);
    });
});

test('longDayLabel writes the day out in the genitive', () => {
    assert.equal(longDayLabel('2026-11-07'), '7\u00a0ноября 2026');
    assert.equal(longDayLabel('2026-05-01'), '1\u00a0мая 2026');
    assert.equal(longDayLabel('2026-03-31'), '31\u00a0марта 2026');
    assert.equal(longDayLabel('2026-01-02'), '2\u00a0января 2026');
    assert.equal(longDayLabel('2026-12-25'), '25\u00a0декабря 2026');
});

test('monthLabel is a heading: the month name in the nominative and the year', () => {
    assert.equal(monthLabel('2026-11'), 'Ноябрь 2026');
    assert.equal(monthLabel('2026-05'), 'Май 2026');
    assert.equal(monthLabel('2026-03'), 'Март 2026');
    assert.equal(monthLabel('2027-01'), 'Январь 2027');
    assert.equal(monthLabel('2026-12'), 'Декабрь 2026');
});

test('shortMonthLabel is a month on a chart scale, from a month or from a day', () => {
    assert.equal(shortMonthLabel('2026-11'), 'нояб. 2026');
    assert.equal(shortMonthLabel('2026-11-07'), 'нояб. 2026');
    assert.equal(shortMonthLabel('2026-05'), 'май 2026');
    assert.equal(shortMonthLabel('2026-05-31'), 'май 2026');
    assert.equal(shortMonthLabel('2026-03'), 'март 2026');
    assert.equal(shortMonthLabel('2026-06'), 'июнь 2026');
    assert.equal(shortMonthLabel('2026-07'), 'июль 2026');
    assert.equal(shortMonthLabel('2027-01'), 'янв. 2027');
});

test('the date labels read the string\'s parts, so the time zone cannot move them', () => {
    const labels = () => [
        dayLabel('2026-11-01'), dayLabel('2026-01-01', true), longDayLabel('2026-12-31'), monthLabel('2026-03'),
        shortMonthLabel('2026-03-31'),
    ];
    const original = process.env.TZ;
    const results = [];
    try {
        for (const zone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Europe/Moscow', 'America/New_York']) {
            process.env.TZ = zone;
            results.push(labels());
        }
    } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
    }
    for (const result of results) assert.deepEqual(result, results[0]);
    assert.deepEqual(results[0], [
        '1\u00a0нояб.', '1\u00a0янв. 2026', '31\u00a0декабря 2026', 'Март 2026', 'март 2026',
    ]);
});
