// Processed history on the page: one progress bar while history is processed, periods offered only
// when all of them is processed, no figure for a period that is not, and trends held back until three
// complete weeks are ready.
const assert = require('node:assert/strict');
const test = require('node:test');
const {
    React, act, loadPage, mount, render, suppliedService, text,
} = require('./helper.cjs');

const View = loadPage('team-analytics-view.tsx').default;

const FIGURES = { by_annotator: { rows: [{ user_id: 11, user_name: 'alice-figures', working_time_ms: 3600000 }] } };

// An overview of a period not wholly processed, as the service sends it: the envelope, and every figure null.
const NO_FIGURES = {
    period: {
        from: '2026-11-09T00:00:00+00:00', to: '2026-11-13T16:00:00+00:00', name: 'week', tz: 'UTC',
        first_day: '2026-11-09', last_day: '2026-11-15', month: null, to_date: false, unit: 'day',
    },
    filters: { project: null, annotator: { user_id: 11, user_name: 'alice-echoed' } },
    processed: false,
    headline: null,
    sessions: null,
    by_annotator: null,
    by_project: null,
    time_series: null,
    input: null,
    creation_methods: null,
    saved_boxes: null,
    operations: {
        legacy: false, partly_legacy: true, cutover: '2026-11-10T08:00:00+00:00', shapes: 'bounding_boxes',
        working_time_ms: null, active_time_ms: null, rows: null,
    },
};

// The history block of the status (only administrators read it).
function history(overrides = {}) {
    return {
        complete: false,
        percent: 6,
        ready_from: '2026-11-02T00:00:00+00:00',
        ready_from_day: '2026-11-02',
        first_day: '2026-04-30',
        days_ready: 12,
        days_total: 198,
        periods: {
            week: true, two_weeks: false, month: false, year: false,
        },
        earliest_month: null,
        complete_weeks: 1,
        trends_ready: false,
        ...overrides,
    };
}

function view({ status = { history: history() }, overview = FIGURES, address = { period: 'week', month: null } } = {}) {
    return render(View, {
        organization: 'team-org',
        state: { kind: 'ready', overview },
        address,
        onAddressChange() {},
        currentMonth: '2026-11',
        status,
        timeZone: 'UTC',
    });
}

