// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import Text from 'antd/lib/typography/Text';

import { SessionFigures } from '../service';
import { Term } from '../definitions';
import { exactHours, formatCount, formatDuration } from '../format';

interface Props {
    figures: SessionFigures;
}

// Headline figure for the scope: the number of sessions and their average length.
function SessionsCard({ figures }: Props): JSX.Element {
    return (
        <section className='cvat-team-analytics-card cvat-team-analytics-sessions'>
            <Text type='secondary'><Term name='session'>Сессии</Term></Text>
            {/* the hover text sits on the value, not the card, so that it never covers the Session definition */}
            <div
                className='cvat-team-analytics-headline-value'
                title={`Непрерывные интервалы работы · ${exactHours(figures.total_ms)} всего`}
            >
                {formatCount(figures.sessions)}
            </div>
            <Text type='secondary'>
                {figures.sessions > 0 ? `в среднем ${formatDuration(figures.average_ms)}` : 'в этом периоде сессий нет'}
            </Text>
        </section>
    );
}

export default React.memo(SessionsCard);
