// What an administrator set for the hints (components/shortcut-hints/client-settings.ts): asked from the one
// Team Analytics address every signed-in user may read, through cvat-core's own request.
const test = require('node:test');
const assert = require('node:assert/strict');

const { loadSource } = require('./helper.cjs');

const SOURCE = 'cvat-ui/src/components/shortcut-hints/client-settings.ts';

/** The module over a CVAT client whose request answers with `respond(url, options)`. */
function clientSettings(respond) {
    const requests = [];
    const core = {
        config: { backendAPI: '/api' },
        server: {
            async request(url, options) {
                requests.push({ url, options });
                return respond(url, options);
            },
        },
    };
    const { shortcutHintsShown } = loadSource(SOURCE, { 'cvat-core-wrapper': { getCore: () => core } });
    return { shortcutHintsShown, requests };
}

test('the setting is read with one GET of the client settings', async () => {
    const { shortcutHintsShown, requests } = clientSettings(() => ({ status: 200, data: { shortcut_hints: true } }));
    assert.equal(await shortcutHintsShown(), true);
    assert.deepEqual(requests, [{ url: '/api/team-analytics/client-settings', options: { method: 'GET' } }]);
});

test('hints switched off by an administrator are off', async () => {
    const { shortcutHintsShown } = clientSettings(() => ({ status: 200, data: { shortcut_hints: false } }));
    assert.equal(await shortcutHintsShown(), false);
});

for (const [what, respond] of [
    ['an answer without the switch', () => ({ status: 200, data: {} })],
    ['a switch that is not true or false', () => ({ status: 200, data: { shortcut_hints: 'true' } })],
    ['an answer without a body', () => ({ status: 204, data: null })],
    ['no answer', () => undefined],
    ['an installation without Team Analytics (404)', () => { throw Object.assign(new Error('Not found'), { code: 404 }); }],
    ['a server failure', () => { throw Object.assign(new Error('Internal error'), { code: 500 }); }],
    ['a request that never left', () => { throw new Error('Network Error'); }],
]) {
    test(`${what} leaves the hints off, without a failure`, async () => {
        const { shortcutHintsShown } = clientSettings(respond);
        assert.equal(await shortcutHintsShown(), false);
    });
}

test('a CVAT client that cannot be reached leaves the hints off, without a failure', async () => {
    const { shortcutHintsShown } = loadSource(SOURCE, {
        'cvat-core-wrapper': { getCore() { throw new Error('cvat-core is not ready'); } },
    });
    assert.equal(await shortcutHintsShown(), false);
});