function buttons(html) {
    // [label or aria-label, disabled, title] of every button
    return [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map(([, attributes, inner]) => ({
        name: (attributes.match(/aria-label="([^"]*)"/) || [])[1] || text(inner),
        disabled: /\sdisabled=""/.test(attributes),
        title: (attributes.match(/title="([^"]*)"/) || [])[1] || null,
    }));
}

test('an overview without figures shows only why, and the filter row still names the selected annotator', () => {
    const shown = text(view({ overview: NO_FIGURES, address: { period: 'week', month: null, annotator: 11 } }));
    assert.match(shown, /Этот период ещё не обработан/);
    assert.match(shown, /alice-echoed/);
});

test('while history is processed one progress bar shows the earliest ready date and how far it is', () => {
    const html = view();
    const shown = text(html);
    assert.match(shown, /Обработка истории/);
    assert.match(shown, /Готово с 2 нояб\. 2026 · 12 из 198 дней/);
    assert.match(shown, /6%/);
    assert.equal((html.match(/role="progressbar"/g) || []).length, 1);
    assert.match(html, /aria-valuenow="6"/);
    assert.match(shown, /Сначала обрабатываются последние дни\./);
});

// a status without the day counts (an older server): the bar still reads
function percentOnlyHistory(overrides = {}) {
    const block = history({ percent: 37, ...overrides });
    for (const key of ['ready_from', 'ready_from_day', 'first_day', 'days_ready', 'days_total']) delete block[key];
    return block;
}

test('without the day counts the progress bar reads as the percentage alone', () => {
    const html = view({ status: { history: percentOnlyHistory() } });
    const shown = text(html);
    assert.match(shown, /Обработка истории/);
    assert.match(shown, /37%/);
    assert.match(html, /aria-valuenow="37"/);
    assert.match(html, /width:\s*37%/);
    assert.doesNotMatch(shown, /из \d+ дн|Готово с|Пока ничего не готово|undefined|NaN/);
});

test('with the day counts the line shows them and the bar the percentage from the service', () => {
    const shown = text(view({ status: { history: history({ percent: 7 }) } }));
    assert.match(shown, /Готово с 2 нояб\. 2026 · 12 из 198 дней/);
    assert.match(shown, /7%/);
});

test('without the day counts the periods are still offered only when processed', () => {
    const periods = buttons(view({ status: { history: percentOnlyHistory() } }))
        .filter((b) => ['Неделя', 'Две недели', 'Месяц', 'Год'].includes(b.name));
    assert.deepEqual(periods.map((b) => [b.name, b.disabled]), [
        ['Неделя', false], ['Две недели', true], ['Месяц', true], ['Год', true],
    ]);
});

test('no progress bar once history is complete, or when the status is not known', () => {
    for (const status of [{ history: history({ complete: true, ready_from: null, ready_from_day: null }) }, null, {}]) {
        const html = view({ status });
        assert.doesNotMatch(text(html), /Обработка истории/);
        assert.doesNotMatch(html, /role="progressbar"/);
    }
});

test('before anything is processed the bar says nothing is ready yet', () => {
    const shown = text(view({ status: { history: history({
        ready_from: null, ready_from_day: null, days_ready: 0, percent: 0,
    }) } }));
    assert.match(shown, /Пока ничего не готово · 0 из 198 дней/);
    assert.match(shown, /0%/);
});

test('the day count of the progress bar takes the Russian plural form of the total', () => {
    // "из N дня" is genitive: 1 and 21 take "дня", the rest "дней" (11 and 12 included)
    const forms = [[1, 'дня'], [2, 'дней'], [5, 'дней'], [11, 'дней'], [21, 'дня']];
    for (const [total, word] of forms) {
        const shown = text(view({ status: { history: history({ days_total: total, days_ready: 0 }) } }));
        assert.match(shown, new RegExp(`0 из ${total} ${word}(?![а-я])`), `${total}`);
    }
});

test('periods not wholly processed are disabled with an explanation', () => {
    const periods = buttons(view()).filter((b) => ['Неделя', 'Две недели', 'Месяц', 'Год'].includes(b.name));
    assert.deepEqual(periods.map((b) => [b.name, b.disabled, b.title]), [
        ['Неделя', false, null],
        ['Две недели', true, 'Ещё не обработано'],
        ['Месяц', true, 'Ещё не обработано'],
        ['Год', true, 'Ещё не обработано'],
    ]);
});

test('every period is offered once history is complete, or when the status is not known', () => {
    for (const status of [{ history: history({ complete: true, periods: { week: true, two_weeks: true, month: true, year: true } }) }, null]) {
        assert.ok(buttons(view({ status })).every((b) => !b.disabled || b.name === 'Следующий месяц'));
    }
});

test('an earlier month is offered only when all of it is processed', () => {
    const month = { period: 'month', month: '2026-10' };
    const status = (overrides) => ({ history: history({ periods: { week: true, two_weeks: true, month: true, year: false }, ...overrides }) });
    const previous = (html) => buttons(html).find((b) => b.name === 'Предыдущий месяц');
    assert.equal(previous(view({ address: month, status: status({ earliest_month: '2026-10' }) })).disabled, true);
    assert.equal(previous(view({ address: month, status: status({ earliest_month: '2026-10' }) })).title, 'Ещё не обработано');
    assert.equal(previous(view({ address: month, status: status({ earliest_month: '2026-09' }) })).disabled, false);
    assert.equal(previous(view({ address: month, status: status({ complete: true, earliest_month: null }) })).disabled, false);
});

test('a period that is not wholly processed shows no figure, only why', () => {
    const shown = text(view({ overview: NO_FIGURES }));
    assert.doesNotMatch(shown, /alice-figures|1,0 ч/);
    assert.match(shown, /Этот период ещё не обработан/);

    assert.match(text(view({ overview: { ...FIGURES, processed: true } })), /alice-figures/);
    assert.match(text(view({ overview: FIGURES })), /alice-figures/); // a service that does not say
});

test('trends are replaced by a short notice until three complete weeks are ready', () => {
    const shown = text(view({ status: { history: history({ complete_weeks: 2 }) } }));
    assert.match(shown, /Динамика появится по мере обработки истории/);
    assert.match(shown, /Для динамики нужно не менее трёх полных недель\. Пока готовы две\./);
    assert.match(text(view({ status: { history: history({ complete_weeks: 0 }) } })), /Пока нет ни одной\./);
    assert.match(text(view({ status: { history: history({ complete_weeks: 1 }) } })), /Пока готова одна\./);

    for (const status of [{ history: history({ complete_weeks: 3, trends_ready: true }) }, null]) {
        assert.doesNotMatch(text(view({ status })), /Динамика появится по мере обработки истории/);
    }
});

test('an open page shows the figures once its period has been processed meanwhile', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: Date.parse('2026-11-13T15:30:00Z') });
    let processed = false;
    const { request, requests } = suppliedService((url) => {
        if (url.includes('/status')) {
            return { body: { history: processed ? history({ complete: true }) : history({ periods: { week: false } }) } };
        }
        return { body: processed ? { ...FIGURES, processed } : NO_FIGURES };
    });
    const Page = loadPage('team-analytics-page.tsx', {
        'react-redux': { useSelector: (select) => select({ organizations: { current: { slug: 'team-org' } } }) },
        'react-router': { useHistory: () => ({ push() {} }) },
        './service': { ...loadPage('service.ts'), requestService: request, viewerTimeZone: () => 'UTC' },
    }).default;
    const view = await mount(React.createElement(Page));
    const overviews = () => requests.filter((request) => request.url.includes('/overview')).length;
    try {
        await view.settle();
        assert.match(view.container.textContent, /Этот период ещё не обработан/);
        await act(async () => { t.mock.timers.tick(60000); }); // still not processed: no new request
        await view.settle();
        assert.equal(overviews(), 1);

        processed = true;
        await act(async () => { t.mock.timers.tick(60000); });
        await view.settle();
        assert.equal(overviews(), 2);
        assert.match(view.container.textContent, /alice-figures/);
        assert.doesNotMatch(view.container.textContent, /Этот период ещё не обработан|Обработка истории/);
    } finally {
        await view.unmount();
    }
});

test('the page asks for the status in the viewer time zone and shows the bar beside the notice', async () => {
    const { request, requests } = suppliedService((url) => (url.includes('/status') ?
        { body: { history: history() } } :
        { body: NO_FIGURES }));
    const Page = loadPage('team-analytics-page.tsx', {
        'react-redux': { useSelector: (select) => select({ organizations: { current: { slug: 'team-org' } } }) },
        'react-router': { useHistory: () => ({ push() {} }) },
        './service': { ...loadPage('service.ts'), requestService: request, viewerTimeZone: () => 'Asia/Tokyo' },
    }).default;
    const view = await mount(React.createElement(Page));
    try {
        await view.settle();
        const status = requests.find((request) => request.url.includes('/status'));
        assert.ok(status, 'status is requested');
        assert.equal(new URL(status.url, 'http://localhost').searchParams.get('tz'), 'Asia/Tokyo');
        const shown = view.container.textContent;
        assert.match(shown, /Обработка истории/);
        assert.match(shown, /Этот период ещё не обработан/);
        assert.doesNotMatch(shown, /alice-figures/);
    } finally {
        await view.unmount();
    }
});
