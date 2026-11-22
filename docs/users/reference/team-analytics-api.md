# HTTP API Team Analytics

Адреса `/api/team-analytics/*` отдают те же цифры и настройки, что страница Team Analytics ([Team Analytics](../../../GLOSSARY.md)): обзор, полный вид, динамику, подробности, список «Технические учётные записи». Они нужны, когда вы читаете цифры скриптом, например чтобы выгружать их по расписанию.

Этих адресов нет в схеме API CVAT (`/api/schema/`) и в SDK CVAT: вызывайте их обычным HTTP-запросом (request). Это API форка, а не CVAT; поля и параметры могут меняться вместе с форком.

## Доступ

Вызывать API может только администратор (administrator) — участник группы `admin`. Роль в организации (organization) ничего не даёт, роль `owner` тоже. Без права сервер отвечает `403`, без входа — `401`. Какую страницу видит администратор, описано в [team-analytics.md](../features/team-analytics.md).

Сервер принимает те же способы входа, что весь API CVAT:

| Способ | Заголовок | Замечание |
| --- | --- | --- |
| Логин и пароль (HTTP Basic) | `Authorization: Basic …` | Проще всего для скрипта. Если на сервере обязательно подтверждение почты, учётная запись (account) с неподтверждённой почтой получает `401`. |
| Персональный токен доступа CVAT | `Authorization: Bearer <токен>` | Токен «только для чтения» не может выполнить `PUT settings`: ответ `403`. |
| Ключ, полученный через `POST /api/auth/login` | `Authorization: Token <ключ>` | |
| Сеанс (sign-in session) браузера | cookie сеанса | Так ходит сама страница. Для `PUT` нужен ещё CSRF-токен; скрипту это неудобно. |

Пример: вход по логину и паролю, `$CVAT_USER` и `$CVAT_PASSWORD` — данные администратора `admin`.

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" \
  "https://cvat.example.com/api/team-analytics/status?tz=Europe/Moscow"
