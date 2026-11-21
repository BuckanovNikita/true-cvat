// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import { CreationMethodName } from './service';

// Each creation method has one name everywhere on the page (DOCS.md, "Domain terms").
export const METHOD_NAMES: Record<CreationMethodName, string> = {
    drawn: 'Нарисовано',
    pasted: 'Вставлено',
    propagated: 'Распространено',
};

// Model is the fourth method: counts only, in the colour of work no person did.
export const MODEL_NAME = 'Модель';
export const MODEL_COLOR = '#c9c8c2';
