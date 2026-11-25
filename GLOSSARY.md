# Glossary

The terms of the true-cvat fork of CVAT: what the fork delivers, who may use it, what the Team Analytics page measures, and what the task list shows. Where the Team Analytics page shows a term, the `_Russian_` line gives the wording on screen.

## Fork and delivery

<a id="fork-tree"></a>
**Fork tree**:
The set of the fork's files at their relative paths under one root, from which the two images are built and the charts are installed.
_Avoid_: repo, checkout, clone, monorepo

<a id="stage-tag"></a>
**Stage tag**:
A tag of the form `v<upstream version>.<n>` that marks a release of the fork on top of one upstream CVAT version, with `n` counting from 1. It changes no version string, chart version or image tag.
_Avoid_: release tag, version tag

<a id="fork-server-image"></a>
**Fork server image**:
The one image, built from the fork tree, that the CVAT server and every worker run, including the Team Analytics worker.
_Avoid_: backend image, CVAT image

<a id="ui-image"></a>
**UI image**:
The image that serves the compiled CVAT web interface of the fork.
_Avoid_: frontend image, CVAT image

<a id="perimeter-input"></a>
**Perimeter input**:
A build input that a closed network must supply, such as a base image, a package mirror or an npm registry. It is a build argument with a public default (for a mirror, the public source itself) and an environment variable of the same name that the build script reads.
_Avoid_: mirror variable

<a id="policy-bundle"></a>
**Policy bundle**:
The archive of authorization policies (OPA rules) that the CVAT server builds and serves to its policy engine. A running server caches it, so after a policy changes the fork server image is rebuilt and the server restarted.
_Avoid_: OPA bundle, rules archive

<a id="analytics"></a>
**Analytics**:
Upstream CVAT's ClickHouse, Vector and Grafana stack, switched on by the chart value `analytics.enabled`. It is not Team Analytics, but Team Analytics exists only where it is enabled.
_Avoid_: using it for Team Analytics

<a id="backend-data-volume"></a>
**Backend data volume**:
The one persistent volume, claim `<release>-backend-data`, that the server and most workers mount under `/home/django` as `data`, `keys` and `logs`. The chart keeps it on uninstall.

<a id="listing-checks"></a>
**Listing checks**:
The checks that `verify/policy_bundle.sh` runs on an archive's list of entries before it extracts anything: only regular files and directories, no name outside the archive root, no name twice.

## Access

<a id="administrator"></a>
**Administrator**:
A member of CVAT's `admin` group. Only administrators may use Team Analytics, with or without an organization selected; no organization role allows it, an owner's included.
_Avoid_: superuser, admin user

<a id="role-floor"></a>
**Role floor**:
The fork's addition to the issue and comment permissions: a member of the organization that owns an issue or comment, whose global role is at least worker, may act on it and list all of them in the organization, whether or not they staff the job, task or project. Below that global role the stock rules decide alone.
_Russian_: порог роли

<a id="global-role"></a>
**Global role**:
The role an account has on the whole instance through its CVAT group: `admin`, `user` or `worker`; an account may have none. It is not a role in an organization.
_Russian_: глобальная роль
_Avoid_: privilege, global group

<a id="organization-scope"></a>
**Organization scope**:
Team Analytics for an administrator who has an organization selected: only that organization's work.
_Russian_: Организация (as «Организация <name>»)

<a id="instance-scope"></a>
**Instance scope**:
Team Analytics for an administrator with no organization selected: all organizations plus personal workspaces.
_Russian_: Все организации и личные пространства

## Team Analytics

<a id="team-analytics"></a>
**Team Analytics**:
The fork's page, API and worker that report annotators' working time and operations, built into the backend. The page is in Russian only; the name is not translated.
_Russian_: Team Analytics
_Avoid_: analytics, dashboard, TA

<a id="grafana"></a>
**Grafana**:
The stock CVAT header link to upstream's Grafana, which the fork renamed from "Analytics". It belongs to [Analytics](#analytics), not to Team Analytics.
_Russian_: Grafana

<a id="team-analytics-worker"></a>
**Team Analytics worker**:
The worker process of the fork server image that refreshes the stored totals and computes the answers the API cannot find in its cache. The API server itself never queries ClickHouse for Team Analytics. It exists only where analytics is enabled.
_Avoid_: analytics worker, TA worker

<a id="refresh"></a>
**Refresh**:
The worker's recomputation of a trailing window of hourly totals from the recorded events, replacing the hours as a whole.

