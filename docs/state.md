# State and backups

An installed fork keeps its state in the stores below. For each one this page says what creates it, what it holds, what losing it means, and what to back up before an upgrade. The chart values that switch or size each store are owned by [the CVAT chart page](charts/cvat.md).

## Summary

| Store | Created by | Rebuilt after loss | Back up before an upgrade |
| --- | --- | --- | --- |
| [Backend data volume](../GLOSSARY.md#backend-data-volume) | the chart (`<release>-backend-data` PVC) | no | yes |
| Postgres | the Postgres subchart (or your external database) | no | yes |
| ClickHouse [events database](../GLOSSARY.md#events-database) | the initializer job, with [analytics](../GLOSSARY.md#analytics) enabled | no | yes |
| ClickHouse [totals database](../GLOSSARY.md#totals-database) | the [Team Analytics worker](../GLOSSARY.md#team-analytics-worker) | yes, from the events | optional |
| In-memory Redis | the Redis subchart (or your external Redis) | partly | not required |
| kvrocks | the chart (`<release>-kvrocks` StatefulSet) | yes, on demand | not required |
| [Grafana](../GLOSSARY.md#grafana), Vector | the subcharts | nothing to rebuild | no |

`helm uninstall` removes none of the volumes: the backend data claim is kept by its annotation, and the claims of the Postgres, Redis, ClickHouse and kvrocks StatefulSets come from volume claim templates, which Helm does not delete. Remove them yourself when you really remove an install.

## Backend data volume

- **Created by:** the chart, as the PVC `<release>-backend-data` (`ReadWriteMany` unless you set access modes, `20Gi` by default) while `cvat.backend.defaultStorage.enabled` is on. The PVC carries `helm.sh/resource-policy: keep`, so `helm uninstall` leaves it in place. With the value off the chart creates no PVC and declares no `cvat-backend-data` volume, yet the server and worker templates still mount a volume of that name: supply it through the `additionalVolumes` values.
- **Mounted by:** the backend server and the annotation, import, export, utils and Team Analytics workers, under `/home/django` with these subpaths. The chunks worker mounts `data` and `logs` only. The initializer job and the consensus, quality reports and webhooks workers mount nothing from it unless you add mounts.

  | Subpath | Mount path | Holds |
  | --- | --- | --- |
  | `data` | `/home/django/data` | uploaded media, task, job, project and asset files, export caches, cloud storage files, temporary files |
  | `keys` | `/home/django/keys` | `secret_key.py`, the Django secret key the server generates on first start when the environment variable `DJANGO_SECRET_KEY` is not set |
  | `logs` | `/home/django/logs` | the rotated log file `cvat_server_dataset.log` and the `migrations` directory that some data migrations write their logs to |

- **Losing it:** media and uploaded files are gone and are not rebuilt; tasks in Postgres then point at missing files. A lost `keys/secret_key.py` is generated again on the next start, with a new key (unless `DJANGO_SECRET_KEY` is set, in which case the file is not used).
- **Back up:** the whole volume.

## Postgres

- **Created by:** the Bitnami Postgres subchart (StatefulSet `<release>-postgresql`, a `8Gi` claim by default) while `postgresql.enabled` is on; otherwise your external database. The schema is created and upgraded by `django-admin migrate`, which the initializer job runs (`backend_entrypoint.sh init`). The chart names that Job `<release>-backend-initializer-r<revision>` and renders it without a Helm hook, so each release revision gets its own (install and upgrade; a rollback brings back the Job of the revision it returns to) and it starts together with the other manifests, not before them.
- **Holds:** every CVAT object (users, organizations, projects, tasks, jobs, annotations, permissions), and the fork's table of the [technical accounts list](../GLOSSARY.md#technical-accounts-list) (model `TechnicalAccount` of the `team_analytics` app: user id, last known user name, update time). That table is created only where analytics is enabled, because the `team_analytics` app is installed only then; it stays if you later switch analytics off. The list starts empty and is edited by an [administrator](../GLOSSARY.md#administrator) on the Team Analytics page ([Team Analytics](team-analytics.md)).
- **Losing it:** CVAT loses all its data. Nothing rebuilds it.
- **Back up:** a full database dump before every upgrade.

## ClickHouse

The bundled ClickHouse is the Bitnami subchart (StatefulSet `<release>-clickhouse-shard0`, a `8Gi` claim by default), on while `clickhouse.enabled` is on. Note that `clickhouse.enabled` is its own switch: with `analytics.enabled: false` the chart still renders ClickHouse unless you switch it off too. It holds two databases.

### Events database

- **Created by:** the initializer job, with analytics enabled: `backend_entrypoint.sh init` runs `components/analytics/clickhouse/init.py`, which creates the database named by `analytics.clickhouseDb` (default `cvat`) and its `events` table, and on every run applies the table's migrations in order (they add columns with `IF NOT EXISTS`). With `analytics.clickhouseInit.enabled` the chart also renders the ClickHouse init script as a secret for the subchart's first start.
- **Holds:** the events Vector writes for the server and the UI: the raw activity records every Team Analytics figure and every Grafana dashboard is computed from.
- **Losing it:** the history is gone. Team Analytics can recompute its totals only from events that still exist.
- **Back up:** yes, before every upgrade.

### Totals database

- **Created by:** the Team Analytics worker. Every run of the periodic refresh (scheduled every minute) runs `CREATE DATABASE IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` for each file of the schema, so a removed database comes back on the next run.
- **Name:** the backend setting `TEAM_ANALYTICS_DB`, default `team_analytics` ([configuration](configuration.md)).
- **Holds:** stored totals per hour (working time, sessions, operations, keyboard and mouse use, saved and detector-made objects), the hour versions of each refresh, the refresh runs, the [processed history](../GLOSSARY.md#processed-history) by day, and the [cutover](../GLOSSARY.md#cutover) hour. `refresh_runs`, `history_checks` and `history_today` rows expire after 30 days (ClickHouse TTL).
- **Losing it:** the worker recreates the empty schema, the refresh fills the recent hours again, and the history step recomputes past days from the events database. Until a day is recomputed, the page shows it as not processed. The recomputation needs the events to still exist.
- **Back up:** optional. It is derived data; backing it up only shortens the recomputation.

Changing `TEAM_ANALYTICS_DB` on a running install has the same effect as losing the database: the worker starts a new, empty one under the new name.

## In-memory Redis

- **Created by:** the Bitnami Redis subchart (StatefulSet `<release>-redis-master`, standalone) while `redis.enabled` is on; otherwise your external Redis. Despite its role it is persisted by default: the rendered configuration has `appendonly yes`, and the StatefulSet has an `8Gi` claim.
- **Holds:**
  - database 0: the RQ queues of every worker, including the fork's `team_analytics` queue, and the periodic job schedule. The schedule includes the Team Analytics refresh (`team_analytics_refresh`, every minute) where analytics is enabled; `django-admin syncperiodicjobs` in the initializer job writes it, and removes the refresh where analytics is switched off. The Team Analytics refresh lock (`team_analytics:refresh`) lives here too.
  - database 1: the Django cache. Team Analytics keeps here its computed answers (`team_analytics:answer:*`, kept for `TEAM_ANALYTICS_ANSWER_TTL_S`), the answer generation counter (`team_analytics:generation`) and the mark that the cutover search has run (`team_analytics:ready`, no expiry).
- **Losing it:** queued and running background jobs (imports, exports, annotation jobs, Team Analytics reads) are lost and must be started again. The periodic schedule is written again by the next initializer run (`helm upgrade`). The Team Analytics cache is refilled on demand; with `team_analytics:ready` gone, the worker searches for the cutover once more before its next answer.
- **Back up:** not required for data safety. Wait for running imports and exports to finish before an upgrade.

## kvrocks

- **Created by:** the chart, as the StatefulSet `<release>-kvrocks` with the claim `<release>-kvrocks-data` (`100Gi` by default, mounted at `/var/lib/kvrocks/db`) while `cvat.kvrocks.defaultStorage.enabled` is on. Its tier label is set by `cvat.kvrocks.defaultStorage.pvcTierLabel` (empty keeps `kvrocks`).
- **Holds:** the media cache of the backend (Django cache `media`): prepared data chunks (kept one day) and preview images (kept seven days).
- **Losing it:** the backend prepares chunks and previews again from the data volume when they are next requested. The first opening of a job is slower until then.
- **Back up:** not required.

## Grafana and Vector

With analytics enabled, Grafana keeps `/var/lib/grafana` on an `emptyDir`, and its data source and dashboards are provisioned from the chart on every start. Vector keeps its data directory `/vector-data-dir` on an `emptyDir`. Neither has state to back up; a change made in the Grafana UI is lost when its pod restarts.

## Before an upgrade

1. Back up the backend data volume.
2. Dump Postgres.
3. With analytics enabled, back up the ClickHouse events database (the database named by `analytics.clickhouseDb`).
4. Let running imports and exports finish.

The procedure itself: [upgrade and rollback](scenarios/upgrade-and-rollback.md).

## What a rollback does not undo

`helm rollback` restores the previous release's manifests and images. It does not touch data:

- Database migrations that the newer release applied with `django-admin migrate` stay applied. A rollback also brings back the initializer Job of the revision it returns to, which runs the older image's `init`; it applies what that image knows and reverts nothing. An older server image may then run against a newer schema. To return to the old schema, restore the Postgres dump taken before the upgrade.
- Redis migrations applied by `django-admin migrateredis` (same `init` step) are not reverted either.
- Columns the `events` migrations added to the ClickHouse events table stay, and so do the tables the Team Analytics worker created in ClickHouse.
- PVCs and their contents stay as they are.

## See also

- [CVAT chart](charts/cvat.md)
- [Configuration](configuration.md)
- [Team Analytics](team-analytics.md)
- [Upgrade and rollback](scenarios/upgrade-and-rollback.md)
- [Requirements](requirements.md)
