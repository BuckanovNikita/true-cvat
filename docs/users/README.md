# Документация пользователя true-cvat

true-cvat — форк CVAT v2.82.0, веб-приложения для разметки изображений и видео; он меняет несколько мест интерфейса и прав и добавляет страницу [Team Analytics](../../GLOSSARY.md). Эти страницы для тех, кто уже знает CVAT: здесь описано только то, чем форк отличается.

## Что форк меняет в CVAT

| Отличие | Где описано |
| --- | --- |
| Полоса прогресса задачи ([task progress bar](../../GLOSSARY.md)) в списке задач (task) делит задания (job) по stage и state. | [Прогресс задачи](features/task-progress.md) |
| Участники (member) организации (organization) с группой не ниже `worker` работают со всеми issue и комментариями (comment) выбранной организации, а не только со связанными с ними. | [Права на issue и комментарии](features/issue-permissions.md) |
| Организации создаёт только администратор (administrator, группа `admin`). | [Создание организаций](features/organization-creation.md) |
| Страница Team Analytics для администраторов, на русском языке. | [Team Analytics](features/team-analytics.md) |
| Список «Технические учётные записи» ([Technical accounts list](../../GLOSSARY.md)) в диалоге «Настройки Team Analytics» ([Team Analytics settings](../../GLOSSARY.md)). | [Настройки Team Analytics](features/team-analytics-settings.md) |
| Ссылка шапки (header) «Analytics» называется «Grafana» ([Grafana](../../GLOSSARY.md)); администратору рядом видна ссылка «Team Analytics». | [Ссылки «Grafana» и «Team Analytics»](features/grafana-link.md) |
| Настройки (setting) сервера, от которых зависит, что видят пользователи. | [Настройки сервера](features/server-settings.md) |

## Кому что читать

- Читаете Team Analytics: [Team Analytics](features/team-analytics.md), [Как считаются показатели](features/team-analytics-figures.md), [Настройки Team Analytics](features/team-analytics-settings.md).
- Администрируете организации и права: [Создание организаций](features/organization-creation.md), [Права на issue и комментарии](features/issue-permissions.md), [Прогресс задачи](features/task-progress.md), [Ссылки в шапке](features/grafana-link.md), [Настройки сервера](features/server-settings.md).
- Пишете скрипты к серверу через `curl`: [HTTP API Team Analytics](reference/team-analytics-api.md).

Общие страницы для всех: [Сценарии](scenarios.md) и [Глоссарий](../../GLOSSARY.md).

## Все страницы

- [Сценарии](scenarios.md) — три сценария от начала до конца: организация, неделя команды, технические учётные записи.
- [Прогресс задачи по stage и state](features/task-progress.md) — сегменты, цвета и подписи полосы прогресса.
- [Права на issue и комментарии](features/issue-permissions.md) — что каждая роль может делать с issue и комментариями.
- [Создание организаций](features/organization-creation.md) — кто создаёт организации и что видят остальные.
- [Ссылки «Grafana» и «Team Analytics»](features/grafana-link.md) — что открывает каждая ссылка шапки и кто её видит.
- [Team Analytics](features/team-analytics.md) — как пользоваться страницей: период, фильтры, карточки, динамика, подробности.
- [Как считаются показатели Team Analytics](features/team-analytics-figures.md) — откуда каждое число и его ограничения.
- [Настройки Team Analytics](features/team-analytics-settings.md) — список технических учётных записей.
- [Настройки сервера](features/server-settings.md) — настройки сервера, которые меняют интерфейс.
- [HTTP API Team Analytics](reference/team-analytics-api.md) — адреса `/api/team-analytics/*` для `curl` и скриптов.
- [Глоссарий](../../GLOSSARY.md) — термины форка и их русские названия.
