// A guard that the page shows no English: every main state of the page is mounted in jsdom with supplied
// answers, and the visible text and the title / aria-label / placeholder / alt values must hold no Latin-letter
// word, apart from a short allowlist: the names the page keeps in English, and the fixture's own data (user and
// project names, the organization slug, the viewer's hotkey names and keys, the server's refusal reason), each
// kept below in a named constant. Anything else, such as a new English string in the page's source, fails
// with the fragment and its context.
const assert = require('node:assert/strict');
const test = require('node:test');
const {
    React, act, dependency, loadPage, mount, suppliedService, suppliedSettings, text,
} = require('./helper.cjs');

const { createMemoryHistory } = dependency('history');
const HOUR = 3600000;
const MINUTE = 60000;

// --- the allowlist ---------------------------------------------------------------------------------------------

// words the page keeps in English
const KEPT_IN_ENGLISH = ['Team Analytics', 'Grafana', 'CVAT', 'ID'];

// the fixture's own data
const USER_NAMES = ['alice', 'bob', 'user0', 'user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7', 'user8',
    'ta-bot', 'old-importer', 'ta-loader', 'tamara', 'Upload', 'Script'];
const PROJECT_NAMES = ['Street scenes'];
const ORGANIZATION = 'team-org';
// the viewer's keymap: names and keys as CVAT's own English keymap gives them, and an action the keymap does not
// know, which the page shows by its name
const HOTKEY_NAMES = ['Next frame', 'Save the job'];
const KEY_NAMES = ['Ctrl+s', 'Ctrl', 'f'];
const UNKNOWN_ACTION = 'UNKNOWN_ACTION';
// the refusal reason of the server, shown as it is in the settings dialog
const SERVER_REASON = 'The server refused this list.';

const FIXTURE_DATA = [...USER_NAMES, ...PROJECT_NAMES, ORGANIZATION, ...HOTKEY_NAMES, ...KEY_NAMES, UNKNOWN_ACTION,
    SERVER_REASON];
const ALLOWED = [...KEPT_IN_ENGLISH, ...FIXTURE_DATA];

const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// a word is removed whole, never as a part of a longer Latin word
const ALLOWED_PATTERN = new RegExp(
    `(?<![A-Za-z])(?:${[...ALLOWED].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![A-Za-z])`, 'g',
);

// --- the check -------------------------------------------------------------------------------------------------

const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'];

