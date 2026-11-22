# Access

This page lists what the fork changes in who may do what, and the access facts an install cannot avoid: who can open [Grafana](../GLOSSARY.md#grafana) when [analytics](../GLOSSARY.md#analytics) is enabled, and the default credentials the chart ships. Read it before you open an install to users.

## Issues and comments inside an organization

The fork adds a [role floor](../GLOSSARY.md#role-floor) to the issue and comment policies. Everything else in those policies is stock.

A user gains full access to an issue or a comment when all of these hold:

1. The request is made inside an organization (an organization is selected).
2. The issue or comment belongs to that same organization.
3. The user is a member of that organization, in any organization role.
4. The user's global role is `worker` or higher (`worker`, `user` or `admin`).

Such a user may view, create, update and delete issues and comments of the organization, whether or not they are assigned to the job, task or project. When they list issues or comments, they see every one of the organization.

Nobody else gains anything:

| Who | What the fork changes |
| --- | --- |
| A member with no global role | nothing; the stock rules decide |
| A user who is not a member of the organization | nothing |
| A member of another organization | nothing; the issue's organization must be the selected one |
| Anyone working with no organization selected (the personal workspace) | nothing; the stock rules decide |

## Organization creation

Only [administrators](../GLOSSARY.md#administrator) can create organizations by default. Upstream lets every account with the `user` global role do it. The variable `CVAT_ORGANIZATIONS_MIN_ROLE_TO_CREATE` changes this; its values are on the [configuration page](configuration.md#organization-creation-cvat_organizations_min_role_to_create). Administrators can always create organizations, whatever the value.

## Team Analytics

The [Team Analytics](../GLOSSARY.md#team-analytics) page, its API under `/api/team-analytics/` and its settings are for administrators only, with or without an organization selected. No organization role allows it, an owner's included.

What a non-administrator gets:

- No «Team Analytics» link in the header. The link is shown only to members of the `admin` group, and only where analytics is enabled.
- On a direct link to the page: the panel «Страница Team Analytics недоступна» ("The Team Analytics page is unavailable") and no figures.
- From the API: `403` for a signed-in user, `401` for a request without credentials.

Operating Team Analytics is described on the [Team Analytics page](team-analytics.md).

## Grafana when analytics is enabled

With `analytics.enabled: true` (the chart's default) the chart installs Grafana with these settings in `helm-chart/values.yaml`:

| Value | Setting |
| --- | --- |
| `grafana.grafana.ini` | `auth.anonymous.enabled: true`, `auth.anonymous.org_role: Admin`, `auth.disable_login_form: true`, `auth.basic.enabled: false` |

Grafana itself therefore asks nobody to sign in: every request that reaches it is served with the Grafana `Admin` role. That role can edit dashboards, add data sources and run any query against ClickHouse through the provisioned ClickHouse data source, which holds the ClickHouse password (Grafana does not display it, and the provisioned data source is marked not editable).

Who can reach Grafana depends on how it is exposed:

| Install | Who can open Grafana, as Grafana `Admin` |
| --- | --- |
| `ingress.enabled: true` and `traefik.enabled: true` | Only users whose CVAT profile has analytics access. The chart's Traefik `forwardauth` middleware sends each request to CVAT's `/analytics` endpoint with the request's `Cookie` and `Authorization` headers; CVAT allows it only when the user has analytics access. Administrators and superusers get analytics access automatically when their account is saved or added to the `admin` group; others only if it is set for them in the Django admin. The flag is never cleared automatically: an account removed from the `admin` group keeps it until you clear it in the Django admin. This applies only while Traefik serves the ingress: the middleware annotations are Traefik's, so if you set `ingress.className` to another controller they have no effect. |
| `ingress.enabled: true` and `traefik.enabled: false` (the chart's default for Traefik) | Anyone who can reach the CVAT host name. The chart creates the `/analytics` ingress without any authentication unless you add it through `analytics.ingress.annotations` or `ingress.annotations`: the `forwardauth` and `stripprefix` middlewares exist only when `traefik.enabled` is true. |
| any | Anyone who can reach the Grafana Service (`<release>-grafana`, `ClusterIP`, port 80) from inside the cluster, for example any pod in the cluster that no network policy of yours blocks. The chart ships no network policy. |

CVAT's header also shows a «Grafana» link, opening `/analytics` in a new tab, to users whose profile has analytics access, where analytics is enabled. The link only follows the same check as the forward authentication above.

`helm-chart/analytics/grafana_conf.yml` is a Traefik file-provider configuration. No template of the chart uses it, so it has no effect on a Helm install.

Before you open an install with analytics enabled to users, do at least one of these:

- Use the chart's Traefik (`traefik.enabled: true`) so the `/analytics` path passes through CVAT's check.
- If you use another ingress controller, add an equivalent forward-authentication to `analytics.ingress.annotations`, pointing at `http://<release>-backend-service:8080/analytics`, or do not expose `/analytics` at all.
- Restrict access to the Grafana Service with a network policy.

The Grafana admin account exists too (`grafana.adminUser`, default `admin`). Its password is generated by the Grafana chart unless you set `grafana.adminPassword` or `grafana.admin.existingSecret`. The login form is disabled, so it is not used for signing in.

## Default credentials the chart ships

`helm-chart/values.yaml` ships fixed passwords. Replace each one in `values.prod.yaml` before the first install.

| Value | Default | What uses it |
| --- | --- | --- |
| `postgresql.secret.password` | `cvat_postgresql` | CVAT's Postgres user `cvat` |
| `postgresql.secret.postgres_password` | `cvat_postgresql_postgres` | Postgres superuser |
| `postgresql.secret.replication_password` | `cvat_postgresql_replica` | Postgres replication user |
| `redis.secret.password` | `cvat_redis` | in-memory Redis |
| `cvat.kvrocks.secret.password` | `cvat_kvrocks` | kvrocks (on-disk Redis) |
| `analytics.clickhouseUser` | `user` | ClickHouse user of CVAT, Vector, Grafana and Team Analytics |
| `analytics.clickhousePassword` | `user` | its password |

How to replace them:

- Postgres, Redis, kvrocks: set the password values, or set `postgresql.secret.create`, `redis.secret.create` or `cvat.kvrocks.secret.create` to `false` and create a Secret yourself under the name in `postgresql.secret.name`, `redis.secret.name` or `cvat.kvrocks.secret.name`, with the same keys the chart would write (`password`, and for Postgres also `username`, `database`, `postgres-password`, `replication-password`).
- ClickHouse: set `analytics.clickhousePassword`. If you change `analytics.clickhouseUser`, set `clickhouse.auth.username` to the same name; the ClickHouse subchart takes the user name from that value and the password from `cvat-analytics-secret`.
- The chart marks `cvat-analytics-secret` immutable. To change the ClickHouse credentials of a running install, delete that Secret before `helm upgrade`.

Stock CVAT credentials beyond these are covered by [upstream's Helm guide](https://docs.cvat.ai/docs/administration/advanced/k8s_deployment_with_helm/).

## After a policy change

The authorization policies are files inside the [fork server image](../GLOSSARY.md#fork-server-image). Each server process builds the [policy bundle](../GLOSSARY.md#policy-bundle) from those files on first use and keeps it in memory; the policy engine (OPA) fetches it from the server's `/api/auth/rules` every 10 to 15 seconds. A changed policy therefore takes effect only after:

1. you build a new fork server image ([build-server.sh](commands/build-server.md)),
2. you deploy it and the backend pods restart.

To confirm which policies a running server serves, use the [policy bundle check](commands/policy-bundle.md).

## See also

- [Configuration](configuration.md): `CVAT_ORGANIZATIONS_MIN_ROLE_TO_CREATE` and the Team Analytics settings.
- [Team Analytics](team-analytics.md): operating the feature.
- [CVAT chart](charts/cvat.md): ingress, `analytics.*` and credential values.
- [Policy bundle check](commands/policy-bundle.md).