```

Адреса существуют, только когда на сервере включена аналитика; иначе любой запрос получает `404`. См. [server-settings.md](../features/server-settings.md).

## Общие правила

### Организация

Организацию выбирают так же, как в остальном API CVAT, одним из способов:

- параметр `org` с коротким именем: `org=visionteam`;
- заголовок `X-Organization: visionteam`;
- параметр `org_id` с id организации.

С организацией цифры относятся к ней («Организация», [Organization scope](../../../GLOSSARY.md)). Без организации, или с пустым `org=`, цифры охватывают весь сервер: «Все организации и личные пространства» ([Instance scope](../../../GLOSSARY.md)). Это отличие от остального CVAT, где запрос без организации означает личное пространство (personal workspace) того, кто спрашивает: у Team Analytics нет цифр одного личного пространства. Администратору не нужно быть участником (member) организации.

Неизвестная организация — `404` с телом `{"detail": "<имя> organization does not exist."}`. `org_id` вместе с `org` или `X-Organization`, либо `org` и `X-Organization` с разными значениями — `400` с телом-списком из одного предложения CVAT.

Организация влияет на `overview`, `trends`, `list` и `details`. `status` описывает весь сервер при любой организации. Список «Технические учётные записи» один на весь сервер, поэтому `settings`, `settings/users` и `project-names` от организации тоже не зависят.

### Часовой пояс

Параметр `tz` — имя часового пояса IANA, например `Europe/Moscow`. По умолчанию `UTC`. Он задаёт, где начинаются и кончаются дни, недели и месяцы периода; как это сказывается на цифрах, описано в [team-analytics-figures.md](../features/team-analytics-figures.md). Неизвестное имя — `400` с `detail` `unknown time zone: <имя>`. Страница передаёт часовой пояс браузера.

### Параметры

Каждый адрес читает только свои параметры (они перечислены в его разделе); остальные сервер молча отбрасывает. Значение длиннее допустимого сразу получает `400` с `detail` `<параметр> is too long`. Остальные проверки выполняет обработчик в очереди: неверное значение тоже даёт `400`, но может прийти после одного или нескольких ответов `429`.

Пустое значение почти везде равно отсутствию параметра: берётся значение по умолчанию. Исключения: пустой `period=` даёт `400` `unknown period: `, пустой `by=` в `list` — `400`, пустой `ids=` в `details` при `by=projects` означает «ни одного проекта».

Общие параметры периода и фильтров:

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `period` | нет | `week` (по умолчанию), `two_weeks`, `month`, `year`; до 16 символов | Период ([Period](../../../GLOSSARY.md)): «Неделя» и «Две недели» кончаются сегодня, «Месяц» — один календарный месяц, «Год» — двенадцать месяцев до сегодня. |
| `month` | нет | `ГГГГ-ММ`, не раньше `1970-01` и не позже текущего месяца; 7 символов | Месяц для `period=month`. По умолчанию текущий месяц в поясе `tz`. При другом `period` не действует. |
| `tz` | нет | имя часового пояса IANA, до 64 символов; по умолчанию `UTC` | Часовой пояс дней периода. |
| `project` | нет | id проекта (project), до 19 цифр; `0` — «Без проекта» ([No project](../../../GLOSSARY.md)) | Фильтр по проекту. |
| `annotator` | нет | id пользователя (user), до 19 цифр | Фильтр по аннотатору ([Annotator](../../../GLOSSARY.md)). |
| `shapes` | нет | `all` (по умолчанию), `bounding_boxes`; до 16 символов | Переключатель «Все фигуры» ([All shapes](../../../GLOSSARY.md)) / «Боксы» ([Bounding box](../../../GLOSSARY.md)). |

Ошибки проверки: `unknown period: <значение>`, `not a month (YYYY-MM): <значение>`, `month not reached yet: <значение>`, `project must be an identifier`, `annotator must be an identifier`, `shapes must be bounding_boxes or all`.

Поле `period` в ответах повторяет период:

```json
{
  "from": "2026-09-30T21:00:00+00:00",
  "to": "2026-10-31T21:00:00+00:00",
  "name": "month",
  "tz": "Europe/Moscow",
  "first_day": "2026-10-01",
  "last_day": "2026-10-31",
  "month": "2026-10",
  "to_date": false,
  "unit": "day"
}
```

`from` и `to` — границы в UTC (`to` не входит в период), `first_day` и `last_day` — дни в поясе `tz`, `to_date` — период ещё идёт, `unit` — шаг графика: `day`, у «Года» `week`.

### Период, обработанный не полностью

Цифры есть только за обработанную историю ([Processed history](../../../GLOSSARY.md)), см. [team-analytics-figures.md](../features/team-analytics-figures.md). Если период обработан не полностью, ответ сохраняет поле `processed: false`, описание периода, фильтры и флаги перехода (`legacy`, `partly_legacy`, `cutover`, `shapes`), а все поля с цифрами равны `null`: не частичные числа, а `null`. Что именно остаётся, сказано в разделе каждого адреса. В `trends` то же самое происходит с каждой неделей или месяцем отдельно. Какие периоды уже обработаны, показывает `status`.

### Ожидание и повторы

Сервер не считает цифры в момент запроса. Готовый ответ берётся из кэша; если его нет, чтение ставится в очередь, и запрос ждёт ответа до `TEAM_ANALYTICS_READ_WAIT_S` секунд (по умолчанию 5). Если ответ не появился, сервер отвечает `429` без тела с заголовком `Retry-After`: через столько секунд спросите снова (по умолчанию 3, настройка `TEAM_ANALYTICS_READ_RETRY_AFTER_S`). Повторный запрос с теми же параметрами (в любом порядке) не ставит второе чтение, а ждёт первое. `429` приходит сразу, без ожидания, когда в очереди уже ждут `TEAM_ANALYTICS_READ_QUEUE_LIMIT` чтений (по умолчанию 32). Настройки описаны в [server-settings.md](../features/server-settings.md).

Готовый ответ используется, пока не обновятся итоги, но не дольше `TEAM_ANALYTICS_ANSWER_TTL_S` секунд (по умолчанию 900) и не дольше текущего часа UTC: в начале нового часа тот же запрос считается заново. Отказ `400` из очереди и неудачное чтение (`503`) сервер помнит `TEAM_ANALYTICS_FAILURE_TTL_S` секунд (по умолчанию 5).

Цикл повторов, который можно скопировать:

```bash
url="https://cvat.example.com/api/team-analytics/overview?org=visionteam&period=month&month=2026-10&tz=Europe/Moscow"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  code=$(curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" -D headers.txt -o answer.json -w '%{http_code}' "$url")
  if [ "$code" != 429 ]; then break; fi
  wait=$(tr -d '\r' < headers.txt | awk -F': ' 'tolower($1) == "retry-after" {print $2}')
  sleep "${wait:-3}"
done
echo "HTTP $code"; cat answer.json
```

Страница делает так же, но сдаётся после трёх повторов.

### Кэширование

Каждый ответ этих адресов, включая отказы, приходит с заголовком `Cache-Control: no-store`: браузер и прокси его не хранят.

## GET /api/team-analytics/status

Состояние сохранённых цифр: когда они обновлялись, насколько обработана история, когда был переход на новый учёт действий ([Cutover](../../../GLOSSARY.md)). Сам по себе не возвращает `processed` и не обнуляется. Что значат поля, описано в [team-analytics-figures.md](../features/team-analytics-figures.md).

### Параметры

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `tz` | нет | имя часового пояса IANA, до 64 символов; по умолчанию `UTC` | Пояс для дней истории и периодов в `history.periods`. |

### Ответ

Раздел, который не удалось прочитать, равен `null`; остальные приходят.

```json
{
  "cutover": {"at": "2026-06-01T09:00:00+00:00"},
  "history": {
    "complete": false,
    "percent": 62,
    "ready_from": "2026-05-04T21:00:00+00:00",
    "ready_from_day": "2026-05-05",
    "first_day": "2025-11-02",
    "days_ready": 200,
    "days_total": 322,
    "periods": {"week": true, "two_weeks": true, "month": true, "year": false},
    "earliest_month": "2026-06",
    "complete_weeks": 12,
    "trends_ready": true
  },
  "refresh": {
    "last_success_at": "2026-10-20T08:50:00+00:00",
    "now": "2026-10-20T09:00:00+00:00",
    "interval_s": 600,
    "stale_after_s": 1800,
    "stale": false
  }
}
```

| Поле | Что значит |
| --- | --- |
| `cutover.at` | Момент перехода на новый учёт действий или `null`. |
| `history.periods` | Обработан ли полностью каждый период, кончающийся сегодня (для `month` — текущий месяц). |
| `history.earliest_month` | Первый месяц, за который есть цифры; `null` — история обработана целиком или такого месяца ещё нет. |
| `history.trends_ready` | Достаточно ли обработанных недель для динамики. |
| `refresh.stale` | Цифры давно не обновлялись. |

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" \
  "https://cvat.example.com/api/team-analytics/status?org=visionteam&tz=Europe/Moscow"
```

## GET /api/team-analytics/overview

Цифры обзора ([Overview](../../../GLOSSARY.md)): по одному ключу на карточку (card). Что показывает каждая карточка, описано в [team-analytics.md](../features/team-analytics.md), как считаются цифры — в [team-analytics-figures.md](../features/team-analytics-figures.md).

### Параметры

`period`, `month`, `tz`, `project`, `annotator`, `shapes` — см. [Параметры](#параметры).

### Ответ

Сокращённо:

```json
{
  "period": {"name": "month", "month": "2026-10", "tz": "Europe/Moscow", "...": "..."},
  "processed": true,
  "filters": {"project": 12, "annotator": {"user_id": 7, "user_name": "annotator-1"}},
  "headline": {"annotators": 3, "projects": 1},
  "operations": {
    "legacy": false, "partly_legacy": false, "cutover": "2026-06-01T09:00:00+00:00",
    "shapes": "all", "working_time_ms": 36000000, "active_time_ms": 30000000,
    "rows": [{"operation": "creation", "objects": 900, "timed_objects": 850, "time_ms": 9000000,
              "average_ms": 10588.2, "share": 0.3, "hotkey_objects": 400, "mouse_objects": 450}]
  },
  "by_annotator": {"legacy": false, "rows": [{"user_id": 7, "user_name": "annotator-1",
                   "working_time_ms": 20000000, "operations": {"...": "..."}}],
                   "rest": {"count": 0, "working_time_ms": 0, "operations": {"...": "..."}}},
  "by_project": {"legacy": false, "rows": [{"project_id": 12, "working_time_ms": 36000000, "operations": {"...": "..."}}],
                 "rest": {"count": 0, "working_time_ms": 0, "operations": {"...": "..."}}},
  "creation_methods": {"shapes": "all", "rows": [{"method": "drawn", "objects": 700, "timed_objects": 650,
                       "time_ms": 7000000, "average_ms": 10769.2, "share": 0.7}],
                       "total": {"objects": 1000, "timed_objects": 850, "time_ms": 9000000, "average_ms": 10588.2},
                       "model": {"objects": 100, "share": 0.1}, "technical_accounts": 1},
  "input": {"hotkey_actions": 1200, "mouse_actions": 800, "canvas_clicks": 3000, "hotkey_share": 0.6,
            "top_hotkeys": [{"action": "...", "actions": 300}], "rest": {"count": 4, "actions": 120}},
  "saved_boxes": {"boxes": 950, "by_annotator": [{"user_id": 7, "user_name": "annotator-1", "boxes": 600}],
                  "by_project": [{"project_id": 12, "boxes": 950}]},
  "sessions": {"sessions": 40, "average_ms": 900000, "total_ms": 36000000,
               "by_annotator": [{"user_id": 7, "user_name": "annotator-1", "sessions": 20,
                                 "average_ms": 1000000, "total_ms": 20000000}]},
  "time_series": {"unit": "day", "buckets": [{"start": "2026-10-01", "working_time_ms": 1200000}]}
}
```

| Поле | Что значит |
| --- | --- |
| `processed` | Обработан ли весь период. |
| `filters` | Повтор фильтров: id проекта и аннотатор с его именем. |
| `operations` | Рабочее время ([Working time](../../../GLOSSARY.md)) и операции ([Operation](../../../GLOSSARY.md)) периода, флаги перехода. |
| `by_annotator`, `by_project` | До 8 самых больших строк по рабочему времени; `rest` — число и сумма остальных. Строки без рабочего времени не входят ни туда, ни туда. |
| `creation_methods` | Способы создания ([Creation method](../../../GLOSSARY.md)); `technical_accounts` — сколько записей в списке «Технические учётные записи». |
| `input` | Действия горячими клавишами ([Hotkey action](../../../GLOSSARY.md)) и мышью; `top_hotkeys` — до 7 самых частых, `rest` — остальные. |
| `saved_boxes` | Сохранённые боксы ([Saved boxes](../../../GLOSSARY.md)). |
| `sessions` | Сессии ([Session](../../../GLOSSARY.md)). |
| `time_series` | Рабочее время по дням (у «Года» — по неделям). |

Если период обработан не полностью, остаются `period`, `filters`, `processed: false` и в `operations` только `legacy`, `partly_legacy`, `cutover`, `shapes`; все остальные ключи равны `null`.

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" \
  "https://cvat.example.com/api/team-analytics/overview?org=visionteam&period=month&month=2026-10&tz=Europe/Moscow&project=12&shapes=bounding_boxes"
```

## GET /api/team-analytics/trends

Динамика ([Trends](../../../GLOSSARY.md)): четыре показателя за последние двенадцать недель или месяцев, независимо от периода. Последняя неделя или месяц — текущие, неполные. Как это выглядит на странице, описано в [team-analytics.md](../features/team-analytics.md).

### Параметры

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `step` | нет | `week` (по умолчанию, недели с понедельника), `month`; до 16 символов | Шаг. |
| `compare` | нет | `annotators` (по умолчанию), `projects`; до 16 символов | Что сравнивается в сравнении ([Comparison](../../../GLOSSARY.md)) и кто предлагается в `candidates`. |
| `ids` | нет | до 5 id через запятую, каждый до 19 цифр; повторы считаются один раз | Линии сравнения. Без `ids` — одна линия по фильтрам; с `ids` — по линии на id, и фильтр того же вида не применяется. |
| `tz` | нет | см. [Параметры](#параметры) | Пояс недель и месяцев. |
| `project`, `annotator`, `shapes` | нет | см. [Параметры](#параметры) | Фильтры и переключатель фигур. |

`period` и `month` здесь не читаются. Ошибки: `step must be one of week, month`, `compare must be one of annotators, projects`, `ids must be identifiers`, `at most 5 ids can be compared`.

### Ответ

```json
{
  "step": "week",
  "tz": "Europe/Moscow",
  "shapes": "all",
  "compare": "annotators",
  "buckets": [{"start": "2026-08-03", "processed": true}, {"start": "2026-10-19", "processed": false}],
  "lines": [{
    "id": 7,
    "user_name": "annotator-1",
    "points": [
      {"working_time_ms": 7200000, "legacy": false, "boxes": 300, "timed_boxes": 280,
       "box_time_ms": 3000000, "average_ms": 10714.3, "hotkey_recorded": true,
       "hotkey_actions": 400, "mouse_actions": 200, "hotkey_share": 0.67},
      {"working_time_ms": null, "legacy": false, "boxes": null, "timed_boxes": null,
       "box_time_ms": null, "average_ms": null, "hotkey_recorded": true,
       "hotkey_actions": null, "mouse_actions": null, "hotkey_share": null}
    ]
  }],
  "candidates": [{"id": 7, "user_name": "annotator-1", "working_time_ms": 50000000}]
}
```

| Поле | Что значит |
| --- | --- |
| `buckets` | Двенадцать недель или месяцев и обработан ли каждый. |
| `lines[].points` | По точке на каждый элемент `buckets`. В необработанном остаются только `legacy` и `hotkey_recorded`, остальное `null`. |
| `lines[].id`, `user_name` | id линии при `ids` (имя — только для аннотаторов), иначе `null`. |
| `candidates` | Все, у кого есть работа за двенадцать шагов; `working_time_ms` — только по обработанным шагам, `null`, пока ни один не обработан. |

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" \
  "https://cvat.example.com/api/team-analytics/trends?org=visionteam&step=month&compare=annotators&ids=7,8&tz=Europe/Moscow"
```

## GET /api/team-analytics/list

Все строки одного графика для полного вида ([Full view](../../../GLOSSARY.md)): по аннотаторам, по проектам или по горячим клавишам.

### Параметры

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `by` | да | `annotators`, `projects`, `hotkeys`; до 16 символов | Какой график. Без него — `400` `by must be one of annotators, projects, hotkeys`. |
| `period`, `month`, `tz`, `project`, `annotator`, `shapes` | нет | см. [Параметры](#параметры) | Период, фильтры, фигуры. Для `hotkeys` переключатель фигур не действует. |

### Ответ

Для `annotators` и `projects` строки идут от большего рабочего времени к меньшему:

```json
{
  "period": {"name": "week", "...": "..."},
  "processed": true,
  "by": "annotators",
  "legacy": false, "partly_legacy": false, "cutover": null, "shapes": "all",
  "total": {"count": 3, "working_time_ms": 36000000},
  "rows": [{
    "id": 7, "user_name": "annotator-1", "working_time_ms": 20000000, "share": 0.56,
    "operations": {
      "creation": {"objects": 500, "timed_objects": 480, "time_ms": 5000000, "average_ms": 10416.7},
      "alignment": {"...": "..."}, "class_change": {"...": "..."}, "deletion": {"...": "..."},
      "other": {"time_ms": 1000000}
    },
    "methods": {"drawn": {"...": "..."}, "pasted": {"...": "..."}, "propagated": {"...": "..."}},
    "model": 40
  }]
}
```

У проектов `user_name` равен `null`. Для `hotkeys` вместо `total` и флагов перехода:

```json
{"period": {"...": "..."}, "processed": true, "by": "hotkeys",
 "hotkey_actions": 1200, "rows": [{"action": "...", "actions": 300, "share": 0.25}]}
```

Что значат поля, описано в [team-analytics-figures.md](../features/team-analytics-figures.md). Если период обработан не полностью, остаются `period`, `processed`, `by` и, для `annotators` и `projects`, флаги перехода; `total`, `rows` и `hotkey_actions` равны `null`.

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" \
  "https://cvat.example.com/api/team-analytics/list?org=visionteam&by=projects&period=two_weeks&tz=Europe/Moscow"
```

## GET /api/team-analytics/details

Таблица «Подробности»: все показатели по аннотаторам или по проектам, по 10 строк на страницу, от большего рабочего времени. Фильтр того же вида, что таблица, не применяется (все строки остаются в списке), другой фильтр применяется. Как таблица выглядит на странице, описано в [team-analytics.md](../features/team-analytics.md).

### Параметры

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `by` | нет | `annotators` (по умолчанию), `projects`; до 16 символов | Строки таблицы. |
| `page` | нет | номер от 1, до 9 цифр; по умолчанию 1 | Страница. Номер больше последнего даёт последнюю. |
| `search` | нет | текст до 200 символов | Часть имени аннотатора, без учёта регистра; пробелы по краям отбрасываются. Только при `by=annotators`. |
| `ids` | нет | id проектов через запятую, не больше 5000, каждый до 19 цифр | Только при `by=projects`: показать эти проекты. Передан, но пуст — ни один проект не подходит. |
| `period`, `month`, `tz`, `project`, `annotator`, `shapes` | нет | см. [Параметры](#параметры) | Период, фильтры, фигуры. |

Ошибки: `by must be one of annotators, projects`, `page must be a positive number`, `ids must be identifiers`.

### Ответ

```json
{
  "by": "annotators",
  "page": 1,
  "page_size": 10,
  "total": 3,
  "legacy": false, "partly_legacy": false, "cutover": null, "shapes": "all",
  "processed": true,
  "technical_accounts": 1,
  "rows": [{
    "id": 7, "user_name": "annotator-1", "projects": 2, "sessions": 20,
    "working_time_ms": 20000000, "drawn": 400, "pasted": 50, "propagated": 30, "model": 40,
    "saved_boxes": 600, "alignments": 300, "class_changes": 20, "deletions": 15,
    "average_create_ms": 10416.7, "hotkey_share": 0.6
  }]
}
```

При `by=projects` у строки вместо `projects` поле `annotators`, `user_name` равен `null`, а в ответе есть ещё `project_ids` — id всех проектов в области (по ним скрипт находит проекты по имени через [project-names](#get-apiteam-analyticsproject-names)). `total` — число строк, подходящих под `search` или `ids`, `technical_accounts` — сколько записей в списке «Технические учётные записи».

Если период обработан не полностью, остаются `by`, `page_size`, `processed`, `technical_accounts` и флаги перехода; `page`, `total`, `rows` и `project_ids` равны `null`.

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" \
  "https://cvat.example.com/api/team-analytics/details?org=visionteam&by=annotators&page=2&search=annotator&tz=Europe/Moscow"
```

## GET /api/team-analytics/settings

Список «Технические учётные записи» ([Technical accounts list](../../../GLOSSARY.md)), один на весь сервер. Что он меняет в цифрах, описано в [team-analytics-settings.md](../features/team-analytics-settings.md). Отвечает сразу, без очереди и без `429`.

### Параметры

Параметров нет.

### Ответ

Записи отсортированы по имени, затем по id. `deleted: true` — пользователь удалён из CVAT, имя последнее известное.

```json
{"technical_accounts": [{"user_id": 15, "user_name": "model-bot", "deleted": false}]}
```

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" "https://cvat.example.com/api/team-analytics/settings"
```

## PUT /api/team-analytics/settings

Заменяет список «Технические учётные записи» целиком. Правила списка описаны в [team-analytics-settings.md](../features/team-analytics-settings.md).

### Параметры

Тело — JSON с заголовком `Content-Type: application/json`:

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `technical_accounts` | да | список id пользователей: целые числа больше 0, без повторов, не больше 1000 | Новый список целиком. Новый id должен быть существующим пользователем; id удалённого пользователя, который уже в списке, можно оставить. |

Ошибки `400`: `the body could not be read: …`, `technical_accounts: This field is required.`, `technical_accounts must be a list of user ids`, `technical_accounts may name at most 1000 users`, `every technical account must be a user id: a positive integer`, `user <id> is named twice`, `there is no user <id>`. Тело не объект JSON (например, голый список) — `Invalid data. Expected a dictionary, but got list.`

### Ответ

`200` и тот же ответ, что у `GET settings`, с новым списком. `503` с телом `{"error": "unavailable"}` — список сохранён, но старые ответы с цифрами ещё могут использоваться; повторите тот же `PUT`.

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" -X PUT \
  -H "Content-Type: application/json" \
  -d '{"technical_accounts": [15]}' \
  "https://cvat.example.com/api/team-analytics/settings"
```

## GET /api/team-analytics/settings/users

Поиск пользователей для списка «Технические учётные записи». Ищет текст без учёта регистра в логине, имени и фамилии. Отвечает сразу.

### Параметры

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `search` | нет | текст до 150 символов; пусто — все | Что искать. Длиннее — `400` `search may be at most 150 characters long`. |

### Ответ

Не больше 20 пользователей, по логину:

```json
{"users": [{"id": 15, "username": "model-bot", "first_name": "", "last_name": ""}]}
```

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" "https://cvat.example.com/api/team-analytics/settings/users?search=bot"
```

## GET /api/team-analytics/project-names

Имена проектов по id, из любой организации. Так страница подписывает проекты в цифрах всего сервера. Отвечает сразу.

### Параметры

| Параметр | Обязателен | Значения | Что задаёт |
| --- | --- | --- | --- |
| `ids` | нет | id проектов через запятую: целые числа больше 0, до 19 цифр, не больше 500; пусто — ни одного | Чьи имена нужны. Ошибки: `ids may name at most 500 projects`, `ids must be project ids separated by commas`. |

### Ответ

Ключ — id строкой. Несуществующих проектов в ответе нет.

```json
{"names": {"12": "Road signs"}}
```

### Пример

```bash
curl -sS -u "$CVAT_USER:$CVAT_PASSWORD" "https://cvat.example.com/api/team-analytics/project-names?ids=12,13"
```

## Ошибки

| Статус | Тело | Причина | Что делать |
| --- | --- | --- | --- |
| `400` | `{"error": "bad_request", "detail": "<предложение>"}` | Неверное или слишком длинное значение параметра, неверное тело `PUT`. `detail` называет ошибку. | Исправьте значение. Тот же запрос снова получит `400`. |
| `400` | `["<предложение CVAT>"]` | Организация указана противоречиво (`org_id` вместе с `org` или `X-Organization`, либо `org` и `X-Organization` различаются). | Укажите организацию одним способом. |
| `401` | `{"detail": "…"}` | Нет данных входа, они неверны, или почта не подтверждена при обязательном подтверждении. | Проверьте `$CVAT_USER` и `$CVAT_PASSWORD` или токен. |
| `403` | `{"detail": "…"}` | Пользователь не администратор, или токен «только для чтения» в `PUT`. | Войдите администратором. |
| `404` | `{"detail": "<имя> organization does not exist."}` или страница «не найдено» | Нет такой организации, или аналитика на сервере выключена. | Проверьте `org`; про аналитику см. [server-settings.md](../features/server-settings.md). |
| `429` | нет | Ответ ещё не готов, или очередь чтений переполнена. Заголовок `Retry-After`. | Повторите через `Retry-After` секунд, см. [Ожидание и повторы](#ожидание-и-повторы). |
| `503` | `{"error": "unavailable"}` | Кэш или очередь недоступны, чтение цифр не удалось, или `PUT settings` сохранил список, но не обновил ответы. | Повторите позже; несколько секунд сервер отвечает тем же. Если не проходит, сообщите администратору сервера. |

Если `429` или `503` не проходят долго, причина обычно в обработчике очереди Team Analytics на сервере: его состояние проверяет администратор сервера.
<!-- ALIGN: link to the DevOps docs (operating the Team Analytics worker) -->

## См. также

- [team-analytics.md](../features/team-analytics.md) — страница Team Analytics.
- [team-analytics-figures.md](../features/team-analytics-figures.md) — как считается каждый показатель.
- [team-analytics-settings.md](../features/team-analytics-settings.md) — список «Технические учётные записи».
- [server-settings.md](../features/server-settings.md) — настройки сервера, в том числе ожидание и `Retry-After`.
