// Operations, all shapes: headline figures, where working time goes, the operations table and the
// legacy-period notice, from the `operations` section the service sends.
const assert = require('node:assert/strict');
const test = require('node:test');
const {
    React, act, dependency, loadPage, mount, render, suppliedService, text,
} = require('./helper.cjs');

const { createMemoryHistory } = dependency('history');

const View = loadPage('team-analytics-view.tsx').default;
const service = loadPage('service.ts');
const HOUR = 3600000;

function row(operation, objects, timeMs, averageMs, share) {
    return { operation, objects, timed_objects: objects, time_ms: timeMs, average_ms: averageMs, share };
}

// 10 h of working time: creation 4 h, alignment 0,5 h, class change 0, deletion 0,3 h, Other 5,2 h
const OPERATIONS = {
    legacy: false,
    working_time_ms: 10 * HOUR,
    active_time_ms: 10 * HOUR,
    rows: [
        row('creation', 3456, 4 * HOUR, 4166.7, 0.4),
        row('alignment', 900, 0.5 * HOUR, 2000, 0.05),
        row('class_change', 0, 0, null, 0),
        row('deletion', 120, 0.3 * HOUR, 9000, 0.03),
        { operation: 'other', objects: 0, timed_objects: 0, time_ms: 5.2 * HOUR, average_ms: null, share: 0.52 },
    ],
};

function ready(operations) {
    return { organization: 'team-org', state: { kind: 'ready', overview: { by_annotator: { rows: [] }, operations } } };
}

function section(html, className) {
    const match = html.match(new RegExp(`<section[^>]*${className}[^>]*>(.*?)</section>`));
    assert.ok(match, `${className} is shown`);
    return text(match[1]);
}

test('headline figures show objects created and the average time to create one', () => {
    const html = render(View, ready(OPERATIONS));
    assert.equal(section(html, 'cvat-team-analytics-objects-created'), 'Создано объектов 3 456 аннотаторами');
    assert.equal(section(html, 'cvat-team-analytics-average-creation'), 'Ср. время на объект 4,2 с на создание одного');
});

test('the average time reads in seconds, with one decimal under ten', () => {
    const average = (ms) => section(render(View, ready({
        ...OPERATIONS,
        rows: OPERATIONS.rows.map((r) => (r.operation === 'creation' ? { ...r, average_ms: ms } : r)),
    })), 'cvat-team-analytics-average-creation');
    assert.equal(average(970), 'Ср. время на объект 1,0 с на создание одного');
    assert.equal(average(12400), 'Ср. время на объект 12 с на создание одного');
    assert.equal(average(null), 'Ср. время на объект — на создание одного');
});

test('large counts are shortened in the tile with the exact value on hover', () => {
    const html = render(View, ready({
        ...OPERATIONS,
        rows: OPERATIONS.rows.map((r) => (r.operation === 'creation' ? { ...r, objects: 1234567 } : r)),
    }));
    assert.equal(section(html, 'cvat-team-analytics-objects-created'), 'Создано объектов 1,23 млн аннотаторами');
    assert.match(html, /title="Точное значение: 1\u00a0234\u00a0567"/);
});

test('operations reach the page from the overview response', async () => {
    const { request } = suppliedService(() => ({ body: { by_annotator: { rows: [] }, operations: OPERATIONS } }));
    const state = await service.loadOverview({ organization: 'team-org', timeZone: 'UTC' }, request);
    assert.equal(state.kind, 'ready');
    assert.deepEqual(state.overview.operations, OPERATIONS);
});

test('a response without operations shows no operation cards', () => {
    const html = render(View, { organization: 'team-org', state: { kind: 'ready', overview: { by_annotator: { rows: [] } } } });
    assert.doesNotMatch(html, /cvat-team-analytics-objects-created|cvat-team-analytics-split|cvat-team-analytics-operations/);
});

