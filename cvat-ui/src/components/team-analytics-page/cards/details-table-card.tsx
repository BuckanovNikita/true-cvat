// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';

import {
    Details, DetailsKind, DetailsRow, ProjectNames,
} from '../service';
import {
    MISSING, NBSP, exactHours, formatCount, formatHours, formatNumber, formatSeconds, formatShare, projectName,
} from '../format';
import { plural } from '../plural';
import { Term, TERM_LABELS } from '../definitions';

interface Props {
    // null until the first answer
    details: Details | null;
    by: DetailsKind;
    onBy?: (by: DetailsKind) => void;
    search: string;
    onSearch?: (search: string) => void;
    onPage?: (page: number) => void;
    // the page's filter on the table's own dimension (marked), or null
    selected: number | null;
    onPick?: (id: number) => void;
    projectNames?: ProjectNames;
    failed?: boolean;
    pending?: boolean;
}

const KINDS: { key: DetailsKind; label: string }[] = [
    { key: 'annotators', label: 'Аннотаторы' },
    { key: 'projects', label: 'Проекты' },
];

const NOT_RECORDED = 'Не записано';

function rowName(row: DetailsRow, by: DetailsKind, names: ProjectNames): string {
    if (by === 'projects') return projectName(row.id, names);
    return row.user_name || `Аннотатор #${row.id}`;
}

function pagerLabel(details: Details): string {
    const first = (details.page - 1) * details.page_size + 1;
    return `${first}–${first + details.rows.length - 1} из ${formatCount(details.total)}`;
}

