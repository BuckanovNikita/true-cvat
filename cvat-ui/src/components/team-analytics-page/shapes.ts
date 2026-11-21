// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// The Боксы / Все фигуры switch (Bounding boxes / All shapes): kept in the page address (`shapes=all`;
// bounding boxes, the default, is not written), sent to the service as `shapes`, and named in every
// operation card after the shapes the service says the figures cover (a legacy period always covers all
// shapes).

import { OperationsFigures } from './service';

export type Shapes = 'bounding_boxes' | 'all';

export const DEFAULT_SHAPES: Shapes = 'bounding_boxes';

export const SHAPE_OPTIONS: { key: Shapes; label: string }[] = [
    { key: 'bounding_boxes', label: 'Боксы' },
    { key: 'all', label: 'Все фигуры' },
];

export function readShapes(search: string): Shapes {
    return new URLSearchParams(search).get('shapes') === 'all' ? 'all' : DEFAULT_SHAPES;
}

// The query string for `shapes`, keeping every other key of `search`.
export function shapesSearch(shapes: Shapes | undefined, search: string): string {
    const query = new URLSearchParams(search);
    if (shapes === 'all') query.set('shapes', 'all');
    else query.delete('shapes');
    const text = query.toString();
    return text ? `?${text}` : '';
}

// How the cards word what the figures count. Russian words change with their place in a sentence, so
// each place has its whole phrase here and nothing is glued from a noun.
export interface ShapeWording {
    // the switch's option, and the shapes named on their own: 'Боксы' / 'Все фигуры'
    label: string;
    // a column of counts: 'Боксы' / 'Объекты'
    column: string;
    // the things counted, inside a sentence: 'боксы' / 'объекты'
    things: string;
    // the headline count and its trend: 'Создано боксов' / 'Создано объектов'
    created: string;
    // the headline average: 'Ср. время на бокс' / 'Ср. время на объект'
    averageShort: string;
    // the trend of the average: 'Среднее время на бокс' / 'Среднее время на объект'
    average: string;
    // what a table of operations holds, inside a line: 'количество и среднее время на бокс'
    countsAndAverage: string;
    // the operations table title: 'Операции с боксами' / 'Операции с объектами'
    operations: string;
    // the creation methods title: 'Как создаются боксы' / 'Как создаются объекты'
    howCreated: string;
}

// How the cards name the shapes the figures cover (all shapes when the response does not say).
export function shapeWording(figures: Pick<OperationsFigures, 'shapes'>): ShapeWording {
    if (figures.shapes === 'bounding_boxes') {
        return {
            label: 'Боксы',
            column: 'Боксы',
            things: 'боксы',
            created: 'Создано боксов',
            averageShort: 'Ср. время на бокс',
            average: 'Среднее время на бокс',
            countsAndAverage: 'количество и среднее время на бокс',
            operations: 'Операции с боксами',
            howCreated: 'Как создаются боксы',
        };
    }
    return {
        label: 'Все фигуры',
        column: 'Объекты',
        things: 'объекты',
        created: 'Создано объектов',
        averageShort: 'Ср. время на объект',
        average: 'Среднее время на объект',
        countsAndAverage: 'количество и среднее время на объект',
        operations: 'Операции с объектами',
        howCreated: 'Как создаются объекты',
    };
}
