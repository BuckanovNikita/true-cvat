// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// The controls of the 2D annotation view that a shortcut can stand in for, found by the class names CVAT's own
// components give them (no component is edited for this). A CVAT release that renames a class or a shortcut
// action silently loses that hint: verify/shortcut-hints/controls.test.cjs compares this table with the sources.
//
// Left out on purpose:
// - "Remove" and "Run annotation action" of the object menu: CVAT gives both the class
//   cvat-object-item-menu-remove-object, so a click on one cannot be told from a click on the other;
// - changing the label of an object: its shortcut depends on the label (SWITCH_LABEL_n).

export interface Control {
    // a click on an element matching this selector, or on anything inside it, used the control
    selector: string;
    // the shortcut actions that do the same, in the order they are pressed; the first one names the hint
    actions: string[];
    // the Russian name of what the control does; without one the hint shows the name CVAT's keymap gives the action
    name?: string;
}

const HEADER = '.cvat-objects-sidebar-states-header';

export const CONTROLS: readonly Control[] = [
    // the top bar
    { selector: '.cvat-annotation-header-save-button', actions: ['SAVE_JOB'], name: 'Сохранить задание' },
    { selector: '.cvat-annotation-header-undo-button', actions: ['UNDO'], name: 'Отменить действие' },
    { selector: '.cvat-annotation-header-redo-button', actions: ['REDO'], name: 'Повторить действие' },
    { selector: '.cvat-player-backward-button', actions: ['BACKWARD_FRAME'], name: 'Назад на шаг' },
    { selector: '.cvat-player-forward-button', actions: ['FORWARD_FRAME'], name: 'Вперёд на шаг' },
    {
        selector: '.cvat-player-previous-button, .cvat-player-previous-button-filtered, ' +
            '.cvat-player-previous-button-empty, .cvat-player-previous-button-chapter',
        actions: ['PREV_FRAME'],
        name: 'Предыдущий кадр',
    },
    {
        selector: '.cvat-player-next-button, .cvat-player-next-button-filtered, ' +
            '.cvat-player-next-button-empty, .cvat-player-next-button-chapter',
        actions: ['NEXT_FRAME'],
        name: 'Следующий кадр',
    },
    {
        selector: '.cvat-player-play-button, .cvat-player-pause-button',
        actions: ['PLAY_PAUSE'],
        name: 'Воспроизведение и пауза',
    },
    { selector: '.cvat-player-delete-frame', actions: ['DELETE_FRAME'], name: 'Удалить кадр' },

    // the controls sidebar
    { selector: '.cvat-cursor-control', actions: ['CANCEL'], name: 'Вернуться к курсору' },
    {
        selector: '.cvat-rotate-canvas-controls-right',
        actions: ['CLOCKWISE_ROTATION_STANDARD_CONTROLS'],
        name: 'Повернуть по часовой стрелке',
    },
    {
        selector: '.cvat-rotate-canvas-controls-left',
        actions: ['ANTICLOCKWISE_ROTATION_STANDARD_CONTROLS'],
        name: 'Повернуть против часовой стрелки',
    },
    {
        // CVAT builds these classes per shape: cvat-draw-${shapeType}-shape-button, cvat-draw-${shapeType}-track-button
        selector: '[class*="cvat-draw-"][class*="-shape-button"], [class*="cvat-draw-"][class*="-track-button"]',
        actions: ['SWITCH_DRAW_MODE_STANDARD_CONTROLS'],
        name: 'Повторить рисование',
    },
    { selector: '.cvat-merge-control', actions: ['SWITCH_MERGE_MODE_STANDARD_CONTROLS'], name: 'Режим объединения' },
    { selector: '.cvat-group-control', actions: ['SWITCH_GROUP_MODE_STANDARD_CONTROLS'], name: 'Режим группировки' },
    {
        selector: '.cvat-split-track-control',
        actions: ['SWITCH_SPLIT_MODE_STANDARD_CONTROLS'],
        name: 'Режим разделения трека',
    },
    { selector: '.cvat-join-control', actions: ['SWITCH_JOIN_MODE_STANDARD_CONTROLS'], name: 'Режим соединения' },
    {
        selector: '.cvat-slice-control, .cvat-object-item-menu-slice-object',
        actions: ['SWITCH_SLICE_MODE_STANDARD_CONTROLS'],
        name: 'Режим разрезания',
    },
    { selector: '.cvat-issue-control', actions: ['OPEN_REVIEW_ISSUE'], name: 'Открыть замечание' },
    { selector: '.cvat-add-tag-button', actions: ['SWITCH_DRAW_MODE_TAG_ANNOTATION'], name: 'Добавить тег' },

    // the buttons of an object in the objects sidebar; the quick actions of a selection carry the same classes
    {
        selector: '.cvat-object-item-button-lock, .cvat-object-item-button-lock-enabled',
        actions: ['SWITCH_LOCK'],
        name: 'Заблокировать или разблокировать объект',
    },
    {
        selector: '.cvat-object-item-button-occluded, .cvat-object-item-button-occluded-enabled',
        actions: ['SWITCH_OCCLUDED'],
        name: 'Переключить перекрытие',
    },
    {
        selector: '.cvat-object-item-button-pinned, .cvat-object-item-button-pinned-enabled',
        actions: ['SWITCH_PINNED'],
        name: 'Закрепить или открепить объект',
    },
    {
        selector: '.cvat-object-item-button-hidden, .cvat-object-item-button-hidden-enabled',
        actions: ['SWITCH_HIDDEN'],
        name: 'Скрыть или показать объект',
    },
    { selector: '.cvat-object-item-button-outside', actions: ['SWITCH_OUTSIDE'], name: 'Переключить «вне кадра»' },
    { selector: '.cvat-object-item-button-keyframe', actions: ['SWITCH_KEYFRAME'], name: 'Переключить ключевой кадр' },
    {
        selector: '.cvat-object-item-button-prev-keyframe',
        actions: ['PREV_KEY_FRAME'],
        name: 'Предыдущий ключевой кадр',
    },
    {
        selector: '.cvat-object-item-button-next-keyframe',
        actions: ['NEXT_KEY_FRAME'],
        name: 'Следующий ключевой кадр',
    },
    {
        selector: '.cvat-canvas-selected-objects-quick-actions [aria-label="Delete selection"]',
        actions: ['DELETE_OBJECT_STANDARD_WORKSPACE'],
        name: 'Удалить объект',
    },

    // the header of the objects list: its two switches are antd icons without a class of CVAT's own
    {
        selector: `${HEADER} .anticon-lock, ${HEADER} .anticon-unlock`,
        actions: ['SWITCH_ALL_LOCK'],
        name: 'Заблокировать или разблокировать все объекты',
    },
    {
        selector: `${HEADER} .anticon-eye, ${HEADER} .anticon-eye-invisible`,
        actions: ['SWITCH_ALL_HIDDEN'],
        name: 'Скрыть или показать все объекты',
    },

    // the menu of an object
    { selector: '.cvat-object-item-menu-make-copy', actions: ['COPY_SHAPE', 'PASTE_SHAPE'], name: 'Сделать копию' },
    { selector: '.cvat-object-item-menu-propagate-item', actions: ['PROPAGATE_OBJECT'], name: 'Распространить объект' },
    {
        selector: '.cvat-object-item-menu-to-layer-background',
        actions: ['TO_BACKGROUND'],
        name: 'Переместить на задний план',
    },
    {
        selector: '.cvat-object-item-menu-to-layer-foreground',
        actions: ['TO_FOREGROUND'],
        name: 'Переместить на передний план',
    },
    {
        selector: '.cvat-object-item-menu-to-one-layer-backward',
        actions: ['TO_ONE_LAYER_BACKWARD'],
        name: 'На один слой назад',
    },
    {
        selector: '.cvat-object-item-menu-to-one-layer-forward',
        actions: ['TO_ONE_LAYER_FORWARD'],
        name: 'На один слой вперёд',
    },
    { selector: '.cvat-object-item-menu-change-color', actions: ['CHANGE_OBJECT_COLOR'], name: 'Изменить цвет' },
    { selector: '.cvat-object-item-menu-simplify-object', actions: ['SIMPLIFY_POLYGON'], name: 'Упростить полигон' },

    // the attribute annotation workspace
    {
        selector: '.cvat-attribute-annotation-sidebar-object-switcher-left',
        actions: ['PREVIOUS_OBJECT'],
        name: 'Предыдущий объект',
    },
    {
        selector: '.cvat-attribute-annotation-sidebar-object-switcher-right',
        actions: ['NEXT_OBJECT'],
        name: 'Следующий объект',
    },
    {
        selector: '.cvat-attribute-annotation-sidebar-attribute-switcher-left',
        actions: ['PREVIOUS_ATTRIBUTE'],
        name: 'Предыдущий атрибут',
    },
    {
        selector: '.cvat-attribute-annotation-sidebar-attribute-switcher-right',
        actions: ['NEXT_ATTRIBUTE'],
        name: 'Следующий атрибут',
    },
];