// The details table: every figure for every annotator or every project, ten rows a page, searchable by
// name, sorted by working time. Clicking a row sets it as the page's filter.
function DetailsTableCard({
    details, by, onBy, search, onSearch, onPage, selected, onPick, projectNames = {}, failed = false,
    pending = false,
}: Props): JSX.Element {
    const finding = by === 'projects';
    // the rows are of the kind the answer is for (the previous kind while a switch loads)
    const projects = (details?.by ?? by) === 'projects';
    const legacy = !!details?.legacy;
    const pages = details ? Math.max(1, Math.ceil(details.total / details.page_size)) : 1;
    const shown = details && details.processed !== false ? details : null;
    const technical = formatNumber(shown?.technical_accounts ?? 0);

    let body: JSX.Element | null = null;
    if (!details) {
        body = failed ? <p className='cvat-team-analytics-details-note'>Не удалось загрузить подробности.</p> : null;
    } else if (details.processed === false) {
        body = <p className='cvat-team-analytics-details-note'>Этот период ещё не обработан.</p>;
    } else if (details.total === 0) {
        body = (
            <p className='cvat-team-analytics-details-note'>
                {search.trim() ? 'По этому запросу ничего не найдено.' : 'В этом периоде нет работы в заданиях'}
            </p>
        );
    }

    return (
        <section
            className={`cvat-team-analytics-card cvat-team-analytics-details${pending ? ' cvat-team-analytics-pending' : ''}`}
            aria-busy={pending}
        >
            <div className='cvat-team-analytics-details-header'>
                <h2 className='cvat-team-analytics-details-title'>Подробности</h2>
                <div role='group' aria-label='Строки таблицы' className='cvat-team-analytics-trends-segments'>
                    {KINDS.map((option) => (
                        <button
                            key={option.key}
                            type='button'
                            aria-pressed={option.key === by}
                            onClick={() => onBy?.(option.key)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <input
                    type='search'
                    className='cvat-team-analytics-details-search'
                    aria-label={finding ? 'Найти проект' : 'Найти аннотатора'}
                    placeholder={finding ? 'Найти проект' : 'Найти аннотатора'}
                    value={search}
                    onChange={(event) => onSearch?.(event.target.value)}
                />
                <span className='cvat-team-analytics-details-hint'>Отсортировано по рабочему времени</span>
            </div>
            {failed && details ? (
                <p className='cvat-team-analytics-details-note'>
                    Не удалось обновить подробности; в таблице данные для прежнего выбора.
                </p>
            ) : null}
            {shown && shown.total > 0 ? (
                <div className='cvat-team-analytics-table-scroll'>
                    <table className='cvat-team-analytics-table cvat-team-analytics-details-table'>
                        <thead>
                            <tr>
                                <th className='cvat-team-analytics-details-name'>
                                    {projects ? 'Проект' : 'Аннотатор'}
                                </th>
                                <th>{projects ? 'Аннотаторы' : 'Проекты'}</th>
                                <th><Term name='session'>Сессии</Term></th>
                                <th><Term name='working_time'>Рабочее время</Term></th>
                                <th>Нарисовано</th>
                                <th>Вставлено</th>
                                <th>Распространено</th>
                                <th>{legacy ? 'Сохранённые боксы' : <Term name='model'>{TERM_LABELS.model}</Term>}</th>
                                <th>Подгонки</th>
                                <th>Смены класса</th>
                                <th>Удаления</th>
                                <th><Term name='time_per_operation'>Ср. время создания</Term></th>
                                <th>Доля горячих клавиш</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.rows.map((row) => {
                                const name = rowName(row, projects ? 'projects' : 'annotators', projectNames);
                                const on = row.id === selected;
                                return (
                                    <tr
                                        key={row.id}
                                        className={`cvat-team-analytics-details-row${on ? ' cvat-team-analytics-details-selected' : ''}`}
                                        onClick={() => onPick?.(row.id)}
                                    >
                                        <th scope='row' className='cvat-team-analytics-details-name'>
                                            <button type='button' aria-pressed={on} title={name}>{name}</button>
                                        </th>
                                        <td>{formatCount((projects ? row.annotators : row.projects) ?? 0)}</td>
                                        <td>{formatCount(row.sessions)}</td>
                                        <td title={exactHours(row.working_time_ms)}>
                                            {formatHours(row.working_time_ms)}
                                        </td>
                                        <td>{formatCount(row.drawn)}</td>
                                        <td>{formatCount(row.pasted)}</td>
                                        <td>{formatCount(row.propagated)}</td>
                                        <td>{formatCount(legacy ? row.saved_boxes : row.model)}</td>
                                        <td>{formatCount(row.alignments)}</td>
                                        {legacy ? (
                                            <td className='cvat-team-analytics-not-recorded'>{NOT_RECORDED}</td>
                                        ) : (
                                            <td>{formatCount(row.class_changes)}</td>
                                        )}
                                        <td>{formatCount(row.deletions)}</td>
                                        <td>{formatSeconds(row.average_create_ms)}</td>
                                        {legacy ? (
                                            <td className='cvat-team-analytics-not-recorded'>{NOT_RECORDED}</td>
                                        ) : (
                                            <td>
                                                {row.hotkey_share === null ? MISSING : formatShare(row.hotkey_share)}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : body}
            {shown && shown.total > 0 ? (
                <div className='cvat-team-analytics-details-pager'>
                    <span>{pagerLabel(shown)}</span>
                    {pages > 1 ? (
                        <>
                            <button
                                type='button'
                                disabled={shown.page <= 1}
                                onClick={() => onPage?.(shown.page - 1)}
                            >
                                Назад
                            </button>
                            <button
                                type='button'
                                disabled={shown.page >= pages}
                                onClick={() => onPage?.(shown.page + 1)}
                            >
                                Вперёд
                            </button>
                        </>
                    ) : null}
                    {shown.technical_accounts ? (
                        <span className='cvat-team-analytics-details-hint'>
                            {plural(shown.technical_accounts, [
                                `${technical}${NBSP}техническая учётная запись не входит в списки аннотаторов`,
                                `${technical}${NBSP}технические учётные записи не входят в списки аннотаторов`,
                                `${technical}${NBSP}технических учётных записей не входят в списки аннотаторов`,
                            ])}
                        </span>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}

export default React.memo(DetailsTableCard);