function legend(html) {
    const card = html.match(/<section[^>]*cvat-team-analytics-split[^>]*>(.*?)<\/section>/);
    assert.ok(card, 'the split card is shown');
    return [...card[1].matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((item) => text(item[1]));
}

test('the split shows how working time divides between the operations and Other, legend inside the card', () => {
    const html = render(View, ready(OPERATIONS));
    assert.ok(section(html, 'cvat-team-analytics-split')
        .startsWith('Куда уходит рабочее время Все фигуры · 10,0 ч рабочего времени'));
    assert.deepEqual(legend(html), [
        'Создание 4,0 ч 40%',
        'Подгонка 0,5 ч 5%',
        'Смена класса 0,0 ч 0%',
        'Удаление 0,3 ч 3%',
        'Прочее 5,2 ч 52%',
    ]);
});

test('each part of the bar is as wide as its time and names itself on hover', () => {
    const html = render(View, ready(OPERATIONS));
    const parts = [...html.matchAll(/<div class="cvat-team-analytics-split-part"[^>]*>/g)].map((m) => m[0]);
    assert.equal(parts.length, 5);
    assert.match(parts[0], /title="Создание: 4,0\u00a0ч \(40%\)"/);
    assert.match(parts[0], /flex:4 1 0/);
    assert.match(parts[4], /title="Прочее: 5,2\u00a0ч \(52%\)"/);
    // a large part carries its share inside; small ones rely on the legend
    assert.match(html, /cvat-team-analytics-split-part"[^>]*>40%<\/div>/);
    assert.doesNotMatch(html, /cvat-team-analytics-split-part"[^>]*>5%<\/div>/);
});

// the header row and each operation's row of figures (the hotkey / mouse rows below them left out)
function tableRows(html) {
    const card = html.match(/<section[^>]*cvat-team-analytics-operations[^>]*>(.*?)<\/section>/);
    assert.ok(card, 'the operations table is shown');
    return [...card[1].matchAll(/<tr([^>]*)>(.*?)<\/tr>/g)]
        .filter((tr) => !tr[1].includes('cvat-team-analytics-input-split-row'))
        .map((tr) => [...tr[2].matchAll(/<t[hd][^>]*>(.*?)<\/t[hd]>/g)].map((cell) => text(cell[1])));
}

// the visible text of each operation's hotkey / mouse row
function splitRows(html) {
    const card = html.match(/<section[^>]*cvat-team-analytics-operations[^>]*>(.*?)<\/section>/);
    return [...card[1].matchAll(/<tr class="cvat-team-analytics-input-split-row">(.*?)<\/tr>/g)]
        .map((tr) => text(tr[1].replace(/<span class="cvat-team-analytics-visually-hidden">.*?<\/span>/, '')));
}

test('a table lists each operation with its count, average time, total time and share of working time', () => {
    assert.deepEqual(tableRows(render(View, ready(OPERATIONS))), [
        ['Операция', 'Объекты', 'Ср. время', 'Общее время', 'Доля'],
        ['Создание', '3 456', '4,2 с', '4,0 ч', '40%'],
        ['Подгонка', '900', '2,0 с', '0,5 ч', '5%'],
        ['Смена класса', '0', '—', '0,0 ч', '0%'],
        ['Удаление', '120', '9,0 с', '0,3 ч', '3%'],
    ]);
    assert.deepEqual(splitRows(render(View, ready(OPERATIONS))), ['—', 'Только мышью', '—', '—']);
});

test('the table has five columns and no minimum width; each split row spans them under its operation', () => {
    const html = render(View, ready(OPERATIONS));
    const card = html.match(/<section[^>]*cvat-team-analytics-operations[^>]*>(.*?)<\/section>/)[1];
    assert.match(card, /<table class="cvat-team-analytics-operations-table">/);
    // the shared table class (min-width 440px) is not used here
    assert.doesNotMatch(card, /class="cvat-team-analytics-table"/);
    assert.equal((card.match(/<th scope="col"/g) || []).length, 5);
    // one group per operation: its row header and the split row naming it through `headers`
    const groups = [...card.matchAll(/<tbody class="cvat-team-analytics-operation-group">(.*?)<\/tbody>/g)];
    assert.equal(groups.length, 4);
    for (const [, group] of groups) {
        const id = group.match(/<th scope="row" id="([^"]+)"/)[1];
        // React's static markup writes the attribute as colSpan
        assert.ok(group.includes(`<td colSpan="5" headers="${id}"`), group);
    }
    assert.match(card, /<span class="cvat-team-analytics-visually-hidden">Создание, начато: <\/span>/);
});

test('a legacy period shows the notice and marks class change as not recorded', () => {
    const html = render(View, ready({ ...OPERATIONS, legacy: true }));
    const notice = html.match(/<div[^>]*cvat-team-analytics-legacy-notice[^>]*>(.*?)<\/div><\/div>/);
    assert.ok(notice, 'the legacy notice is shown');
    assert.equal(text(notice[1]),
        'Этот период записан до перехода на новый учёт действий ' +
        'Старые события не указывают, какая фигура была изменена, поэтому операции и время ниже ' +
        'относятся ко всем фигурам. Смены класса и использование горячих клавиш не записывались и ' +
        'учитываются со дня запуска нового учёта действий. Проекты, сессии, рабочее время и число ' +
        'сохранённых боксов учтены полностью.');
    assert.deepEqual(tableRows(html)[3], ['Смена класса', 'Не записано', '—', '—', '—']);
    assert.equal(splitRows(html)[2], 'Не записано');
    // the split leaves out what was not recorded instead of showing it as zero
    assert.deepEqual(legend(html).map((item) => item.split(' ')[0]), ['Создание', 'Подгонка', 'Удаление', 'Прочее']);
});

test('a period with shape-tagged events shows no legacy notice and counts class changes', () => {
    const html = render(View, ready(OPERATIONS));
    assert.doesNotMatch(html, /cvat-team-analytics-legacy-notice/);
    assert.deepEqual(tableRows(html)[3], ['Смена класса', '0', '—', '0,0 ч', '0%']);
});

test('operations with no measured time and no working time show no shares', () => {
    const untimed = {
        legacy: false,
        working_time_ms: 0,
        active_time_ms: 0,
        rows: ['creation', 'alignment', 'class_change', 'deletion', 'other'].map((name) => (
            { ...row(name, name === 'creation' ? 2 : 0, 0, null, null), timed_objects: 0 }
        )),
    };
    assert.deepEqual(legend(render(View, ready(untimed))), [
        'Создание 0,0 ч —', 'Подгонка 0,0 ч —', 'Смена класса 0,0 ч —', 'Удаление 0,0 ч —', 'Прочее 0,0 ч —',
    ]);
});

test('a period with no job work shows the empty state, not the legacy notice', () => {
    const empty = {
        legacy: false,
        working_time_ms: 0,
        active_time_ms: 0,
        rows: ['creation', 'alignment', 'class_change', 'deletion', 'other'].map((name) => row(name, 0, 0, null, null)),
    };
    const html = render(View, ready(empty));
    assert.doesNotMatch(html, /cvat-team-analytics-legacy-notice/);
    assert.equal(section(html, 'cvat-team-analytics-split'), 'Куда уходит рабочее время В этом периоде нет работы в заданиях');
});

// --- the mounted page: the operations cards follow the project and annotator filters -------------

// the service's answer for a request: creation figures depend on the filters it carries
function filteredAnswer(url) {
    if (url.includes('/status')) return { body: {} };
    const params = new URL(url, 'http://localhost').searchParams;
    const created = { 'null null': 3456, '2 null': 40, '2 12': 7 }[`${params.get('project')} ${params.get('annotator')}`];
    return {
        body: {
            by_annotator: {
                rows: [{ user_id: 12, user_name: 'bob', working_time_ms: HOUR }],
                rest: { count: 0, working_time_ms: 0 },
            },
            by_project: { rows: [{ project_id: 2, working_time_ms: HOUR }], rest: { count: 0, working_time_ms: 0 } },
            filters: { project: null, annotator: null },
            operations: {
                ...OPERATIONS,
                rows: OPERATIONS.rows.map((r) => (r.operation === 'creation' ? { ...r, objects: created } : r)),
            },
        },
    };
}

test('the operations cards show the figures read with the chosen project and annotator', async () => {
    const history = createMemoryHistory({ initialEntries: ['/team-analytics'] });
    const { request, requests } = suppliedService(filteredAnswer);
    const Page = loadPage('team-analytics-page.tsx', {
        'react-redux': { useSelector: (select) => select({ organizations: { current: { slug: 'team-org' } } }) },
        'react-router': { useHistory: () => history },
        './service': { ...loadPage('service.ts'), requestService: request },
        './project-names': { lookupProjectNames: async () => ({ 2: 'Retail shelves' }) },
    }).default;
    const click = async (element) => {
        await act(async () => { element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
    };
    const created = (container) => text(container.querySelector('.cvat-team-analytics-objects-created').innerHTML.replace(/&nbsp;/g, ' '));
    const creationRow = (container) => text(
        container.querySelector('.cvat-team-analytics-operations tbody tr').innerHTML.replace(/&nbsp;/g, ' '),
    );
    const lastOverview = () => {
        const url = requests.filter((request) => !request.url.includes('/status')).at(-1).url;
        const params = new URL(url, 'http://localhost').searchParams;
        return [params.get('project'), params.get('annotator')];
    };

    const view = await mount(React.createElement(Page));
    try {
        await view.settle();
        assert.equal(created(view.container), 'Создано объектов 3 456 аннотаторами');

        await click(view.container.querySelector('.cvat-team-analytics-project-row'));
        await view.settle();
        assert.deepEqual(lastOverview(), ['2', null]);
        assert.equal(created(view.container), 'Создано объектов 40 аннотаторами');
        assert.match(creationRow(view.container), /^Создание 40 /);

        await click(view.container.querySelector('.cvat-team-analytics-annotator-row'));
        await view.settle();
        assert.deepEqual(lastOverview(), ['2', '12']);
        assert.equal(created(view.container), 'Создано объектов 7 аннотаторами');
        assert.match(creationRow(view.container), /^Создание 7 /);
    } finally {
        await view.unmount();
    }
});
