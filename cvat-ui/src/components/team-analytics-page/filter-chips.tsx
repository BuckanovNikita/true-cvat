// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';

import { Filters } from './filters';
import { FilterKind, FilterOption, FilterOptions } from './service';
import FilterSelect from './filter-select';

interface Props {
    filters: Filters;
    // the names to show for the selected project and annotator
    projectLabel: string;
    annotatorLabel: string;
    onChange: (change: Partial<Filters>) => void;
    // the options of each selector for the period shown; without it a selector offers only All and its value
    loadOptions?: (kind: FilterKind) => Promise<FilterOptions>;
    // what the options belong to (organization, period, month, data reload): an open dropdown closes when it changes
    optionsKey?: string;
    // the name of a project option (Без проекта, CVAT's name or its identifier)
    projectNameOf?: (id: number) => string;
}

// The project and annotator filters of the filter row: each a searchable dropdown of the projects or annotators
// with job work in the period, which shows what is selected and clears it.
export default function FilterChips({
    filters, projectLabel, annotatorLabel, onChange, loadOptions, optionsKey, projectNameOf,
}: Props): JSX.Element {
    const annotatorName = (option: FilterOption): string => option.user_name ?? `Аннотатор #${option.id}`;
    const projectName = (option: FilterOption): string => (
        projectNameOf ? projectNameOf(option.id) : `Проект #${option.id}`
    );
    return (
        <div className='cvat-team-analytics-filter-chips'>
            <FilterSelect
                kind='project'
                label='Проект'
                allLabel='Все проекты'
                value={filters.project === null ? 'Все проекты' : projectLabel}
                selected={filters.project}
                load={loadOptions ? () => loadOptions('projects') : undefined}
                optionsKey={optionsKey}
                nameOf={projectName}
                onPick={(project) => onChange({ project })}
            />
            <FilterSelect
                kind='annotator'
                label='Аннотатор'
                allLabel='Все аннотаторы'
                value={filters.annotator === null ? 'Все аннотаторы' : annotatorLabel}
                selected={filters.annotator}
                load={loadOptions ? () => loadOptions('annotators') : undefined}
                optionsKey={optionsKey}
                nameOf={annotatorName}
                onPick={(annotator) => onChange({ annotator })}
            />
        </div>
    );
}