// what a reader sees: the text, and the values of the attributes that are read out or shown on hover
function visible(root) {
    const html = root.innerHTML
        .replace(/<(style|script)[^>]*>.*?<\/\1>/gs, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // an icon of the antd library names itself by its picture (aria-label="setting"): not a string of the page, and
    // the icons carry no title
    const attributes = [...root.querySelectorAll(ATTRIBUTES.map((name) => `[${name}]`).join(','))]
        .filter((element) => !(element.classList.contains('anticon') && element.getAttribute('role') === 'img'))
        .flatMap((element) => ATTRIBUTES.map((name) => element.getAttribute(name)).filter(Boolean));
    return { text: text(html), attributes };
}

// the fragments of the shown strings that hold an English word, each with some context
function englishIn({ text: shown, attributes }) {
    const found = [];
    const scan = (source, where) => {
        const cleaned = source.replace(ALLOWED_PATTERN, (match) => ' '.repeat(match.length));
        for (const match of cleaned.matchAll(/[A-Za-z]{2,}/g)) {
            const from = Math.max(0, match.index - 40);
            found.push(`${where}: "${match[0]}" in "${source.slice(from, match.index + match[0].length + 40)}"`);
        }
    };
    scan(shown, 'text');
    attributes.forEach((value) => scan(value, 'attribute'));
    return found;
}

function assertRussian(root, state) {
    const shown = visible(root);
    assert.ok(shown.text.length > 0, `${state}: the page shows some text`);
    const found = englishIn(shown);
    assert.deepEqual(found, [], `${state}: English on the page:\n${found.join('\n')}`);
    return shown;
}

test('the check itself finds English in text and attributes, and the allowlist hides only its own words', () => {
    const dom = (html) => {
        const root = document.createElement('div');
        root.innerHTML = html;
        return root;
    };
    assert.deepEqual(englishIn(visible(dom('<p>Страница Team Analytics, CVAT, Grafana, ID 5</p>'))), []);
    assert.deepEqual(englishIn(visible(dom('<p>alice и Street scenes в team-org</p>'))), []);
    assert.equal(englishIn(visible(dom('<p>Team Analytics settings</p>'))).length, 1, 'a word beside an allowed one');
    assert.equal(englishIn(visible(dom('<p>Страница</p><button title="Save" aria-label="Close" placeholder="Search"></button>')))
        .length, 3, 'attributes');
    assert.equal(englishIn(visible(dom('<p>alicexyz и Identity</p>'))).length, 2, 'an allowed word inside a longer one');
    assert.equal(englishIn(visible(dom('<p>a 5 h ч&nbsp;м</p>'))).length, 0, 'single letters and entities are not words');
    assert.throws(() => assertRussian(dom('<p>Hello</p>'), 'a state'), /English on the page/);
});

// --- the fixture -----------------------------------------------------------------------------------------------

const PERIOD = {
    name: 'week', first_day: '2026-11-07', last_day: '2026-11-13', month: null, to_date: false, unit: 'day',
};

function opsRow(operation, objects, timeMs) {
    return {
        operation, objects, timed_objects: objects, time_ms: timeMs,
        average_ms: objects ? timeMs / objects : null, share: 0.2, hotkey_objects: 0, mouse_objects: objects,
    };
}

function figures(objects, timeMs) {
    return {
        objects, timed_objects: objects, time_ms: timeMs, average_ms: objects ? timeMs / objects : null,
    };
}

const OPERATIONS = {
    legacy: false,
    shapes: 'bounding_boxes',
    working_time_ms: 37 * HOUR,
    active_time_ms: 37 * HOUR,
    rows: [opsRow('creation', 100, 400000), opsRow('alignment', 10, 50000), opsRow('class_change', 2, 4000),
        opsRow('deletion', 3, 3000), opsRow('other', 0, 37 * HOUR - 457000)],
};

const OVERVIEW = {
    period: PERIOD,
    by_annotator: {
        rows: [
            { user_id: 11, user_name: 'alice', working_time_ms: 9 * HOUR },
            { user_id: 12, user_name: 'bob', working_time_ms: 8 * HOUR },
        ],
        rest: { count: 10, working_time_ms: 20 * HOUR },
    },
    by_project: {
        rows: [{ project_id: 1, working_time_ms: 10 * HOUR }, { project_id: 0, working_time_ms: 3 * HOUR },
            { project_id: 7, working_time_ms: HOUR }],
        rest: { count: 2, working_time_ms: 2 * HOUR },
    },
    headline: { annotators: 12, projects: 3 },
    filters: { project: null, annotator: null },
    sessions: {
        sessions: 42,
        average_ms: 38 * MINUTE,
        total_ms: 42 * 38 * MINUTE,
        by_annotator: [
            { user_id: 11, user_name: 'alice', sessions: 30, average_ms: 40 * MINUTE, total_ms: 1200 * MINUTE },
            { user_id: 12, user_name: 'bob', sessions: 12, average_ms: 33 * MINUTE, total_ms: 396 * MINUTE },
        ],
    },
    time_series: {
        unit: 'day',
        buckets: ['07', '08', '09', '10', '11', '12', '13'].map((day, index) => ({
            start: `2026-11-${day}`, working_time_ms: (index + 1) * HOUR,
        })),
    },
    operations: OPERATIONS,
    creation_methods: {
        shapes: 'bounding_boxes',
        rows: [
            { method: 'drawn', objects: 90, timed_objects: 90, time_ms: 360000, average_ms: 4000, share: 0.8 },
            { method: 'pasted', objects: 10, timed_objects: 10, time_ms: 40000, average_ms: 4000, share: 0.1 },
            { method: 'propagated', objects: 0, timed_objects: 0, time_ms: 0, average_ms: null, share: 0 },
        ],
        total: {
            objects: 100, timed_objects: 100, time_ms: 400000, average_ms: 4000,
        },
        model: { objects: 12, share: 0.1 },
        technical_accounts: 2,
    },
    saved_boxes: {
        boxes: 1450,
        by_annotator: [{ user_id: 11, user_name: 'alice', boxes: 650 }],
        by_project: [{ project_id: 1, boxes: 1450 }],
    },
    input: {
        hotkey_actions: 300,
        mouse_actions: 100,
        canvas_clicks: 50,
        hotkey_share: 0.75,
        top_hotkeys: [{ action: 'NEXT_FRAME', actions: 200 }, { action: 'SAVE_JOB', actions: 60 }],
        rest: { count: 2, actions: 100 },
    },
    processed: true,
};

// one list row: working time split as creation 1/4, other the rest
function listRow(id, name, hours) {
    return {
        id,
        user_name: name,
        working_time_ms: hours * HOUR,
        share: hours / 37,
        operations: {
            creation: figures(10 * hours, hours * HOUR / 4),
            alignment: figures(hours, 0),
            class_change: figures(0, 0),
            deletion: figures(1, 2000),
            other: { time_ms: hours * HOUR * 0.75 - 2000 },
        },
        methods: {
            drawn: figures(8 * hours, hours * HOUR / 5),
            pasted: figures(2 * hours, hours * HOUR / 20),
            propagated: figures(0, 0),
        },
        model: hours,
    };
}

const ANNOTATORS = [listRow(11, 'alice', 9), listRow(12, 'bob', 8),
    ...Array.from({ length: 9 }, (_, index) => listRow(20 + index, `user${index}`, 2))];

function listAnswer(url, overview) {
    const params = new URL(url, 'http://localhost').searchParams;
    const base = { period: overview.period ?? PERIOD, processed: true, by: params.get('by') };
    if (params.get('by') === 'hotkeys') {
        return {
            body: {
                ...base,
                hotkey_actions: 300,
                rows: [
                    { action: 'NEXT_FRAME', actions: 200, share: 2 / 3 },
                    { action: 'SAVE_JOB', actions: 60, share: 0.2 },
                    { action: UNKNOWN_ACTION, actions: 40, share: 40 / 300 },
                ],
            },
        };
    }
    const rows = params.get('by') === 'projects' ?
        [listRow(1, null, 10), listRow(0, null, 3), listRow(7, null, 1)] : ANNOTATORS;
    return {
        body: {
            ...base,
            legacy: !!overview.operations?.legacy,
            shapes: params.get('shapes') === 'all' ? 'all' : 'bounding_boxes',
            total: { count: rows.length, working_time_ms: 37 * HOUR },
            rows,
        },
    };
}

const WEEKS = ['2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05',
    '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'];

function trendsAnswer(url) {
    const ids = (new URL(url, 'http://localhost').searchParams.get('ids') ?? '').split(',').filter(Boolean).map(Number);
    const point = (index) => ({
        working_time_ms: (index + 1) * HOUR, legacy: false, boxes: 10 * (index + 1), timed_boxes: 10 * (index + 1),
        box_time_ms: 40000 * (index + 1), average_ms: 4000, hotkey_recorded: true, hotkey_actions: 3,
        mouse_actions: 1, hotkey_share: 0.75,
    });
    return {
        body: {
            step: 'week', tz: 'UTC', shapes: 'bounding_boxes', compare: 'annotators',
            buckets: WEEKS.map((start) => ({ start, processed: true })),
            lines: (ids.length ? ids : [null]).map((id) => ({
                id, user_name: id === 11 ? 'alice' : null, points: WEEKS.map((_, index) => point(index)),
            })),
            candidates: [{ id: 11, user_name: 'alice', working_time_ms: HOUR }],
        },
    };
}

function detailRow(id, overrides = {}) {
    return {
        id,
        user_name: `user${id}`,
        projects: 2,
        sessions: 3,
        working_time_ms: 2.5 * HOUR,
        drawn: 1200,
        pasted: 3,
        propagated: 2,
        model: 4,
        saved_boxes: 9,
        alignments: 1,
        class_changes: 2,
        deletions: 1,
        average_create_ms: 5000,
        hotkey_share: 0.75,
        ...overrides,
    };
}

const DETAILS = {
    by: 'annotators', page: 1, page_size: 10, total: 2, legacy: false, shapes: 'bounding_boxes', processed: true,
    technical_accounts: 1,
    rows: [detailRow(11, { user_name: 'alice' }), detailRow(12, { user_name: 'bob', hotkey_share: null, average_create_ms: null })],
};

const HISTORY_DONE = {
    complete: true,
    percent: 100,
    ready_from: '2026-04-30T00:00:00+00:00',
    ready_from_day: '2026-04-30',
    first_day: '2026-04-30',
    days_ready: 198,
    days_total: 198,
    periods: {
        week: true, two_weeks: true, month: true, year: true,
    },
    earliest_month: '2026-04',
    complete_weeks: 12,
    trends_ready: true,
};

const HISTORY_RUNNING = {
    ...HISTORY_DONE,
    complete: false,
    percent: 6,
    ready_from: '2026-11-02T00:00:00+00:00',
    ready_from_day: '2026-11-02',
    days_ready: 12,
    periods: {
        week: true, two_weeks: false, month: false, year: false,
    },
    earliest_month: null,
    complete_weeks: 1,
    trends_ready: false,
};

function refresh(overrides = {}) {
    return {
        last_success_at: '2026-11-13T15:20:00+00:00',
        now: '2026-11-13T15:30:00+00:00',
        interval_s: 600,
        stale_after_s: 1800,
        stale: false,
        ...overrides,
    };
}

const KEYMAP = {
    keyMap: { NEXT_FRAME: { name: HOTKEY_NAMES[0] }, SAVE_JOB: { name: HOTKEY_NAMES[1] } },
    normalizedKeyMap: { NEXT_FRAME: '[f]', SAVE_JOB: '[Ctrl+s]' },
};

const SETTINGS = {
    technical_accounts: [
        { user_id: 12, user_name: 'ta-bot', deleted: false },
        { user_id: 40, user_name: 'old-importer', deleted: true },
    ],
};
const USERS = [
    { id: 12, username: 'ta-bot', first_name: '', last_name: '' },
    { id: 51, username: 'ta-loader', first_name: 'Upload', last_name: 'Script' },
    { id: 52, username: 'tamara', first_name: '', last_name: '' },
];

function endpointOf(url) {
    return new URL(url, 'http://localhost').pathname.replace('/api/team-analytics/', '');
}

// --- mounting --------------------------------------------------------------------------------------------------

// The page for one state: `overview` is what the service answers, `refusal` an answer to every request instead.
function openPage({
    search = '', overview = OVERVIEW, status = { refresh: refresh(), history: HISTORY_DONE }, refusal = null,
    organization = ORGANIZATION, settings = () => ({ body: SETTINGS }), users = () => ({ body: { users: USERS } }),
    auth,
} = {}) {
    const history = createMemoryHistory({ initialEntries: [`/team-analytics${search}`] });
    const figuresService = suppliedService((url) => {
        if (refusal) return refusal;
        const endpoint = endpointOf(url);
        if (endpoint === 'settings/users') return users(url);
        if (endpoint === 'list') return listAnswer(url, overview);
        if (endpoint === 'trends') return trendsAnswer(url);
        if (endpoint === 'details') return { body: DETAILS };
        if (endpoint === 'status') return { body: status };
        return { body: overview };
    });
    const saved = suppliedSettings(settings);
    const store = {
        organizations: { current: organization ? { slug: organization } : null },
        shortcuts: KEYMAP,
        ...(auth ? { auth } : {}),
    };
    const Page = loadPage('team-analytics-page.tsx', {
        'react-redux': { useSelector: (select) => select(store) },
        'react-router': { useHistory: () => history },
        './service': { ...loadPage('service.ts'), requestService: figuresService.request, requestSettings: saved.request },
        './project-names': { lookupProjectNames: async () => ({ 1: PROJECT_NAMES[0] }) },
    }).default;
    return { Page, history };
}

// mounts the page, lets `act` (if any) work on it, and checks everything shown in the document
async function check(state, options = {}, work = async () => {}) {
    const { Page } = openPage(options);
    const view = await mount(React.createElement(Page));
    try {
        await view.settle();
        await work(view);
        return assertRussian(document.body, state);
    } finally {
        await view.unmount();
        // a modal and a dropdown render outside the page's container
        document.body.querySelectorAll('.ant-modal-root, .ant-select-dropdown').forEach((element) => element.remove());
    }
}

async function click(element) {
    assert.ok(element, 'the control is on the page');
    await act(async () => { element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); });
}

