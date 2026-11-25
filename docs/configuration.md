# Backend configuration

This page lists every backend environment setting the fork adds, and the one stock setting whose default it changes. Read it when you tune [Team Analytics](../GLOSSARY.md#team-analytics) or decide who may create organizations.

## Team Analytics settings

All of these exist only where [analytics](../GLOSSARY.md#analytics) is enabled (`CVAT_ANALYTICS=1`, which the chart sets from `analytics.enabled`). Every value is a number except `TEAM_ANALYTICS_DB`. "Minimum" is the smallest value the code accepts.

| Setting | Default | Type and minimum | What it controls |
| --- | --- | --- | --- |
| `TEAM_ANALYTICS_DB` | `team_analytics` | text | ClickHouse database that holds the stored totals. It lives on the same ClickHouse server as CVAT's events (`CLICKHOUSE_HOST`, `CLICKHOUSE_PORT`). The worker creates it if it is missing. The value is not checked: a variable that is set but empty gives an empty name, not the default. |
| `TEAM_ANALYTICS_REFRESH_INTERVAL_S` | `600` | integer, at least 1 | How often the recent hours are recomputed, in seconds. The page shows it next to the freshness stamp. |
| `TEAM_ANALYTICS_REFRESH_WINDOW_HOURS` | `48` | integer, at least 1 | How many recent hours each refresh recomputes. |
| `TEAM_ANALYTICS_LOOKBACK_S` | `300` | integer, at least 0 | How far before the refresh window a refresh reads events, in seconds. |
| `TEAM_ANALYTICS_REFRESH_BUDGET_S` | `45` | integer, at least 0 | Seconds after which one run of the refresh job starts no new step. The job is scheduled every minute. |
| `TEAM_ANALYTICS_REFRESH_STATEMENT_S` | `300.0` | decimal, at least 1 | Time limit ClickHouse enforces on one statement of a refresh or of a day of history, in seconds. |
| `TEAM_ANALYTICS_READ_WAIT_S` | `5.0` | decimal, at least 0 | How long an API request waits for an answer that is not in the cache before it replies 429. `0` replies at once. |
| `TEAM_ANALYTICS_READ_RETRY_AFTER_S` | `3` | integer, at least 0 | The `Retry-After` value, in seconds, of a 429 answer. |
| `TEAM_ANALYTICS_READ_QUEUE_LIMIT` | `32` | integer, at least 1 | Number of reads waiting in the queue beyond which a request is not queued and replies 429. |
| `TEAM_ANALYTICS_READ_STATEMENT_S` | `20.0` | decimal, at least 1 | Time limit ClickHouse enforces on one statement of a read, in seconds. |
| `TEAM_ANALYTICS_READ_STATEMENT_MEMORY_BYTES` | `536870912` (512 MiB) | integer, at least 1 | Memory limit ClickHouse enforces on one statement of a read, in bytes. |
| `TEAM_ANALYTICS_READ_JOB_TIMEOUT_S` | `90` | integer, at least 1 | Timeout of one read job on the worker, in seconds. It is also how long a queued read may wait before it is dropped. |
| `TEAM_ANALYTICS_ANSWER_TTL_S` | `900` | integer, at least 1 | How long a computed answer stays in the cache, in seconds. An answer is used only while the totals it was computed on are current. |
| `TEAM_ANALYTICS_FAILURE_TTL_S` | `5` | integer, at least 1 | How long a failed read (503) or a refused parameter (400) is remembered, in seconds, so a burst of requests does not repeat it. |

What 429 and 503 answers mean for an operator is on the [Team Analytics page](team-analytics.md#status-codes).

### How a value is read

1. Each setting is read from the environment variable of the same name when the backend process starts.
2. An unset variable gives the default. So does an empty one, except for `TEAM_ANALYTICS_DB`.
3. A setting defined in the Django settings module wins over the environment variable. The fork's settings module defines none of them, so in a chart install the environment decides.

### Invalid values

An invalid value never stops CVAT from starting. The process logs an error at level `ERROR` and uses the default. There are two messages:

```text
TEAM_ANALYTICS_READ_QUEUE_LIMIT='abc' is not a number; using 32
TEAM_ANALYTICS_REFRESH_INTERVAL_S='0' must be a number of at least 1; using 600
```

- "is not a number" appears when the text does not parse. An integer setting given a decimal (`5.0`), `nan` or `inf` is not a number too.
- "must be a number of at least" appears when the value is below the minimum. A decimal setting given `nan` or `inf` gets this message as well.

The logger is `cvat.apps.team_analytics.default_settings`. Search the server and worker logs for it after you change a value.

### Which processes need the values

The server (API) and the [Team Analytics worker](../GLOSSARY.md#team-analytics-worker) read different settings:

| Process | Settings it uses |
| --- | --- |
| server | `TEAM_ANALYTICS_READ_WAIT_S`, `TEAM_ANALYTICS_READ_RETRY_AFTER_S`, `TEAM_ANALYTICS_READ_QUEUE_LIMIT`, `TEAM_ANALYTICS_READ_JOB_TIMEOUT_S` |
| Team Analytics worker | all others |

Give both the same values. The simplest way is `cvat.backend.additionalEnv`, which the chart passes to the server, the initializer job, every backend worker and the Team Analytics worker. To set a value for the Team Analytics worker only, use `cvat.backend.worker.teamAnalytics.additionalEnv`; the chart appends it after `cvat.backend.additionalEnv`. Both values are described on the [CVAT chart page](charts/cvat.md).

```yaml
# values.prod.yaml
cvat:
  backend:
    additionalEnv:
      - name: TEAM_ANALYTICS_READ_QUEUE_LIMIT
        value: "64"
```

A process reads the settings only at start. After a change, run `helm upgrade` so the pods restart with the new environment.

## Organization creation: `CVAT_ORGANIZATIONS_MIN_ROLE_TO_CREATE`

This is upstream's setting. The fork changes only its default.

- Fork default: `admin`. Only [administrators](../GLOSSARY.md#administrator) can create organizations. Upstream's default is `user`.
- Values the policy understands: `admin`, `user`, `worker`. Any other value is not checked at start and leaves only administrators able to create an organization. The setting is the lowest global role that may create an organization: `user` allows administrators and users, `worker` allows every account with a global role.
- Only the server reads it. The environment variable wins over the fork's default. To restore upstream's behaviour, set it to `user` in `cvat.backend.additionalEnv`.
- The setting is not retroactive. It decides only who may create an organization from now on. Existing organizations, their owners and their members stay as they are.

Who may do what as a result is described on the [access page](access.md#organization-creation).

## `TEAM_ANALYTICS_TECHNICAL_ACCOUNTS` is no longer a setting

The [technical accounts list](../GLOSSARY.md#technical-accounts-list) is kept in the CVAT database and edited by an administrator on the Team Analytics page. If the variable is still set to a non-blank value, each backend process with Team Analytics logs one warning at start and ignores the value:

```text
TEAM_ANALYTICS_TECHNICAL_ACCOUNTS is ignored: the Technical accounts list is edited by an administrator in Team Analytics settings (the Settings button of the Team Analytics page)
```

Move the list as described in [Team Analytics: migrating from the variable](team-analytics.md#migrating-from-team_analytics_technical_accounts), then remove the variable.

## Fixed limits that are not settings

These limits are in the code. No environment variable changes them.

| Limit | Value |
| --- | --- |
| Length of the refresh lock (the lease) | 120 s, extended every 40 s while a step runs |
| Time limit of the cutover search before the first answer | 23 s |
| Time limit of the cutover search in the daily check | 60 s |
| Memory limit of the cutover search | 512 MiB |
| Age after which the page warns that the figures are stale | 30 minutes |
| Longest technical accounts list | 1000 accounts |
| Users returned by one user search in the settings | 20 |
| Project ids in one project-names request | 500 |

## See also

- [Team Analytics](team-analytics.md): what the settings govern at run time.
- [Access](access.md): who may use Team Analytics and create organizations.
- [CVAT chart](charts/cvat.md): `cvat.backend.additionalEnv` and the Team Analytics worker values.