<a id="events-database"></a>
**Events database**:
The ClickHouse database that holds the `events` table, which Vector fills with the activity records of the server and the UI. Every figure of [Team Analytics](#team-analytics) and every Grafana dashboard is computed from it. The initializer job creates it and applies its table migrations on every run.

<a id="totals-database"></a>
**Totals database**:
The ClickHouse database, named by `TEAM_ANALYTICS_DB` (default `team_analytics`), where the [Team Analytics worker](#team-analytics-worker) stores the hourly totals and the [cutover](#cutover). It is created and recomputed from the [events database](#events-database), and losing it loses no recorded event.

<a id="refresh-lock"></a>
**Refresh lock**:
The Redis lock that keeps one worker at a time inside a [refresh](#refresh) step. It is a lease of 120 seconds that its holder renews, so a killed worker frees it in at most that time.

<a id="daily-check"></a>
**Daily check**:
The once-a-day step of the history work: it compares the stored count of events of each processed day with the raw count, marks the days that differ, with their neighbours, for recomputing, and looks for an earlier [cutover](#cutover).

<a id="annotator"></a>
**Annotator**:
A person whose work counts in the figures. Reviewers count; [technical accounts](#technical-account) do not.
_Russian_: Аннотатор

<a id="technical-account"></a>
**Technical account**:
A user account that stands for an automated process rather than a person. It is left out of the lists of people, and every box it saves counts as a [Model](#model) box.
_Russian_: Техническая учётная запись

<a id="technical-accounts-list"></a>
**Technical accounts list**:
The one instance-wide list of technical accounts, kept by user id and edited by administrators in the Team Analytics settings. It applies retroactively, and a deleted account stays on it marked as deleted.
_Russian_: Технические учётные записи (the list's heading in the settings window «Настройки Team Analytics»)
_Avoid_: bot list, service accounts

<a id="team-analytics-settings"></a>
**Team Analytics settings**:
The window an administrator opens with the «Настройки» button of the Team Analytics page. It holds the [technical accounts list](#technical-accounts-list) and the switch of the [shortcut hints](#shortcut-hint), and nothing else.
_Russian_: Настройки Team Analytics
_Avoid_: using it for the backend's environment settings

<a id="no-project"></a>
**No project**:
The group of tasks that belong to no project. A deleted project stays under its id.
_Russian_: Без проекта

## Figures

<a id="session"></a>
**Session**:
One continuous interval of one person's work in jobs, at most one day long; a pause of more than five minutes ends it. Not a sign-in session.
_Russian_: Сессия (the sign-in session is «сеанс»)

<a id="idle-pause"></a>
**Idle pause**:
A pause of more than 100 seconds before an action. It belongs to no operation.
_Russian_: пауза бездействия

<a id="working-time"></a>
**Working time**:
The time the server counts as worked, the same figure Grafana shows. It is the only total.
_Russian_: Рабочее время

<a id="other"></a>
**Other**:
Working time outside the four operations for the scope shown, never below zero.
_Russian_: Прочее

<a id="operation"></a>
**Operation**:
Exactly one of Creation, Alignment, Class change or Deletion. It counts what people did: an undone creation counts, a redo does not.
_Russian_: Операция

<a id="creation"></a>
**Creation**:
The operation of making an object.
_Russian_: Создание

<a id="alignment"></a>
**Alignment**:
The operation that is an uninterrupted run of drags or resizes of one object. A group move is one alignment per object, with the time shared equally.
_Russian_: Подгонка

<a id="class-change"></a>
**Class change**:
The operation of changing an object's label.
_Russian_: Смена класса

<a id="deletion"></a>
**Deletion**:
The operation of removing an object.
_Russian_: Удаление

<a id="time-per-operation"></a>
**Time per operation**:
The time from the previous action to the end of the operation.
_Russian_: Время на операцию

<a id="creation-method"></a>
**Creation method**:
How a created object came to be: Drawn, Pasted, Propagated or Model.
_Russian_: Способ создания; Нарисовано / Вставлено / Распространено / Модель

<a id="model"></a>
**Model**:
The creation method for boxes saved by a technical account or by the built-in detector. They have counts but no time. Tags, interactor results and OpenCV objects are not creations.
_Russian_: Модель

<a id="hotkey-action"></a>
**Hotkey action**:
An action done by a key press, named by its function. A held key is one action, except frame navigation, which is one per frame moved.
_Russian_: Действие горячей клавишей (plural: Действия горячими клавишами)

<a id="mouse-action"></a>
**Mouse action**:
A click on a control outside the canvas: a button, a menu item, a sidebar control, a field or a tab; clicks on the canvas are not counted.
_Russian_: Действие мышью

<a id="hotkey-share"></a>
**Hotkey share**:
Hotkey actions divided by the sum of hotkey and mouse actions. Hotkey and mouse actions are recorded only in 2D jobs.
_Russian_: Доля горячих клавиш

<a id="shortcut-hint"></a>
**Shortcut hint**:
The box in the 2D annotation view that names an action and its hotkey to a person who keeps doing that action by mouse. It is shown rarely and stops for three days once the person does the action mostly by hotkey: a press of the hotkey that brings the action's [hotkey share](#hotkey-share) within the last hour, in that browser, above half. A held key counts as one press. Administrators switch the hints on or off for the whole instance in the Team Analytics settings.
_Russian_: Горячая клавиша (the line under the action's Russian name in the hint); Подсказки о горячих клавишах (the section of «Настройки Team Analytics»); Показывать подсказки аннотаторам (its switch)
_Avoid_: tooltip, tip, popup

<a id="hints-shown"></a>
**Hints shown**:
The number of [shortcut hints](#shortcut-hint) shown to the annotators of the scope, counted by action in 2D jobs. A hint is what the interface did, so it is neither a hotkey action nor a mouse action.
_Russian_: Показано подсказок (the total on the keyboard and mouse card); Подсказки (the column of the full view of hotkeys); Подсказка показана, горячая клавиша не использовалась (the heading over the hinted actions never done by hotkey)

<a id="bounding-box"></a>
**Bounding box**:
A rectangle object, the default shape type of the figures. The interface never abbreviates it.
_Russian_: Боксы
_Avoid_: bbox

<a id="all-shapes"></a>
**All shapes**:
The switch that counts objects of every shape type instead of bounding boxes only.
_Russian_: Все фигуры

<a id="saved-boxes"></a>
**Saved boxes**:
The count of boxes saved in a legacy period, where the creation method of a box is not known. It stands in for Model.
_Russian_: Сохранённые боксы

## Periods and history

<a id="period"></a>
**Period**:
The span of time the figures cover: Week (the last 7 days), Two weeks (14 days), Month (a calendar month, selectable) or Year (12 months), in the viewer's time zone.
_Russian_: Период (Неделя, Две недели, Месяц, Год)

<a id="trends"></a>
**Trends**:
Figures over the last 12 weeks or months.
_Russian_: Динамика

<a id="comparison"></a>
**Comparison**:
Side-by-side figures of up to five annotators or of up to five projects.
_Russian_: Сравнение

<a id="full-view"></a>
**Full view**:
A chart's expanded view.
_Russian_: Полный вид
_Avoid_: modal

<a id="overview"></a>
**Overview**:
The main page of Team Analytics: the figures of one period and scope.
_Russian_: Обзор (shown only in the back link «Назад к обзору»)

<a id="cutover"></a>
**Cutover**:
The hour of the first operation event of a user in a job that carries a shape type, which is when the new activity logging began. It is stored and only ever moves earlier.
_Russian_: переход на новый учёт действий (the new activity logging itself is «новый учёт действий»)

<a id="new-activity-logging"></a>
**New activity logging**:
What the fork's interface records on top of stock CVAT's events from the [cutover](#cutover) on: the shape type of an operation, class changes, and hotkey and mouse actions.
_Russian_: новый учёт действий

<a id="legacy-period"></a>
**Legacy period**:
A period that ends at or before the cutover, or any period when there is no cutover. Its operations cover all shapes, class changes and hotkey use were not recorded, and saved boxes stand in for Model.
_Russian_: период до перехода

<a id="partly-legacy-period"></a>
**Partly legacy period**:
A period that begins before the cutover and ends after it. Operations before the cutover count only under All shapes.
_Russian_: период, частично записанный до перехода

<a id="processed-history"></a>
**Processed history**:
The part of the past that the worker has processed. A period is offered only when fully processed; history fills newest first, and a warning shows when the data is over 30 minutes old.
_Russian_: Обработанная история

## Task list

<a id="task-progress-bar"></a>
**Task progress bar**:
The bar on a task's card in the task list that the fork splits into one segment per pair of job stage and job state that has jobs, each sized by its number of jobs, with a legend above it.
_Russian_: полоса прогресса задачи
_Avoid_: progress widget

<a id="not-available-segment"></a>
**Not available segment**:
The last segment of the [task progress bar](#task-progress-bar): the jobs of the task that the viewer could not fetch, the task's total minus the jobs received. It is shown only when that number is above zero.
_Russian_: сегмент «not available»