async function type(input, value) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
}

async function wait(ms) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
}

// --- the overview ----------------------------------------------------------------------------------------------

test('the overview with every card filled shows no English', async () => {
    const shown = await check('the overview', { status: { refresh: refresh({ stale: true, now: '2026-11-13T16:10:00+00:00' }), history: HISTORY_DONE } });
    // the states this test means to cover are on the page
    for (const name of ['alice', 'Street scenes', ORGANIZATION, HOTKEY_NAMES[0]]) {
        assert.ok(shown.text.includes(name), `the fixture shows ${name}`);
    }
});

test('the overview with every card filled in organization scope and instance scope', async () => {
    await check('the overview, instance scope', { organization: null });
});

test('the overview with every shape kind and a period of a month shows no English', async () => {
    await check('the overview, all shapes', { search: '?period=month&shapes=all' });
});

test('the overview with a project and an annotator chosen shows no English', async () => {
    await check('the overview, filtered', { search: '?project=1&annotator=11' });
});

test('the overview before the first refresh shows no English', async () => {
    await check('the overview, not refreshed', { status: { refresh: refresh({ last_success_at: null, stale: true }), history: HISTORY_DONE } });
});

test('the overview while the figures load shows no English', async () => {
    const View = loadPage('team-analytics-view.tsx').default;
    const container = document.createElement('div');
    document.body.append(container);
    const view = await mount(React.createElement(View, {
        organization: ORGANIZATION, state: { kind: 'loading' }, address: { period: 'week', month: null },
        onAddressChange() {}, onOpenSettings() {},
    }));
    try {
        assertRussian(document.body, 'loading');
    } finally {
        await view.unmount();
        container.remove();
    }
});

