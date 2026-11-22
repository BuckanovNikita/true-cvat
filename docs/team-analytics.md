# Operating Team Analytics

[Team Analytics](../GLOSSARY.md#team-analytics) is the fork's page, API and worker that report annotators' working time and operations. This page explains what runs where, how to check it, what its answers mean, how to manage the [technical accounts list](../GLOSSARY.md#technical-accounts-list), and what a failure of each part does.

## When it exists

Team Analytics exists only where [analytics](../GLOSSARY.md#analytics) is enabled: chart value `analytics.enabled: true` (the default in `helm-chart/values.yaml`), which sets `CVAT_ANALYTICS=1` in every backend pod. It reads the events that analytics records in ClickHouse.

With analytics off:

- every `/api/team-analytics/...` address answers `404`: the app is not installed and its addresses are not registered;
- the chart renders no [Team Analytics worker](../GLOSSARY.md#team-analytics-worker) Deployment;
- the header shows no «Team Analytics» link;
- a direct link to the page address `/team-analytics` shows the panel «Страница Team Analytics недоступна» ("The Team Analytics page is unavailable") to everybody, administrators included: the page treats the `404` like a refusal;
- the refresh job is not scheduled. The `team_analytics` queue is still defined, so that the initializer's `syncperiodicjobs` step removes a refresh schedule left from a time when analytics was on.

Switching analytics off does not delete the stored totals in ClickHouse.

## What runs where

| Part | Where it runs | What it does |
| --- | --- | --- |
| API | the CVAT server | Checks access, answers from the Redis cache, otherwise queues a read for the worker and waits. It never queries ClickHouse. The settings (the technical accounts list, the user search, project names) are answered from Postgres. |
| Team Analytics worker | Deployment `<release>-backend-worker-team-analytics`, running `run worker team_analytics` from the [fork server image](../GLOSSARY.md#fork-server-image) | Computes the answers and stores them in the cache; runs the refresh job. Every ClickHouse query of Team Analytics runs here. |
| Refresh job | on the Team Analytics worker, queue `team_analytics`, job id `team_analytics_refresh` | Runs every minute (cron `* * * * *`). |
| Scheduler | `rqscheduler` in the utils worker (`<release>-backend-worker-utils`) | Queues the refresh job every minute. The schedule is written to Redis by `django-admin syncperiodicjobs`, which the initializer Job runs on every install and upgrade. |

The worker's replicas and processes are chart values (`cvat.backend.worker.teamAnalytics.*`), described on the [CVAT chart page](charts/cvat.md). `replicas: 0` stops the worker.

### Data path

1. CVAT's server and UI record events. Vector receives them and writes them to the `events` table of ClickHouse (database `analytics.clickhouseDb`, default `cvat`).
2. The refresh job reads those events and writes hourly totals to the [totals database](../GLOSSARY.md#totals-database) (`TEAM_ANALYTICS_DB`, default `team_analytics`) on the same ClickHouse server. It creates that database and its tables when they are missing.
3. Read jobs compute answers from the stored totals and put them in the Redis cache.
4. The API serves answers from the cache.

### One run of the refresh job

A run takes short steps, one at a time, while there is work and until `TEAM_ANALYTICS_REFRESH_BUDGET_S` has passed. In order of priority, a step is:

1. the [refresh](../GLOSSARY.md#refresh) of the last `TEAM_ANALYTICS_REFRESH_WINDOW_HOURS` hours, when the last one is `TEAM_ANALYTICS_REFRESH_INTERVAL_S` old;
2. one day of [processed history](../GLOSSARY.md#processed-history), newest day first;
3. the [daily check](../GLOSSARY.md#daily-check), once a day: it marks the days whose number of recorded events changed for recomputing (history then processes them again) and looks for an earlier [cutover](../GLOSSARY.md#cutover).

After each step a run ends early when a read is waiting in the queue, so reads come before history; the first step of a run always happens. Each step holds the [refresh lock](../GLOSSARY.md#refresh-lock) in Redis, so two workers never write at once.

## Health checks and status codes

All addresses start with `/api/team-analytics/` and have no trailing slash. They are not under `/analytics`, which is [Grafana](../GLOSSARY.md#grafana).

| Method | Address | Served by |
| --- | --- | --- |
| `GET` | `/api/team-analytics/status` | worker (through the cache) |
| `GET` | `/api/team-analytics/overview` | worker (through the cache) |
| `GET` | `/api/team-analytics/trends` | worker (through the cache) |
| `GET` | `/api/team-analytics/list` | worker (through the cache) |
| `GET` | `/api/team-analytics/details` | worker (through the cache) |
| `GET`, `PUT` | `/api/team-analytics/settings` | server, Postgres |
| `GET` | `/api/team-analytics/settings/users` | server, Postgres |
| `GET` | `/api/team-analytics/project-names` | server, Postgres |

Only [administrators](../GLOSSARY.md#administrator) get answers ([access](access.md#team-analytics)). For a probe, use `status` with an administrator's credentials:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -u '<admin>:<password>' https://cvat.example.com/api/team-analytics/status
```

A request without credentials that gets `401` proves only that Team Analytics is installed.

With `org` (query parameter), `org_id` or the `X-Organization` header the answers describe that organization; without them, the whole instance. A named organization that does not exist gives `404`.

The `status` answer is JSON with one key per section. For a probe, read `refresh.stale` (`true` when the last successful refresh is more than 30 minutes old or there is none), `refresh.last_success_at` and `history.complete`. A section the worker could not read is `null` and the answer is still `200`: with ClickHouse unreachable, `status` can answer `200` with `null` sections, so it is not a ClickHouse probe.

<a id="status-codes"></a>

| Code | Meaning |
| --- | --- |
| `200` | The answer. For the read addresses it may come from the cache, computed up to `TEAM_ANALYTICS_ANSWER_TTL_S` ago. |
| `400` | A parameter was refused: too long (by the server) or invalid (by the worker), or a settings request was refused. Body: `{"error": "bad_request", "detail": "..."}`. The worker's refusal is remembered for `TEAM_ANALYTICS_FAILURE_TTL_S`. |
| `401` | The request carries no valid credentials. |
| `403` | The user is signed in but is not an administrator. |
| `404` | Analytics is off, so Team Analytics is not installed; or the request names an organization that does not exist. |
| `429` | No answer yet. Comes with `Retry-After` (`TEAM_ANALYTICS_READ_RETRY_AFTER_S`, default 3 s). See below. |
| `503` | `{"error": "unavailable"}`. The server could not use Redis (the cache or the queue); or the worker's read failed, usually because ClickHouse failed (the failure is repeated to every request for `TEAM_ANALYTICS_FAILURE_TTL_S`, then the read is tried again); or a settings save was stored but the answers computed on the old list could not be invalidated. |

All answers carry `Cache-Control: no-store`.

### What 429 means for capacity

A read address replies `429` when:

- the answer is not in the cache and the worker did not store it within `TEAM_ANALYTICS_READ_WAIT_S` (default 5 s);
- `TEAM_ANALYTICS_READ_QUEUE_LIMIT` reads (default 32) are already waiting, so the request is not queued at all;
- the worker is still preparing its first answer after a start with an empty cache.

The read stays queued, so the same request asked again after `Retry-After` usually finds its answer. The page asks again three times; with the defaults it gives up after 29 seconds and shows its error panel.

Steady `429` answers mean the worker cannot keep up or does not run. Check that the worker pods run, then add processes or replicas. A worker process runs one job at a time, and the refresh job can occupy one process for about `TEAM_ANALYTICS_REFRESH_BUDGET_S` of each minute (no new step starts after it, but a running step is not cut short). The settings are on the [configuration page](configuration.md).

## Technical accounts list

[Technical accounts](../GLOSSARY.md#technical-account) are user accounts of automated processes. They are left out of the lists of people, and every box they save counts as a Model box. The list is one per instance, kept in Postgres by user id, and starts empty.

To edit it:

1. Sign in as an administrator and open «Team Analytics» from the header.
2. Click «Настройки» ("Settings"). The dialog «Настройки Team Analytics» ("Team Analytics settings") opens with the section «Технические учётные записи» ("Technical accounts").
3. Under the label «Добавить учётную запись» ("Add account") is a search field with the placeholder «Поиск пользователей по имени» ("Search users by name"). Find the user in it and pick them. Remove an account with the icon button «Убрать из списка» ("Remove from list") on its row.
4. Click «Сохранить» ("Save"). «Отмена» ("Cancel") discards the changes.

Limits:

- at most 1000 accounts;
- an account you add must exist, otherwise the save is refused with `400` and `there is no user <id>`; the search takes at most 150 characters and returns at most 20 users, ordered by user name;
- a user deleted from CVAT stays on the list, shown as «удалённая учётная запись, ID <id>» ("deleted account, ID <id>"), until someone removes it.

The list applies retroactively: the next read of any period, past ones included, uses the current list. Each save is logged by the server as `Team Analytics technical accounts changed by <user> (user <id>): added [...], removed [...]`.

### Migrating from `TEAM_ANALYTICS_TECHNICAL_ACCOUNTS`

The variable no longer has any effect ([configuration](configuration.md#team_analytics_technical_accounts-is-no-longer-a-setting)). To move its accounts:

1. Note the accounts in the variable's value in `values.prod.yaml`.
2. Add each of them to the list on the page, as described above, and save.
3. Remove the variable from `cvat.backend.additionalEnv` and from `cvat.backend.worker.teamAnalytics.additionalEnv`.
4. Run `helm upgrade`. The warning `TEAM_ANALYTICS_TECHNICAL_ACCOUNTS is ignored: ...` no longer appears in the logs of the backend pods (every backend process that loads Team Analytics writes it once at start while the variable is set).

Until step 2 is done, the figures count those accounts as people. Once it is done, past periods are corrected too.

## Processed history and stale data

After the first start, the worker processes the past one UTC day at a time, newest first. While it does, the page shows «Обработка истории» ("Processing history") with a progress bar. A period is shown only when every day of it is processed; otherwise the page shows «Этот период ещё не обработан» ("This period is not processed yet").

When the last successful refresh is more than 30 minutes old, the page shows a warning that begins «Последнее обновление показателей:» ("Last update of the figures:") and ends «Недавняя работа может быть не учтена.» ("Recent work may be missing."). Before the first refresh it reads «Показатели ещё не обновлялись. Недавняя работа может быть не учтена.» ("The figures have not been updated yet. Recent work may be missing."), and the stamp next to the filters reads «Ещё не обновлялось» ("Not updated yet"). The warning means the refresh job does not run or fails: check the worker, the utils worker (the scheduler) and ClickHouse.

## Cutover

The cutover is the hour of the earliest recorded operation event of a user inside a job that carries a shape type in its payload (a draw, paste, propagate, drag, resize or delete of an object, or a class change), which is when the fork's new activity logging began. A period that ends before it, or any period while no cutover is known, has fewer figures. The `status` answer shows it as `cutover.at`, `null` while none is known.

- It is looked for in the recorded events by the first job after a start with an empty cache, by a refresh that stores the first shape-tagged hour while none is stored yet, and by the daily check.
- Every hour found is stored as a row in table `cutover` of the totals database; the earliest row is the cutover. So it only ever moves earlier, never later.
- No setting changes it, and no statement under the app's `sql/` removes a row from table `cutover`. A procedure for correcting a cutover that is too early is not described here.

## Failure modes

Team Analytics runs in its own queue and worker. Its API catches every failure of Redis and answers `503`; its jobs log every failure and never raise it. No Team Analytics code runs on the annotation paths, so a failure of the worker, of ClickHouse or of the totals database does not touch annotation. The one failure below that reaches beyond Team Analytics is the loss of Redis, which CVAT itself depends on.

| Failure | What Team Analytics shows | What to do |
| --- | --- | --- |
| Worker stopped or at `replicas: 0` | Answers already in the cache are served until `TEAM_ANALYTICS_ANSWER_TTL_S` passes or the UTC hour changes (the hour is part of the cache key), since no refresh changes the totals. Then every read replies `429` and the page shows its error panel. No refresh runs; the scheduler keeps queuing the job, and the first run after the worker returns does the work once. | Start the worker. |
| ClickHouse down | `overview`, `trends`, `list` and `details` reads that miss the cache reply `503`; `status` can reply `200` with `null` sections. Cached answers stay usable, because a refresh that fails before writing does not invalidate them. The refresh logs `the refresh of the Team Analytics totals failed; the next run tries again`. The stale warning needs a `status` answer that carries `refresh`; the page that is already open ages its last one. | Restore ClickHouse. The next run catches up. |
| Totals database dropped | The next run of the refresh job creates the database and its tables again. Recent hours return with the next refresh; history is processed again, newest first, and the page shows «Обработка истории» meanwhile. The cutover is found again by a refresh or the daily check. | Nothing, if the events are intact. |
| In-memory Redis lost | The cache, the queue, the refresh lock and the periodic job schedule are gone. Reads are queued and computed again, and the first one looks for the cutover again. The refresh job is no longer scheduled, so the figures stop updating. The same Redis holds every other CVAT queue and the cache, so the rest of CVAT is hit too. | Run the initializer again so `syncperiodicjobs` restores the schedule: `helm upgrade` with your values creates a new initializer Job (while `cvat.backend.initializer.enabled` is `true`, its default), or run `django-admin syncperiodicjobs` in a backend pod. |
| Worker killed inside a refresh | The refresh lock stays taken until its lease ends: at most 120 seconds. Other workers skip the step until then, and a later run does it again. What the killed step wrote stays hidden from readers until a refresh marks its hours. | Nothing. |

## See also

- [Configuration](configuration.md): every Team Analytics setting.
- [Access](access.md): who may use Team Analytics.
- [CVAT chart](charts/cvat.md): the Team Analytics worker values and `analytics.enabled`.
- [State](state.md): what the totals database and Redis hold, and what to back up.
- [Enabling Team Analytics](scenarios/enable-team-analytics.md).
