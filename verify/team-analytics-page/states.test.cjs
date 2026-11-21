// The page's states, rendered from supplied service responses.
const assert = require('node:assert/strict');
const test = require('node:test');
const { loadPage, render, text } = require('./helper.cjs');

const View = loadPage('team-analytics-view.tsx').default;

test('a refused caller sees that the page is not available, not an error', () => {
    const html = render(View, { organization: 'team-org', state: { kind: 'denied' } });
    assert.match(text(html), /Страница Team Analytics недоступна/);
    assert.match(text(html), /Эта страница только для администраторов этого экземпляра CVAT\./);
    assert.doesNotMatch(text(html), /owner|maintainer|владел|мейнтейнер/);
    assert.match(text(html), /Назад к задачам/);
    assert.doesNotMatch(html, /cvat-team-analytics-error/);
});

test('an unreachable service shows an error panel on the page', () => {
    const html = render(View, { organization: 'team-org', state: { kind: 'error' } });
    assert.match(html, /cvat-team-analytics-error/);
    assert.match(text(html), /Не удалось загрузить Team Analytics/);
});

test('while loading the page shows a spinner and no figures', () => {
    const html = render(View, { organization: 'team-org', state: { kind: 'loading' } });
    assert.match(html, /ant-spin/);
    assert.doesNotMatch(html, /cvat-team-analytics-annotator-row/);
});

test('the title names the organization, or instance scope when there is none', () => {
    const ready = { kind: 'ready', overview: { by_annotator: { rows: [] } } };
    assert.match(text(render(View, { organization: 'team-org', state: ready })),
        /Team Analytics Организация team-org · работа в заданиях/);
    assert.match(text(render(View, { organization: null, state: ready })),
        /Team Analytics Все организации и личные пространства · работа в заданиях/);
});