// --- the full views --------------------------------------------------------------------------------------------

const FULL_VIEWS = [
    ['time', 'working time'],
    ['operations', 'operations'],
    ['methods', 'creation methods'],
    ['split', 'working time split'],
    ['annotators', 'working time by annotator'],
    ['projects', 'working time by project'],
    ['hotkeys', 'hotkeys'],
    ['trend-working_time', 'a trend: working time'],
    ['trend-boxes', 'a trend: boxes'],
    ['trend-average', 'a trend: average time'],
    ['trend-hotkey_share', 'a trend: hotkey share'],
];

for (const [view, name] of FULL_VIEWS) {
    test(`the full view of ${name} shows no English`, async () => {
        await check(`full view ${view}`, { search: `?view=${view}` }, async (mounted) => {
            assert.ok(mounted.container.querySelector('.cvat-team-analytics-full-view') ||
                mounted.container.querySelector('.cvat-team-analytics-full'), `${view} is open`);
        });
    });
}

for (const view of ['operations', 'methods', 'split']) {
    test(`the full view of ${view} by project shows no English`, async () => {
        await check(`full view ${view} by project`, { search: `?view=${view}&rows=projects` });
    });
}

// --- the settings ----------------------------------------------------------------------------------------------

const modal = () => document.body.querySelector('.cvat-team-analytics-settings-modal');

