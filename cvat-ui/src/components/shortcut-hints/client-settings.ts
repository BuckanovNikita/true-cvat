// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// What an administrator set for the shortcut hints in the Team Analytics settings. It is read from the one
// Team Analytics address open to every signed-in user (GET client-settings), since the hints are for
// annotators and everything else of Team Analytics is for administrators.

import { getCore } from 'cvat-core-wrapper';

const PATH = 'team-analytics/client-settings';

/**
 * Whether the shortcut hints are shown. Without a readable answer they are not: the server failed, the
 * request did not leave, or the installation runs without Team Analytics (analytics disabled), where nobody
 * could switch them off. Never rejects.
 */
export async function shortcutHintsShown(): Promise<boolean> {
    try {
        const core = getCore();
        const response = await core.server.request(`${core.config.backendAPI}/${PATH}`, { method: 'GET' });
        return (response as { data?: { shortcut_hints?: unknown } } | undefined)?.data?.shortcut_hints === true;
    } catch {
        // a hint is never worth an error message: without the setting there are no hints
        return false;
    }
}
