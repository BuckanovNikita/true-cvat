// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

import '../keyboard-mouse.scss';
import React from 'react';
import Text from 'antd/lib/typography/Text';

import { InputFigures } from '../service';
import {
    NBSP, formatCount, formatShare, shortCount,
} from '../format';
import { plural } from '../plural';
import { HotkeyLabels, hotkeyLabel } from '../hotkeys';
import { FullViewButton, ShowAllButton } from '../full-view-button';

interface Props {
    // null: the service sent no keyboard figures
    figures: InputFigures | null;
    // a legacy period (no shape-tagged operation): hotkey use was not recorded unless input was counted
    legacy: boolean;
    labels?: HotkeyLabels;
    // opens the full view of every hotkey (offered while hotkey use is recorded)
    onFullView?: () => void;
}

const HOTKEY_COLOR = '#2a78d6';
// Worded from GLOSSARY.md (Shortcut hint, Hints shown), in Russian
const HINTS_EXPLAINED = 'Подсказка о горячей клавише появляется у аннотатора после действий мышью, ' +
    'для которых есть горячая клавиша. Подсказки не входят в действия.';

function Figure({ label, value, title }: { label: string; value: string; title?: string }): JSX.Element {
    return (
        <div className='cvat-team-analytics-keyboard-figure' title={title}>
            <Text type='secondary'>{label}</Text>
            <div className='cvat-team-analytics-keyboard-value'>{value}</div>
        </div>
    );
}

// Hotkey actions against mouse actions, the hotkey share and the most used hotkeys of the scope.
function KeyboardMouseCard({
    figures, legacy, labels, onFullView,
}: Props): JSX.Element {
    let body: JSX.Element;
    // a scope without shape-tagged operations after deployment (navigation or review only) still has
    // recorded input: only a legacy period with nothing counted says it was not recorded
    const counted = !!figures && figures.hotkey_actions + figures.mouse_actions + figures.canvas_clicks > 0;
    const recorded = !(!figures || (legacy && !counted));
    if (!figures || !recorded) {
        body = (
            <div className='cvat-team-analytics-keyboard-not-recorded'>
                <Text strong>Использование горячих клавиш в этом периоде не записывалось</Text>
                <Text type='secondary'>
                    Горячие клавиши и действия мышью записываются со дня запуска нового учёта действий.
                    Чтобы увидеть их, выберите более поздний период.
                </Text>
            </div>
        );
    } else {
        const hotkeys = formatCount(figures.hotkey_actions);
        const total = formatCount(figures.hotkey_actions + figures.mouse_actions);
        const most = Math.max(1, ...figures.top_hotkeys.map((row) => row.actions));
        body = (
            <div className='cvat-team-analytics-keyboard-body'>
                <div className='cvat-team-analytics-keyboard-totals'>
                    <div className='cvat-team-analytics-keyboard-figures'>
                        <Figure
                            label='Действия горячими клавишами'
                            value={shortCount(figures.hotkey_actions)}
                            title={`Точное значение: ${formatCount(figures.hotkey_actions)}`}
                        />
                        <Figure
                            label='Действия мышью'
                            value={shortCount(figures.mouse_actions)}
                            title={`Точное значение: ${formatCount(figures.mouse_actions)}`}
                        />
                        <Figure label='Доля горячих клавиш' value={formatShare(figures.hotkey_share)} />
                        {typeof figures.hints_shown === 'number' ? (
                            <Figure
                                label='Показано подсказок'
                                value={shortCount(figures.hints_shown)}
                                title={`Точное значение: ${formatCount(figures.hints_shown)}. ${HINTS_EXPLAINED}`}
                            />
                        ) : null}
                    </div>
                    <div
                        className='cvat-team-analytics-keyboard-share'
                        title={plural(figures.hotkey_actions, [
                            `${hotkeys}${NBSP}действие горячей клавишей из ${total}`,
                            `${hotkeys}${NBSP}действия горячими клавишами из ${total}`,
                            `${hotkeys}${NBSP}действий горячими клавишами из ${total}`,
                        ])}
                    >
                        <div style={{ width: `${Math.round((figures.hotkey_share ?? 0) * 1000) / 10}%` }} />
                    </div>
                    <Text type='secondary'>
                        Действие мышью — это щелчок по кнопке, меню или элементу боковой панели. Щелчки по
                        самому холсту — это рисование и правка, поэтому с горячими клавишами они не сравниваются.
                    </Text>
                </div>
                <div className='cvat-team-analytics-keyboard-top'>
                    <Text strong>Самые частые горячие клавиши</Text>
                    {figures.top_hotkeys.length ? (
                        <ul className='cvat-team-analytics-hotkeys'>
                            {figures.top_hotkeys.map((row) => {
                                const label = hotkeyLabel(row.action, labels);
                                return (
                                    <li
                                        key={row.action}
                                        className='cvat-team-analytics-hotkey-row'
                                        title={`${label.name} (${label.keys}): ${formatCount(row.actions)}`}
                                    >
                                        <span className='cvat-team-analytics-hotkey-name'>{label.name}</span>
                                        {' '}
                                        <kbd className='cvat-team-analytics-hotkey-keys'>{label.keys}</kbd>
                                        {' '}
                                        <span className='cvat-team-analytics-hotkey-bar'>
                                            <span
                                                style={{
                                                    width: `${Math.max(0.5, (row.actions / most) * 100)}%`,
                                                    background: HOTKEY_COLOR,
                                                }}
                                            />
                                        </span>
                                        <span className='cvat-team-analytics-hotkey-value'>{formatCount(row.actions)}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <Text type='secondary' className='cvat-team-analytics-hotkeys-none'>
                            В этом периоде нет действий горячими клавишами
                        </Text>
                    )}
                    {figures.rest.count > 0 ? (
                        <div className='cvat-team-analytics-hotkeys-rest'>
                            <span>
                                {plural(figures.rest.count, [
                                    `${formatCount(figures.rest.count)}${NBSP}другая горячая клавиша не показана`,
                                    `${formatCount(figures.rest.count)}${NBSP}другие горячие клавиши не показаны`,
                                    `${formatCount(figures.rest.count)}${NBSP}других горячих клавиш не показано`,
                                ])}
                            </span>
                            {' '}
                            <span>{formatCount(figures.rest.actions)}</span>
                        </div>
                    ) : null}
                    {figures.rest.count > 0 ? (
                        <ShowAllButton count={figures.top_hotkeys.length + figures.rest.count} onClick={onFullView} />
                    ) : null}
                </div>
            </div>
        );
    }
    return (
        <section className='cvat-team-analytics-card cvat-team-analytics-keyboard'>
            <div className='cvat-team-analytics-card-header'>
                <Text strong>Клавиатура и мышь</Text>
                {recorded ? <FullViewButton onClick={onFullView} /> : null}
            </div>
            <Text type='secondary'>
                Действия горячими клавишами в сравнении с действиями мышью по элементам управления
            </Text>
            {body}
        </section>
    );
}

export default React.memo(KeyboardMouseCard);