async function openSettings(view) {
    await click(view.container.querySelector('.cvat-team-analytics-settings-button'));
    await view.settle();
    assert.ok(modal(), 'the settings modal is open');
}

test('the settings modal with the list loaded shows no English', async () => {
    const shown = await check('settings, list loaded', {}, openSettings);
    assert.ok(shown.text.includes('ta-bot'), 'the list is shown');
});

test('the settings modal with the user search open shows no English', async () => {
    await check('settings, search results', {}, async (view) => {
        await openSettings(view);
        const picker = modal().querySelector('.cvat-team-analytics-settings-picker');
        await act(async () => {
            picker.querySelector('.ant-select-selector').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
        });
        await type(picker.querySelector('input'), 'ta');
        await wait(500);
        await view.settle();
    });
});

test('the settings modal with a search without results and with a failed search shows no English', async () => {
    let answer = () => ({ body: { users: [] } });
    const search = async (view, value) => {
        const picker = modal().querySelector('.cvat-team-analytics-settings-picker');
        await act(async () => {
            picker.querySelector('.ant-select-selector').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
        });
        await type(picker.querySelector('input'), value);
        await wait(500);
        await view.settle();
    };
    await check('settings, no users found', { users: () => answer() }, async (view) => {
        await openSettings(view);
        await search(view, 'nobody');
    });
    answer = () => ({ status: 503, body: { error: 'unavailable' } });
    await check('settings, search failed', { users: () => answer() }, async (view) => {
        await openSettings(view);
        await search(view, 'ta');
    });
});

