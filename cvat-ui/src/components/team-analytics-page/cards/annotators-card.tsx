// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Text from 'antd/lib/typography/Text';

import { NBSP, formatCount } from '../format';
import { plural } from '../plural';

interface Props {
    // active annotators and their projects within the scope and both filters
    annotators: number;
    projects: number;
    // with an annotator selected: how many annotators the annotator chart lists in all
    of?: number | null;
    projectSelected: boolean;
}

// Headline figure: how many annotators were active in the scope and across how many projects.
function AnnotatorsCard({
    annotators, projects, of = null, projectSelected,
}: Props): JSX.Element {
    const n = formatCount(projects);
    let hint = plural(projects, [`в ${n}${NBSP}проекте`, `в ${n}${NBSP}проектах`, `в ${n}${NBSP}проектах`]);
    if (projectSelected) hint = 'работали в выбранном проекте';
    return (
        <section className='cvat-team-analytics-card cvat-team-analytics-annotators'>
            <Text type='secondary'>Активные аннотаторы</Text>
            <div className='cvat-team-analytics-headline-value'>
                {of === null ? formatCount(annotators) : `${formatCount(annotators)} из ${formatCount(of)}`}
            </div>
            <Text type='secondary'>{hint}</Text>
        </section>
    );
}

export default React.memo(AnnotatorsCard);
