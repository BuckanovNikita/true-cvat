# Enabling Team Analytics

Follow this page on a running install that has [analytics](../../GLOSSARY.md#analytics) switched off, to turn on [Team Analytics](../../GLOSSARY.md#team-analytics): its page, its API and its worker. Team Analytics exists only where analytics is on.

## Before you start

- A running install made as in [First install in a closed network](closed-network-install.md), with `analytics.enabled: false` and `clickhouse.enabled: false` in `values.prod.yaml`.
- The extra stock images in your registry: ClickHouse, Vector and [Grafana](../../GLOSSARY.md#grafana) ([Images a cluster pulls](../requirements.md#images-a-cluster-pulls)), and a mirror that serves the Grafana ClickHouse plugin as a download.
- Room for the ClickHouse volume (`8Gi` by default) and the ClickHouse backup plan in [State and backups](../state.md#clickhouse).
- A decision on who may open Grafana. Read the warning in step 2 first.
- An [administrator](../../GLOSSARY.md#administrator) account to try the page with.

## What the switch brings up

`analytics.enabled: true` ([Analytics](../charts/cvat.md#analytics)) adds to the release:

| Part | Name with release `cvat` | Needs |
| --- | --- | --- |
| ClickHouse | StatefulSet `cvat-clickhouse-shard0` | `clickhouse.enabled: true` |
| Vector | StatefulSet `cvat-vector` | its image |
| Grafana | Deployment `cvat-grafana`, and with `ingress.enabled` the Ingress `cvat-analytics` for `/analytics` | its image, plugin download |
| [Team Analytics worker](../../GLOSSARY.md#team-analytics-worker) | Deployment `cvat-backend-worker-team-analytics` | the [fork server image](../../GLOSSARY.md#fork-server-image) you already run |
| the Secret `cvat-analytics-secret` | holds the ClickHouse credentials | `analytics.clickhousePassword` |

It also sets `CVAT_ANALYTICS=1` and the ClickHouse and Vector variables on every backend pod, so all backend pods restart ([Team Analytics worker](../charts/cvat.md#team-analytics-worker)). The initializer Job of the new revision creates the ClickHouse events database and table and schedules the refresh job.

## Steps

1. **Back up first.** Do the backups of [Before an upgrade](../state.md#before-an-upgrade). The switch restarts every backend pod and runs the initializer again.

2. **Decide the Grafana access.** With analytics on, the chart's Grafana gives the Admin role to everyone who reaches `/analytics`, without sign-in, unless the chart's Traefik checks the request against CVAT. Do at least one of: serve the install through the chart's Traefik (`traefik.enabled: true` with no other `ingress.className`; the Traefik middlewares have no effect under another class such as `nginx`); on another controller, add forward authentication to `analytics.ingress.annotations`; do not expose `/analytics`; restrict the Grafana Service by a network policy. The details, and who can reach Grafana in each install, are in [Grafana when analytics is enabled](../access.md#grafana-when-analytics-is-enabled).

3. **Edit `values.prod.yaml`.** Remove `clickhouse.enabled: false`, and set `analytics.enabled` as below. Add the `analytics`, `clickhouse`, `vector` and `grafana` blocks of the [closed-network example](../charts/cvat.md#closed-network-example), and set:

   | Value | What to set |
   | --- | --- |
   | `analytics.enabled` | `true` |
   | `analytics.clickhousePassword` | A password of your own. The Secret that holds it is immutable: choose it now ([Analytics](../charts/cvat.md#analytics)). |
   | `clickhouse.image.registry`, `vector.image.repository`, `grafana.image.repository`, `grafana.image.tag` | Your registry paths and the Grafana tag. |
   | `grafana.plugins` | The download URL of the plugin on your mirror. |
   | `grafana.testFramework.enabled` | `false` unless you mirror the test image. |
   | `grafana.rbac.namespaced` | `true`, unless the account that runs `helm` may create a ClusterRole and a ClusterRoleBinding. |
   | `grafana.grafana.ini.server.root_url` | `https://cvat.example.com/analytics` |
   | `vector.image.pullSecrets` | `- name: <pull-secret>` (`global.imagePullSecrets` already serves ClickHouse and Grafana). |

   Optional: `cvat.backend.worker.teamAnalytics.replicas`, `numProcs` and `resources` ([Values](../charts/cvat.md#values)); `cvat.backend.additionalEnv` for `TEAM_ANALYTICS_*` settings ([Configuration](../configuration.md)).

   **ClickHouse init secret (optional).** You usually do not need it: the initializer Job creates the same database and table. If you want the ClickHouse subchart to create them on its first start too, set `analytics.clickhouseInit.enabled: true` and `clickhouse.initdbScriptsSecret: cvat-clickhouse-init` ([ClickHouse init secret](../charts/cvat.md#clickhouse-init-secret)).

4. **Render.**

   ```bash
   cd <fork-root>
   helm template cvat ./helm-chart --namespace cvat -f values.prod.yaml > /dev/null
   ```

   Expect no output. An error names the value ([Render failures](../charts/cvat.md#render-failures)). With `imageTagsGuard.components` containing `grafana`, set a matching `grafana.image.tag` or remove the component.

5. **Upgrade.**

   ```bash
   helm upgrade cvat ./helm-chart --namespace cvat -f values.prod.yaml
   ```

   Expect `STATUS: deployed`. Do not add `--reuse-values`: it keeps the values of the last release for every key your file no longer sets, so a removed `clickhouse.enabled: false` would stay.

6. **Wait.** Take the revision from `helm history`.

   ```bash
   helm history cvat --namespace cvat --max 1
   kubectl wait --for=condition=complete job/cvat-backend-initializer-r<revision> --namespace cvat --timeout=30m
   kubectl rollout status deployment/cvat-backend-worker-team-analytics --namespace cvat
   kubectl get pods --namespace cvat
   ```

   Expect `condition met`, `successfully rolled out`, and ClickHouse, Vector, Grafana and the backend pods ready. The initializer waits for ClickHouse, so it can take a few minutes after the ClickHouse pod starts.

## Check the result

1. The worker runs, and its status answers as an administrator:

   ```bash
   kubectl get deployment cvat-backend-worker-team-analytics --namespace cvat
   curl -s -u '<admin>:<password>' https://cvat.example.com/api/team-analytics/status
   ```

   Expect `1/1` ready and a JSON answer with `refresh`, `history` and `cutover` sections. Before the first answer is ready the API replies `429` with `Retry-After`: ask again. Without credentials the address answers `401`, which proves only that Team Analytics is installed ([Health checks and status codes](../team-analytics.md#health-checks-and-status-codes)).
2. After a few minutes the refresh has run: `refresh.stale` is `false` and `refresh.last_success_at` is set. If it stays `true`, check the worker, the utils worker (the scheduler) and ClickHouse ([Failure modes](../team-analytics.md#failure-modes)).
3. The served [policy bundle](../../GLOSSARY.md#policy-bundle) carries the Team Analytics policy. Run it from `<fork-root>`:

   ```bash
   curl -s https://cvat.example.com/api/auth/rules | verify/policy_bundle.sh check-analytics
   ```

   Expect `equal` for three policies.
4. Sign in as an administrator: the header shows «Team Analytics». A user who is not an administrator does not see it ([Access](../access.md#team-analytics)).
5. `https://cvat.example.com/analytics/` does not open Grafana without sign-in, if you chose to close it in step 2.

## Technical accounts

The [technical accounts list](../../GLOSSARY.md#technical-accounts-list) starts empty. Until you fill it, accounts of automated processes count as people. An administrator edits the list in the page's settings window «Настройки» ("Settings"); the steps and limits are in [Technical accounts list](../team-analytics.md#technical-accounts-list). The list applies to past periods too.

If an earlier setup used the variable `TEAM_ANALYTICS_TECHNICAL_ACCOUNTS`, it is ignored. Move its accounts into the list and remove the variable from `values.prod.yaml`: [Migrating from `TEAM_ANALYTICS_TECHNICAL_ACCOUNTS`](../team-analytics.md#migrating-from-team_analytics_technical_accounts).

## History

Recording starts when you enable analytics: the backend sends events to Vector only where the chart sets the Vector address, which it does only with `analytics.enabled`. Work done before has no events, and Team Analytics computes only from events.

After the first start the worker processes the past one day at a time, newest first. The page shows «Обработка истории» ("Processing history") and offers a period only when every day of it is processed ([Processed history and stale data](../team-analytics.md#processed-history-and-stale-data)). Do not treat missing past periods as a fault in the first hours.

## See also

- [Operating Team Analytics](../team-analytics.md)
- [Access](../access.md): Grafana access, administrators only
- [CVAT chart](../charts/cvat.md): `analytics.*` and the worker values
- [Configuration](../configuration.md)
- [State and backups](../state.md)