test('the settings modal with an empty list shows no English', async () => {
    await check('settings, empty list', { settings: () => ({ body: { technical_accounts: [] } }) }, openSettings);
});

test('the settings modal while the list loads shows no English', async () => {
    await check('settings, loading', { settings: () => new Promise(() => {}) }, openSettings);
});

test('the settings modal after a failed load shows no English', async () => {
    await check('settings, load failed', {
        settings: () => ({ status: 503, body: { error: 'unavailable' } }),
    }, async (view) => {
        await openSettings(view);
        assert.ok(modal().querySelector('.cvat-team-analytics-settings-load-failed'), 'the failure is shown');
    });
});

test('the settings modal after a failed save shows no English but the server\'s own reason', async () => {
    const shown = await check('settings, save failed', {
        settings: (sent) => (sent.method === 'PUT' ?
            { status: 400, body: null, message: SERVER_REASON } : { body: SETTINGS }),
    }, async (view) => {
        await openSettings(view);
        await click(document.body.querySelector('.cvat-team-analytics-settings-save'));
        await view.settle();
        assert.ok(document.body.querySelector('.cvat-team-analytics-settings-error'), 'the failure is shown');
    });
    assert.ok(shown.text.includes(SERVER_REASON), 'the server\'s reason is shown as it is');
});

test('the settings modal after a failed save without a reason, and after no answer, shows no English', async () => {
    for (const failure of [{ status: 500, body: null }, new Error('Network Error')]) {
        // eslint-disable-next-line no-await-in-loop
        await check('settings, save failed without a reason', {
            settings: (sent) => (sent.method === 'PUT' ? failure : { body: SETTINGS }),
        }, async (view) => {
            await openSettings(view);
            await click(document.body.querySelector('.cvat-team-analytics-settings-save'));
            await view.settle();
            assert.ok(document.body.querySelector('.cvat-team-analytics-settings-error'), 'the failure is shown');
        });
    }
});

// --- refusals and errors ---------------------------------------------------------------------------------------

test('no access shows no English', async () => {
    const shown = await check('no access', { refusal: { status: 403, body: { error: 'forbidden' } } });
    assert.ok(shown.text.includes('Назад к задачам'));
});

test('no access of an account that is not an administrator shows no English', async () => {
    await check('no access, not an administrator', { auth: { user: { username: 'worker', groups: ['worker'] } } });
});

test('a page that is switched off or an unknown organization shows no English', async () => {
    await check('not found', { refusal: { status: 404, body: null } });
});

test('signed out shows no English', async () => {
    const shown = await check('signed out', { refusal: { status: 401, body: { error: 'not_authenticated' } } });
    assert.ok(shown.text.includes('Сеанс завершён'));
});

test('the error panel shows no English', async () => {
    await check('error panel', { refusal: { status: 503, body: { error: 'cvat_unavailable' } } }, async (view) => {
        assert.ok(view.container.querySelector('.cvat-team-analytics-error'), 'the error panel is shown');
    });
});

test('the error panel after a request that outlived the retries shows no English', async () => {
    await check('error panel, 429', { refusal: { status: 429, body: null } });
});

