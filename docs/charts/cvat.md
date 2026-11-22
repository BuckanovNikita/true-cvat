# CVAT chart

`helm-chart/` in the [fork tree](../../GLOSSARY.md#fork-tree) installs CVAT with the fork's additions. This page lists every value the fork added or changed, the [Team Analytics worker](../../GLOSSARY.md#team-analytics-worker) values, the render failures the fork added, and the stock values a production install cannot avoid. For every other value, see upstream's [Helm guide](https://docs.cvat.ai/docs/administration/advanced/k8s_deployment_with_helm/).

## Installing

Install the chart straight from the fork tree. You do not need a chart repository and you do not run `helm dependency update`. The subcharts (PostgreSQL, Redis, ClickHouse, Vector, [Grafana](../../GLOSSARY.md#grafana), Traefik) are committed archives under `helm-chart/charts/`, pinned by `helm-chart/Chart.lock`. nuclio is not a dependency of this chart. It is a separate release, see [nuclio chart](nuclio.md).

```bash
cd <fork-root>
helm lint ./helm-chart -f values.prod.yaml
helm template cvat ./helm-chart --namespace cvat -f values.prod.yaml > /dev/null
helm upgrade --install cvat ./helm-chart --namespace cvat --create-namespace -f values.prod.yaml
```

Render with `helm template` first. The fork's guards fail at render time, before anything reaches the cluster (see [Render failures](#render-failures)).

## Values the fork adds or changes

### Backend user

| Value | Default | Effect |
| --- | --- | --- |
| `cvat.backend.runAsUser` | `""` | When set, becomes `runAsUser` of both containers of the backend server Deployment and of the initializer Job. Empty: the containers keep the image's user, and only `runAsNonRoot: true` applies. The worker Deployments, the Team Analytics worker included, never get it. |
| `cvat.backend.runAsGroup` | `""` | The same for `runAsGroup`. |

Set both when a shared backend data volume is written by another uid.

### Permission fix init container

`cvat.backend.permissionFix` is stock. The fork changes how its command is built (`helm-chart/templates/_helpers.tpl`, `cvat.backend.initContainers`). The init container runs in the server Deployment and in the annotation, export, import, utils and Team Analytics worker Deployments.

| Value | Default | Effect |
| --- | --- | --- |
| `cvat.backend.permissionFix.enabled` | `true` | Renders the `user-data-permission-fix` init container. |
| `cvat.backend.permissionFix.paths` | `["/home/django"]` | Without `commandOverride`, the command is `["/bin/chmod", "-R", "777", <paths...>]`, run directly with no shell. |
| `cvat.backend.permissionFix.commandOverride` | unset | Replaces the whole `command`. Give the program as the first element, for example `["/bin/chmod", "-R", "777", "/home/django"]`. |
| `cvat.backend.permissionFix.image` | `busybox` | Image of the init container. The default `chmod` command needs `/bin/chmod` in it. |
| `cvat.backend.permissionFix.tag` | `1.36.1` | Tag of that image. |

Upstream ran `/bin/sh -c` with `commandOverride` as its arguments. A values file written for that form, such as `commandOverride: ["chmod -R 777 /x"]`, now becomes a command named `chmod -R 777 /x`. Rewrite it as a list whose first element is the program.

With `enabled: true` and neither `paths` nor `commandOverride`, the render fails (see [Render failures](#render-failures)).

### Policy engine service name

| Value | Default | Effect |
| --- | --- | --- |
| `cvat.opa.serviceName` | `"{{ .Release.Name }}-opa-service"` | Name of the OPA Service (`templates/cvat_opa/service.yml`), rendered through `tpl`. The backend's `CVAT_OPA_URL` is built from the same value: `http://<serviceName>:8181`. Set `opa` where a deployment expects the bare name. |

The OPA pod loads the [policy bundle](../../GLOSSARY.md#policy-bundle) from the backend. A running server caches the bundle, so after a policy change you rebuild the [fork server image](../../GLOSSARY.md#fork-server-image) and restart the backend.

### kvrocks volume label

| Value | Default | Effect |
| --- | --- | --- |
| `cvat.kvrocks.defaultStorage.pvcTierLabel` | `""` | Value of the `tier` label on the kvrocks data PVC template (`templates/cvat_kvrocks/statefulset.yml`). Empty keeps `kvrocks`. The pod and Service labels stay `tier: kvrocks`. |

### nuclio host

| Value | Default | Effect |
| --- | --- | --- |
| `nuclio.dashboard.host` | `"{{ .Release.Name }}-nuclio-dashboard"` | Rendered through `tpl` into `CVAT_NUCLIO_HOST` on every backend pod, only when `nuclio.enabled` is true. Set it to the Service name the nuclio release creates. |
| `nuclio.enabled` | `false` | Stock. Adds three variables to the backend pods: `CVAT_SERVERLESS=1`, `CVAT_NUCLIO_HOST` from `nuclio.dashboard.host`, and `CVAT_NUCLIO_FUNCTION_NAMESPACE` set to the release namespace. It installs nothing: the fork removed nuclio as a dependency. |

The defaults do not match a nuclio release named `nuclio`: that release creates the Service `nuclio-dashboard`, while the default host resolves to `cvat-nuclio-dashboard`. See [nuclio chart](nuclio.md#what-must-agree-with-the-cvat-chart).

### ClickHouse init secret

| Value | Default | Effect |
| --- | --- | --- |
| `analytics.clickhouseInit.enabled` | `false` | With `analytics.enabled`, renders a Secret holding `helm-chart/analytics/clickhouse/init.sh`, which creates the ClickHouse database and the `events` table. |
| `analytics.clickhouseInit.secretName` | `cvat-clickhouse-init` | Name of that Secret. |

The Secret does nothing on its own. Point the ClickHouse subchart at it, and it runs on the first start of an empty database:

```yaml
analytics:
  clickhouseInit:
    enabled: true
clickhouse:
  initdbScriptsSecret: cvat-clickhouse-init
```

You usually do not need it. With `analytics.enabled`, the backend initializer Job creates the same database and table and applies the later column additions (`access_token_id`, `remote_addr`) that `init.sh` lacks.

### Ingress redirects

| Value | Default | Effect |
| --- | --- | --- |
| `ingress.redirectPaths` | `[]` | With `ingress.enabled`, renders one extra Ingress `<fullname>-redirect` with one `Prefix` rule per path on `ingress.hostname`. Its annotations are `nginx.ingress.kubernetes.io/permanent-redirect: "https://<ingress.hostname>"` and `nginx.ingress.kubernetes.io/permanent-redirect-code`. Empty renders nothing. |
| `ingress.redirectCode` | `308` | Value of the redirect-code annotation. |

Only the annotations are rendered. The redirect happens only with a controller that honours `nginx.ingress.kubernetes.io/*` annotations, such as ingress-nginx. The redirect Ingress takes `ingress.className` (or Traefik's class) and the TLS block from `ingress.tls`, but not `ingress.annotations`.

```yaml
ingress:
  redirectPaths:
    - /api/auth/register
```

### Ingress TLS secret

| Value | Default | Effect |
| --- | --- | --- |
| `ingress.tlsSecret.create` | `false` | With `ingress.enabled`, renders a `kubernetes.io/tls` Secret named `ingress.tlsSecretName` from `tlscrt` and `tlskey`. |
| `tlscrt` | unset | Top-level value: the PEM certificate (chain). Required when the Secret is created. |
| `tlskey` | unset | Top-level value: the PEM private key. Required when the Secret is created. |

`tlscrt` and `tlskey` sit at the top level of the values, not under `ingress`. Keep them in a separate encrypted values file. The Ingresses only use the Secret when `ingress.tls` is `true`.

### Image tags guard

`templates/image-tags-guard.yml` renders no resource. When on, it fails the render unless each listed component has an image and a tag that matches the pattern.

| Value | Default | Effect |
| --- | --- | --- |
| `imageTagsGuard.enabled` | `false` | Switches the guard on. |
| `imageTagsGuard.tagPattern` | `"^[0-9A-Za-z_.-]+-[0-9a-f]{8}$"` | Regular expression a guarded tag must match: by default it ends in `-` and eight hex digits, such as `v2.82.0-fork-0a1b2c3d`. |
| `imageTagsGuard.components` | `[backend, frontend, grafana]` | Components to check, in list order: the first failing one stops the render. Known names and the values they read: `backend` (`cvat.backend.image`, `cvat.backend.tag`), `frontend` (`cvat.frontend.image`, `cvat.frontend.tag`), `grafana` (`grafana.image.repository`, `grafana.image.tag`), `opa` (`cvat.opa.image`, `cvat.opa.tag`), `kvrocks` (`cvat.kvrocks.image`, `cvat.kvrocks.tag`). |

The guard reads `grafana.image.repository` and `grafana.image.tag` as the chart sees them. The Grafana subchart supplies the repository (`docker.io/grafana/grafana`) and an empty tag, so with the default list the guard fails on the `grafana` tag until you set `grafana.image.tag` to a value that matches the pattern. With analytics off the chart no longer carries the Grafana subchart's values, so the guard stops one check earlier, with `the grafana image reference is not set`; a tag alone does not help there, only `grafana.image.repository` together with a matching tag, or removing `grafana` from the list. Upstream Grafana tags do not end in a commit, so remove `grafana` from the list in most installs:

```yaml
imageTagsGuard:
  enabled: true
  components:
    - backend
    - frontend
```

### Changes with no new value

| What | Before (upstream) | Now |
| --- | --- | --- |
| Vector port the backend sends to | `DJANGO_LOG_SERVER_PORT` fixed at `8282` | The `port` of the first entry of `vector.service.ports`, `8282` when the list is empty. Vector itself listens on `8282` (`helm-chart/analytics/vector/vector.toml`), and the Vector Service sets no `targetPort`, so a port other than `8282` sends the logs to a port nobody listens on. Keep `8282`. |
| Backend Service selector | `app`, `tier`, `component` plus all chart labels, including `helm.sh/chart` and `app.kubernetes.io/version` | `app`, `tier`, `component` plus only `app.kubernetes.io/name` and `app.kubernetes.io/instance`. |
| Permission fix command | `/bin/sh -c` with arguments | A direct command, see [Permission fix init container](#permission-fix-init-container). |
| nuclio | A chart dependency, installed with `nuclio.enabled` | Not a dependency. See [nuclio chart](nuclio.md). |
| Analytics files | `helm-chart/analytics` was a link into the source tree | Real files under `helm-chart/analytics/` (Vector config, Grafana dashboards, `clickhouse/init.sh`), so the chart directory works on its own. |

## Team Analytics worker

`templates/cvat_backend/worker_team_analytics/deployment.yml` renders the Deployment `<release>-backend-worker-team-analytics` only when `analytics.enabled` is true. Without [analytics](../../GLOSSARY.md#analytics), [Team Analytics](../../GLOSSARY.md#team-analytics) does not exist and the Deployment is not rendered. What the worker does is on [Team Analytics](../team-analytics.md).

The Deployment runs the fork server image (`cvat.backend.image`, `cvat.backend.tag`, `cvat.backend.imagePullPolicy`) with the arguments `run worker team_analytics`, strategy `Recreate`, and the [backend data volume](../../GLOSSARY.md#backend-data-volume) at `/home/django/data`, `/home/django/keys` and `/home/django/logs`. It gets the permission fix init container and `imagePullSecrets`.

### Values

The values below are not in `values.yaml`. They exist only as defaults inside the template. `helm show values` does not list them. Set them in your values file:

```yaml
cvat:
  backend:
    worker:
      teamAnalytics:
        replicas: 1
        numProcs: 3
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
```

| Value | Default | Effect |
| --- | --- | --- |
| `cvat.backend.worker.teamAnalytics.replicas` | `1` | Replicas of the Deployment. `0` is kept as `0`: the Deployment stays and runs no pod. |
| `cvat.backend.worker.teamAnalytics.numProcs` | `3` | Becomes the `NUMPROCS` variable (worker processes per pod) and the `--expected-num-workers` argument of the liveness probe. `0` falls back to `3`. |
| `cvat.backend.worker.teamAnalytics.labels` | `{}` | Merged with `cvat.backend.labels` onto the Deployment and the pods. On a conflict the worker value wins. |
| `cvat.backend.worker.teamAnalytics.annotations` | `{}` | Merged with `cvat.backend.annotations` the same way. |
| `cvat.backend.worker.teamAnalytics.resources` | `{}` | Merged with `cvat.backend.resources` into the container's `resources`. |
| `cvat.backend.worker.teamAnalytics.affinity` | `{}` | Merged with `cvat.backend.affinity`. |
| `cvat.backend.worker.teamAnalytics.tolerations` | `[]` | Appended to `cvat.backend.tolerations`. |
| `cvat.backend.worker.teamAnalytics.additionalEnv` | `[]` | Appended to `cvat.backend.additionalEnv`, see below. |
| `cvat.backend.worker.teamAnalytics.additionalVolumes` | `[]` | Appended to `cvat.backend.additionalVolumes`. |
| `cvat.backend.worker.teamAnalytics.additionalVolumeMounts` | `[]` | Appended to `cvat.backend.additionalVolumeMounts`. |

`replicas: 0` stops the Team Analytics worker without touching the rest of CVAT. The Team Analytics API then queues work that nobody picks up; see [Team Analytics](../team-analytics.md) for what the page shows.

### Environment

The container's `env` is assembled in this order:

1. The shared backend environment every backend pod gets: Redis, kvrocks, PostgreSQL, `CVAT_OPA_URL`, the analytics variables (`CVAT_ANALYTICS`, `CLICKHOUSE_*` from the Secret `cvat-analytics-secret`), `SMOKESCREEN_OPTS`, the nuclio variables when `nuclio.enabled`.
2. `cvat.backend.additionalEnv`, then `cvat.backend.worker.teamAnalytics.additionalEnv`.
3. `NUMPROCS` from `numProcs`.

So a fork setting such as `TEAM_ANALYTICS_*` set in `cvat.backend.additionalEnv` reaches the server, every worker and the Team Analytics worker. Set it in the worker's own `additionalEnv` to reach only the worker. The settings themselves are on [Configuration](../configuration.md).

### Liveness probe

With `cvat.backend.worker.livenessProbe.enabled` (stock, default `true`), the container gets an exec probe `django-admin workerprobe team_analytics --expected-num-workers <numProcs>`. Its timing comes from the stock `cvat.backend.worker.livenessProbe` (`periodSeconds: 120`, `initialDelaySeconds: 30`, `timeoutSeconds: 10`), shared with the other workers.

## Values an install cannot avoid

These are stock values. They are listed here because a production install, and a closed network in particular, has to set them.

### Images

| Value | Default | Notes |
| --- | --- | --- |
| `cvat.backend.image` | `cvat/server` | The fork server image, used by the server, every worker and the initializer. |
| `cvat.backend.tag` | `v2.82.0` | Set the tag your build published. |
| `cvat.frontend.image` | `cvat/ui` | The [UI image](../../GLOSSARY.md#ui-image). |
| `cvat.frontend.tag` | `v2.82.0` | |
| `cvat.opa.image` | `openpolicyagent/opa` | |
| `cvat.opa.tag` | `1.12.2` | |
| `cvat.kvrocks.image` | `apache/kvrocks` | |
| `cvat.kvrocks.tag` | `2.15.0` | |
| `cvat.backend.permissionFix.image` | `busybox` | See [Permission fix init container](#permission-fix-init-container). |
| `postgresql.image.registry` | `docker.io` | Rendered image: `docker.io/cvat/postgresql:15.2.0-debian-11-r0`. |
| `redis.image.registry` | `docker.io` | Rendered image: `docker.io/library/redis:7.2.11`. |
| `clickhouse.image.registry` | `docker.io` | Rendered image: `docker.io/cvat/clickhouse:23.12.2-debian-11-r0`. |
| `vector.image.repository` | `timberio/vector` (subchart) | Tag `0.26.0-alpine` from `vector.image.tag`. |
| `grafana.image.repository` | `docker.io/grafana/grafana` (subchart) | The tag defaults to the subchart's app version (`10.1.5`). |
| `grafana.plugins` | `["grafana-clickhouse-datasource 4.8.2"]` | Grafana downloads each plugin when its pod starts (`GF_INSTALL_PLUGINS`). In a closed network give a download URL instead: `https://mirror.example.com/grafana/grafana-clickhouse-datasource-4.8.2.zip;grafana-clickhouse-datasource`. |
| `grafana.rbac.namespaced` | `false` (subchart) | With the default, the Grafana subchart renders a ClusterRole and a ClusterRoleBinding, `<release>-grafana-clusterrole` and `<release>-grafana-clusterrolebinding`. The account that runs `helm` needs rights to create them, and two releases of the same name in different namespaces collide on them. Set `true` to get a Role and a RoleBinding in the release namespace instead. With `traefik.enabled: true` the Traefik subchart adds a ClusterRole and a ClusterRoleBinding of its own (`traefik.rbac.namespaced: true` turns them into a Role and a RoleBinding) and brings cluster-scoped CustomResourceDefinitions. |
| `grafana.testFramework.enabled` | `true` (subchart) | Renders a `helm test` pod with `docker.io/bats/bats:v1.4.1`. Set `false` if you do not mirror it. |

### Pull secrets

| Value | Default | Notes |
| --- | --- | --- |
| `imagePullSecrets` | `[]` | Applies to the chart's own pods: server, workers, Team Analytics worker, initializer, UI, OPA, kvrocks. Each entry is `{name: <secret>}`. |
| `global.imagePullSecrets` | unset | Read by the PostgreSQL, Redis, ClickHouse and Grafana subcharts. Each entry is a secret name. |
| `vector.image.pullSecrets` | unset (subchart) | Vector reads only its own value. Each entry is `{name: <secret>}`. |

### Ingress and TLS

| Value | Default | Notes |
| --- | --- | --- |
| `ingress.enabled` | `false` | Renders the CVAT Ingress and, with analytics, the `/analytics` Ingress to Grafana. |
| `ingress.hostname` | `cvat.local` | Host of every Ingress the chart renders. |
| `ingress.className` | `""` | `ingressClassName` of every Ingress. |
| `ingress.annotations` | `{}` | Added to the CVAT and `/analytics` Ingresses. |
| `ingress.tls` | `false` | Adds a TLS block with `ingress.tlsSecretName`. |
| `ingress.tlsSecretName` | `ingress-tls-cvat` | The Secret the TLS block names. Create it yourself or with [`ingress.tlsSecret.create`](#ingress-tls-secret). |
| `grafana.grafana.ini.server.root_url` | `https://cvat.local/analytics` | Set it to `https://cvat.example.com/analytics`. |

With analytics enabled, the chart's Grafana settings (`grafana.grafana.ini`: `auth.anonymous` enabled, role `Admin`, login form disabled) give every request that reaches Grafana the Admin role without signing in. The `/analytics` Ingress adds no authentication of its own except Traefik's middlewares when `traefik.enabled` is true; the same middlewares strip the `/analytics` prefix, so under another ingress controller Grafana does not work at `/analytics` until you add a rewrite. Who can open it, and how to close it, is on [Access](../access.md).

In a values file the Grafana settings sit under `grafana:` then `grafana.ini:` (the key itself contains a dot, as in the closed-network example below). With `--set`, escape it: `--set 'grafana.grafana\.ini.server.root_url=https://cvat.example.com/analytics'`.

### Storage

| Value | Default | Notes |
| --- | --- | --- |
| `cvat.backend.defaultStorage.enabled` | `true` | Renders the PVC `<release>-backend-data` with `helm.sh/resource-policy: keep`, so `helm uninstall` leaves it. |
| `cvat.backend.defaultStorage.size` | `20Gi` | |
| `cvat.backend.defaultStorage.accessModes` | `[ReadWriteMany]` when unset | The server and the workers mount it at once, so the volume must allow that. |
| `cvat.backend.defaultStorage.storageClassName` | unset | |
| `cvat.kvrocks.defaultStorage.enabled` | `true` | Volume claim template of the kvrocks StatefulSet. |
| `cvat.kvrocks.defaultStorage.size` | `100Gi` | |
| `cvat.kvrocks.defaultStorage.storageClassName` | unset | Access mode `ReadWriteOnce` when unset. |
| `postgresql.primary.persistence.size` | `8Gi` (subchart) | |
| `redis.master.persistence.size` | `8Gi` (subchart) | |
| `clickhouse.persistence.size` | `8Gi` (subchart) | |
| `global.storageClass` | `""` (subchart) | Storage class for the PostgreSQL, Redis and ClickHouse volumes. |

What each store holds and what to back up is on [State](../state.md).

### Analytics

| Value | Default | Notes |
| --- | --- | --- |
| `analytics.enabled` | `true` | Renders the Secret `cvat-analytics-secret`, the Vector and Grafana subcharts, the `/analytics` Ingress, the Team Analytics worker, and sets `CVAT_ANALYTICS=1` and `CLICKHOUSE_*` on every backend pod. |
| `clickhouse.enabled` | `true` | The ClickHouse subchart. Separate from `analytics.enabled`. |
| `analytics.clickhouseDb` | `cvat` | |
| `analytics.clickhouseUser` | `user` | Must equal `clickhouse.auth.username`. |
| `analytics.clickhousePassword` | `user` | The ClickHouse password every backend pod, Vector, Grafana and the ClickHouse subchart read from `cvat-analytics-secret`. Replace it. |
| `analytics.clickhouseHost` | `"{{ .Release.Name }}-clickhouse"` | Set it to an external ClickHouse host. |
| `analytics.clickhousePort` | `8123` | |
| `clickhouse.auth.username` | `user` | User the ClickHouse subchart creates. |

`cvat-analytics-secret` is rendered with `immutable: true`. Choose the ClickHouse credentials before the first install.

Turning analytics off takes both `analytics.enabled: false` and `clickhouse.enabled: false`: with only the first, the ClickHouse StatefulSet still renders and refers to `cvat-analytics-secret`, which is no longer rendered. With Helm 3.16 and the bundled PostgreSQL and Redis both on, `clickhouse.enabled: false` fails the render inside the Redis subchart:

```text
Error: template: cvat/charts/redis/templates/master/serviceaccount.yaml:13:14: ... nil pointer evaluating interface {}.Name
```

The same values render once PostgreSQL or Redis is external (`postgresql.enabled: false` or `redis.enabled: false`).

### Default credentials

Replace every one of these in `values.prod.yaml`. [Access](../access.md) owns how to replace them.

| Value | Default |
| --- | --- |
| `postgresql.secret.password` | `cvat_postgresql` |
| `postgresql.secret.postgres_password` | `cvat_postgresql_postgres` |
| `postgresql.secret.replication_password` | `cvat_postgresql_replica` |
| `redis.secret.password` | `cvat_redis` |
| `cvat.kvrocks.secret.password` | `cvat_kvrocks` |
| `analytics.clickhousePassword` | `user` |

### Backend environment

| Value | Default | Notes |
| --- | --- | --- |
| `cvat.backend.additionalEnv` | `[]` | Kubernetes `env` entries added to the server, every worker, the Team Analytics worker and the initializer. This is how you set the fork's backend settings (see [Configuration](../configuration.md)). |
| `smokescreen.opts` | `''` | Becomes `SMOKESCREEN_OPTS` on every backend pod: extra command-line options of the smokescreen proxy that backend processes start on `127.0.0.1`, through which the backend fetches URLs that users supply (for example `--allow-address=<ip>` for an internal host). |

### External PostgreSQL, Redis and kvrocks

| Value | Default | Notes |
| --- | --- | --- |
| `postgresql.enabled` | `true` | `false`: no PostgreSQL subchart. |
| `postgresql.external.host` | `""` | With `postgresql.enabled: false`, becomes `CVAT_POSTGRES_HOST`. |
| `postgresql.external.port` | `""` | With `postgresql.enabled: false`, becomes `CVAT_POSTGRES_PORT`. |
| `postgresql.secret.create` | `true` | The chart renders `postgresql.secret.name` with `username`, `database` and `password`. The backend reads its PostgreSQL user, database and password from that Secret, also for an external database. |
| `redis.enabled` | `true` | `false`: no Redis subchart. |
| `redis.external.host` | `127.0.0.1` | With `redis.enabled: false`, becomes `CVAT_REDIS_INMEM_HOST`. The port is always `6379`. |
| `redis.secret.create` | `true` | The backend reads the Redis password from `redis.secret.name`, key `password`. |
| `cvat.kvrocks.enabled` | `true` | `false`: no kvrocks StatefulSet and no kvrocks Secret. |
| `cvat.kvrocks.external.host` | `kvrocks-external.localdomain` | With `cvat.kvrocks.enabled: false`, becomes `CVAT_REDIS_ONDISK_HOST`. The port is always `6666`. |
| `cvat.kvrocks.secret.name` | `"{{ .Release.Name }}-kvrocks-secret"` | The backend reads the kvrocks password from this Secret, key `password`. With `cvat.kvrocks.enabled: false` the chart does not create it, so create it yourself. |

## Render failures

Each message below is one the fork added. `helm template` and `helm upgrade` stop with `Error: execution error at (<template>:<line>:<col>): <message>`. Nothing reaches the cluster.

| Message | Cause | Fix |
| --- | --- | --- |
| `imageTagsGuard.tagPattern must be set when the guard is on` | `imageTagsGuard.enabled: true` with an empty `imageTagsGuard.tagPattern`. | Set the pattern or keep the default. |
| `imageTagsGuard.components names an unknown component "<name>"; known: backend, frontend, grafana, opa, kvrocks` | A name in `imageTagsGuard.components` is not one of the five. | Use only the known names. |
| `the <component> image reference is not set, and imageTagsGuard.enabled requires it` | The component's image value is empty. With analytics off and `grafana` in the list (the default), this is what `grafana` fails with: the Grafana subchart's image values are absent. With analytics on, `grafana` fails on its empty tag instead (see the next row). | Set the image, or remove the component from `imageTagsGuard.components`. |
| `the <component> image tag "<tag>" is not immutable (expected <pattern>); build it or pass the tag the build published` | The tag does not match `imageTagsGuard.tagPattern`. With chart defaults: `the backend image tag "v2.82.0" is not immutable`. With analytics on and no `grafana.image.tag`: `the grafana image tag "" is not immutable`. | Pass the tag your build published, such as `v2.82.0-fork-0a1b2c3d`, or remove the component from the list. |
| `cvat.backend.permissionFix is enabled but sets neither paths nor commandOverride, so it would run chmod with no operand` | `cvat.backend.permissionFix.enabled: true` with empty `paths` and no `commandOverride`. | Set `paths`, set `commandOverride`, or set `enabled: false`. |
| `ingress.tlsSecretName must name the secret to create` | `ingress.tlsSecret.create: true` with an empty `ingress.tlsSecretName`. | Name the Secret. |
| `ingress.tlsSecret.create needs the certificate in the top-level tlscrt value` | `ingress.tlsSecret.create: true` without `tlscrt`. | Pass `tlscrt`, usually from a separate secrets values file. |
| `ingress.tlsSecret.create needs the key in the top-level tlskey value` | `ingress.tlsSecret.create: true` without `tlskey`. | Pass `tlskey`. |

Reproduce one, for example:

```bash
helm template cvat ./helm-chart --namespace cvat --set imageTagsGuard.enabled=true
```

## Closed-network example

A minimal `values.prod.yaml` for a closed network, with every image from `registry.example.com`. `<pull-secret>` is a `docker-registry` Secret you create in the `cvat` namespace, `<storage-class>` a class that supports `ReadWriteMany`. Keep `tlscrt`, `tlskey` and the passwords in a separate encrypted file if your tooling has one.

```yaml
imagePullSecrets:
  - name: <pull-secret>

global:
  imagePullSecrets:
    - <pull-secret>

cvat:
  backend:
    image: registry.example.com/cvat/server
    tag: v2.82.0-fork-0a1b2c3d
    permissionFix:
      image: registry.example.com/library/busybox
    defaultStorage:
      storageClassName: <storage-class>
      size: 100Gi
  frontend:
    image: registry.example.com/cvat/ui
    tag: v2.82.0-fork-0a1b2c3d
  opa:
    image: registry.example.com/openpolicyagent/opa
  kvrocks:
    image: registry.example.com/apache/kvrocks
    secret:
      password: <password>

postgresql:
  image:
    registry: registry.example.com
  secret:
    password: <password>
    postgres_password: <password>
    replication_password: <password>

redis:
  image:
    registry: registry.example.com
  secret:
    password: <password>

analytics:
  enabled: true
  clickhousePassword: <password>

clickhouse:
  image:
    registry: registry.example.com

vector:
  image:
    repository: registry.example.com/timberio/vector
    pullSecrets:
      - name: <pull-secret>

grafana:
  image:
    repository: registry.example.com/grafana/grafana
    tag: 10.1.5
  plugins:
    - https://mirror.example.com/grafana/grafana-clickhouse-datasource-4.8.2.zip;grafana-clickhouse-datasource
  rbac:
    namespaced: true
  testFramework:
    enabled: false
  grafana.ini:
    server:
      root_url: https://cvat.example.com/analytics

ingress:
  enabled: true
  hostname: cvat.example.com
  className: nginx
  tls: true
  tlsSecret:
    create: true

tlscrt: <certificate>
tlskey: <key>

imageTagsGuard:
  enabled: true
  components:
    - backend
    - frontend
```

This example enables analytics and sets `ingress.className: nginx`, so `/analytics` is served without authentication; close it before you expose the host (see [Access](../access.md)).

The registry paths under `registry.example.com` are where you mirror the stock images; keep the default tags or pass your mirrored ones. On the public network, drop the `registry` and `pullSecrets` overrides for the stock images and keep the overrides of `cvat.backend.image` and `cvat.frontend.image`, which name the fork images (the chart's own defaults name upstream's).

## See also

- [nuclio chart](nuclio.md)
- [Configuration](../configuration.md): backend settings set through `cvat.backend.additionalEnv`
- [Access](../access.md): default credentials, Grafana access
- [State](../state.md): what each volume and database holds
- [Team Analytics](../team-analytics.md)
- Upstream's [Helm guide](https://docs.cvat.ai/docs/administration/advanced/k8s_deployment_with_helm/)