test('a trends request that fails while the figures stay shows no English', async () => {
    const history = createMemoryHistory({ initialEntries: ['/team-analytics'] });
    const { request } = suppliedService((url) => {
        const endpoint = endpointOf(url);
        if (endpoint === 'trends') return { status: 503, body: { error: 'cvat_unavailable' } };
        if (endpoint === 'status') return { body: { refresh: refresh(), history: HISTORY_DONE } };
        if (endpoint === 'details') return { body: DETAILS };
        return { body: OVERVIEW };
    });
    const Failing = loadPage('team-analytics-page.tsx', {
        'react-redux': { useSelector: (select) => select({ organizations: { current: { slug: ORGANIZATION } }, shortcuts: KEYMAP }) },
        'react-router': { useHistory: () => history },
        './service': { ...loadPage('service.ts'), requestService: request },
        './project-names': { lookupProjectNames: async () => ({ 1: PROJECT_NAMES[0] }) },
    }).default;
    const view = await mount(React.createElement(Failing));
    try {
        await view.settle();
        assertRussian(document.body, 'trends failed');
    } finally {
        await view.unmount();
    }
});

// --- periods and history ---------------------------------------------------------------------------------------

const CUTOVER = '2026-11-02T10:00:00+00:00';

function withOperations(overrides) {
    return { ...OVERVIEW, operations: { ...OPERATIONS, ...overrides } };
}

test('a legacy period shows no English', async () => {
    const legacyRows = OPERATIONS.rows.map((row) => (row.operation === 'class_change' ?
        { ...row, objects: 0, timed_objects: 0, time_ms: 0, average_ms: null, share: 0 } : row));
    await check('legacy period', {
        overview: {
            ...withOperations({ legacy: true, shapes: 'all', cutover: null, rows: legacyRows }),
            by_annotator: { ...OVERVIEW.by_annotator, legacy: true },
            by_project: { ...OVERVIEW.by_project, legacy: true },
        },
    });
});

test('a legacy period in a full view shows no English', async () => {
    await check('legacy period, full view', {
        search: '?view=operations',
        overview: withOperations({ legacy: true, shapes: 'all', cutover: null }),
    });
});

test('a partly legacy period shows no English', async () => {
    await check('partly legacy period', {
        search: '?period=month&month=2026-11',
        overview: withOperations({ partly_legacy: true, cutover: CUTOVER }),
    });
});

test('history still being processed, with the trends pending, shows no English', async () => {
    const shown = await check('history being processed', { status: { refresh: refresh(), history: HISTORY_RUNNING } });
    assert.match(shown.text, /6%/);
});

test('a period that is not processed yet shows no English', async () => {
    await check('not processed', {
        status: { refresh: refresh(), history: HISTORY_RUNNING },
        overview: {
            period: PERIOD,
            filters: { project: null, annotator: { user_id: 11, user_name: 'alice' } },
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
                legacy: false, partly_legacy: true, cutover: CUTOVER, shapes: 'bounding_boxes',
                working_time_ms: null, active_time_ms: null, rows: null,
            },
        },
    });
});

test('an empty period shows no English', async () => {
    const noFigures = { objects: 0, timed_objects: 0, time_ms: 0, average_ms: null, share: null };
    const empty = {
        period: PERIOD,
        by_annotator: { rows: [], rest: { count: 0, working_time_ms: 0 } },
        by_project: { rows: [], rest: { count: 0, working_time_ms: 0 } },
        headline: { annotators: 0, projects: 0 },
        filters: { project: null, annotator: null },
        sessions: {
            sessions: 0, average_ms: 0, total_ms: 0, by_annotator: [],
        },
        time_series: {
            unit: 'day', buckets: OVERVIEW.time_series.buckets.map((bucket) => ({ ...bucket, working_time_ms: 0 })),
        },
        operations: {
            ...OPERATIONS,
            working_time_ms: 0,
            active_time_ms: 0,
            rows: OPERATIONS.rows.map((row) => ({ ...row, ...noFigures, operation: row.operation })),
        },
        creation_methods: {
            ...OVERVIEW.creation_methods,
            rows: OVERVIEW.creation_methods.rows.map((row) => ({ ...row, ...noFigures })),
            total: {
                objects: 0, timed_objects: 0, time_ms: 0, average_ms: null,
            },
            model: { objects: 0, share: 0 },
            technical_accounts: 0,
        },
        input: {
            hotkey_actions: 0, mouse_actions: 0, canvas_clicks: 0, hotkey_share: null, top_hotkeys: [],
            rest: { count: 0, actions: 0 },
        },
        processed: true,
    };
    await check('empty period', { overview: empty });
    await check('empty period, a full view', { overview: empty, search: '?view=split' });
});
