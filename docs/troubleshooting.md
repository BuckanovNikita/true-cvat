# Troubleshooting

This page is a symptom index. Find the message or the behaviour you see, read the cause and the fix, and follow the link to the page that owns the detail. Sections follow where you meet the problem.

## Building the server image

All of these come from `build-server.sh`. Details: [build-server.sh, common errors](commands/build-server.md#common-errors).

| Message or symptom | Cause | Fix |
| --- | --- | --- |
| `MAKE_JOBS must be a positive integer, not '0'` | `MAKE_JOBS` is `0`, negative or not a number. | Set it to `1` or more, or unset it. |
| `sha256sum: <fork-root>/Dockerfile: No such file or directory` | Upstream's `Dockerfile` is missing from `<fork-root>`; the script hashes it before it builds. | Restore the `Dockerfile` of the [fork tree](../GLOSSARY.md#fork-tree). |
| `upstream's Dockerfile changed since Dockerfile.server was ported from it` | The `Dockerfile` in `<fork-root>` is not the one `Dockerfile.server` was ported from: the vendored tree is incomplete, mixed or edited. | Restore the `Dockerfile` of the fork tree you build. |
| `Dockerfile.server: ARG BASE_IMAGE has no default, and BASE_IMAGE is not set in the environment` (also `RUST_IMAGE`, `GOLANG_IMAGE`) | `Dockerfile.server` lacks the `ARG` default line. | Set the variable, or restore `Dockerfile.server`. |
| `these files are not tracked, so the image would lack them while the working tree has them:` | A file under a copied path is not in the git index. | `git add` it or remove it. |
| `these tracked files are missing from the working tree:` | A tracked file under a copied path was deleted. | Restore it, or `git rm` it. |
| `fatal: not a git repository ...` | `<fork-root>` is not a git work tree. | Make it a work tree with the files tracked ([requirements](requirements.md#what-the-fork-tree-must-contain)). |
| `pull failed once; retrying ...`, then Docker's error | A base image cannot be pulled from your registry. | Check the reference and the daemon's registry login, or point the base variable at a reachable mirror. |
| `this docker client predates --provenance: building without the flag` | Not an error: an older Docker client. | Nothing. |
| `the build produced no image id: nothing to check or tag` | The daemon reports no image after a successful `docker build`. | Check the daemon and its image store; build again. |
| `a check failed: this run's build <id> was not tagged and nothing was saved` | An in-image check failed; the lines above name it ([policy bundle](../GLOSSARY.md#policy-bundle) `missing`/`DIFFERS`, `WRONG` Python or program, unresolved library, missing migration). | Fix the cause in the fork tree and build again. The line that follows says what `IMAGE` still names; do not deploy an image the message says failed its checks. |

## Building the UI image

`build-ui.sh` prints no messages of its own; the error is the failing command's. Details: [build-ui.sh, common errors](commands/build-ui.md#common-errors).

| Symptom | Cause | Fix |
| --- | --- | --- |
| `git clean` fails | `<fork-root>` is not a git work tree. | See [requirements](requirements.md#what-the-fork-tree-must-contain). |
| `docker build` stops on a pull | `NODE_IMAGE` or `NGINX_IMAGE` is not in your registry. | Set the variable to a reference your registry has. |
| `yarn install --immutable` fails | The npm registry is unreachable or lacks a package of `yarn.lock`. | Set `NPM_REGISTRY` to a mirror that serves them all. |

## The policy bundle check

All of these come from `verify/policy_bundle.sh`. Details: [policy bundle check, common errors](commands/policy-bundle.md#common-errors).

| Message | Cause | Fix |
| --- | --- | --- |
| `usage: verify/policy_bundle.sh from-image IMAGE [analytics] \| check [REF] \| check-analytics` | No subcommand or an unknown one (exit `2`). | Give one of the three. |
| `Unable to find image '<IMAGE>' locally` | The image is not local and cannot be pulled (exit `125`). | Load or pull it first. |
| `not a readable bundle archive: not a gzip file` (or `empty file`) | stdin is not a policy bundle: the first part of the pipeline failed. | Run that part alone; with `curl`, add `-f`. |
| `DIFFERS  rules/issues.rego != tree:cvat/apps/engine/rules/issues.rego` | The image or server runs other policies than the fork tree, or the server still serves the previous image's bundle. | Compare with the fork tree of the deployed [stage tag](../GLOSSARY.md#stage-tag); rebuild; restart the backend ([after a policy change](access.md#after-a-policy-change)). |
| `missing  rules/team_analytics.rego` | `check-analytics` on a bundle made without analytics. | Use `check`, or `from-image IMAGE analytics`. |
| `fatal: invalid object name '<REF>'.` | `REF` is not in the work tree, or there is no work tree (exit `128`). | Make the tag available, or run `check` without `REF`. |

## Rendering or installing the charts

`helm template` and `helm upgrade` stop with `Error: execution error at (<template>:<line>:<col>): <message>`. Details: [CVAT chart, render failures](charts/cvat.md#render-failures).

| Message | Cause | Fix |
| --- | --- | --- |
| `the backend image tag "v2.82.0" is not immutable (expected <pattern>); ...` | `imageTagsGuard.enabled: true` with a tag that does not match `imageTagsGuard.tagPattern`. | Pass the tag the build published, such as `v2.82.0-fork-0a1b2c3d`. |
| `the grafana image tag "" is not immutable ...` | The guard checks [`grafana`](../GLOSSARY.md#grafana) by default, and the chart sets no Grafana tag (the message is the same with analytics on or off). | Remove `grafana` from `imageTagsGuard.components`, or set `grafana.image.tag` to a tag that matches the pattern ([image tags guard](charts/cvat.md#image-tags-guard)). |
| `the <component> image reference is not set, and imageTagsGuard.enabled requires it` | A guarded component has an empty image value. | Set the image, or remove the component from the list. |
| `imageTagsGuard.components names an unknown component "<name>"; ...` | A name outside `backend`, `frontend`, `grafana`, `opa`, `kvrocks`. | Use only those. |
| `imageTagsGuard.tagPattern must be set when the guard is on` | Empty pattern. | Set it or keep the default. |
| `cvat.backend.permissionFix is enabled but sets neither paths nor commandOverride, ...` | Empty `cvat.backend.permissionFix.paths` and no `commandOverride`. | Set one, or disable the init container. |
| `ingress.tlsSecretName must name the secret to create`, `ingress.tlsSecret.create needs the certificate in the top-level tlscrt value`, `... the key in the top-level tlskey value` | `ingress.tlsSecret.create: true` with `ingress.enabled: true` and a missing name, certificate or key. | Supply them ([ingress TLS secret](charts/cvat.md#ingress-tls-secret)). |
| The `user-data-permission-fix` init container fails with a command named `chmod -R 777 /x` | A values file written for upstream's `/bin/sh -c` form of `commandOverride`. | Rewrite it as a list whose first element is the program ([permission fix](charts/cvat.md#permission-fix-init-container)). |
| Serverless functions unreachable from CVAT after installing nuclio | `nuclio.dashboard.host` keeps its default `<release>-nuclio-dashboard` (`cvat-nuclio-dashboard` for the release `cvat`), which the nuclio release does not create. | Set it to `nuclio-dashboard` and install nuclio in the CVAT namespace ([what must agree](charts/nuclio.md#what-must-agree-with-the-cvat-chart)). |

## The backend at start

These are log lines, not failures: CVAT starts anyway.

| Message | Cause | Fix |
| --- | --- | --- |
| `TEAM_ANALYTICS_READ_QUEUE_LIMIT='abc' is not a number; using 32` | A [Team Analytics](../GLOSSARY.md#team-analytics) setting does not parse; logged at `ERROR`, the default is used. | Fix the value ([invalid values](configuration.md#invalid-values)). |
| `TEAM_ANALYTICS_REFRESH_INTERVAL_S='0' must be a number of at least 1; using 600` | A value below its minimum. | Fix the value. |
| `TEAM_ANALYTICS_TECHNICAL_ACCOUNTS is ignored: the Technical accounts list is edited by an administrator ...` | The variable is still set; it has no effect. | Move its accounts to the [technical accounts list](../GLOSSARY.md#technical-accounts-list), then remove it ([migration](team-analytics.md#migrating-from-team_analytics_technical_accounts)). |
| A changed policy does not take effect | Each server process keeps its policy bundle in memory. | Rebuild the [fork server image](../GLOSSARY.md#fork-server-image), deploy it, restart the backend pods ([after a policy change](access.md#after-a-policy-change)). |

## Team Analytics

Details: [Operating Team Analytics](team-analytics.md).

| Symptom | Cause | Fix |
| --- | --- | --- |
| Every `/api/team-analytics/...` address answers `404`, the header has no «Team Analytics» link, and the page address shows «Страница Team Analytics недоступна» even to an administrator | [Analytics](../GLOSSARY.md#analytics) is off (`analytics.enabled: false`), so Team Analytics is not installed. | [Enable it](scenarios/enable-team-analytics.md). |
| `429` with `Retry-After`; after three retries the page shows its error panel | No answer is in the cache yet, or `TEAM_ANALYTICS_READ_QUEUE_LIMIT` reads are already waiting. Steady `429` means the [Team Analytics worker](../GLOSSARY.md#team-analytics-worker) does not run or cannot keep up. | Check the worker pods, then add processes or replicas ([what 429 means](team-analytics.md#what-429-means-for-capacity)). |
| `503` with `{"error": "unavailable"}` | The server could not use Redis, or the worker's read failed, usually on ClickHouse. | Restore Redis or ClickHouse ([failure modes](team-analytics.md#failure-modes)). |
| «Обработка истории» ("Processing history") with a progress bar, and periods shown as «Этот период ещё не обработан» ("This period is not processed yet") | The worker is still processing past days, newest first; a period appears once every day of it is processed. | Wait ([processed history](team-analytics.md#processed-history-and-stale-data)). |
| A warning starting «Последнее обновление показателей:» ("Last update of the figures:"), or «Показатели ещё не обновлялись. Недавняя работа может быть не учтена.» ("The figures have not been updated yet. Recent work may be missing.") | The last successful refresh is more than 30 minutes old, or none happened. | Check the worker, the utils worker (the scheduler) and ClickHouse. After a loss of Redis, rerun the initializer so `syncperiodicjobs` restores the schedule. |
| Log line `the refresh of the Team Analytics totals failed; the next run tries again` | The refresh could not reach ClickHouse or failed in it. | Restore ClickHouse; the next run catches up. |
| Automated accounts counted as people, or the technical accounts list empty after an upgrade | The list lives in the CVAT database and starts empty; `TEAM_ANALYTICS_TECHNICAL_ACCOUNTS` is no longer read. | Add the accounts on the page under «Настройки» ("Settings") ([technical accounts list](team-analytics.md#technical-accounts-list)). |
| Save of the settings refused with `400` and `there is no user <id>` | The account added does not exist. | Pick an existing user. |

## Access

Details: [Access](access.md).

| Symptom | Cause | Fix |
| --- | --- | --- |
| A user who is not an [administrator](../GLOSSARY.md#administrator) sees «Страница Team Analytics недоступна» ("The Team Analytics page is unavailable"); the API answers `403` | Team Analytics is for [administrators](../GLOSSARY.md#administrator) only; no organization role allows it. | Add the user to the `admin` group if they need it ([Team Analytics access](access.md#team-analytics)). |
| Ordinary users cannot create organizations | The fork's default of `CVAT_ORGANIZATIONS_MIN_ROLE_TO_CREATE` is `admin`. | Set it to `user` to restore upstream's behaviour ([organization creation](configuration.md#organization-creation-cvat_organizations_min_role_to_create)). |
| Organization members with a global role `worker` or higher see, edit and delete every issue and comment of the organization, assigned or not | The fork's [role floor](../GLOSSARY.md#role-floor). | Expected behaviour ([issues and comments](access.md#issues-and-comments-inside-an-organization)). |
| Anyone who reaches the CVAT host opens `/analytics` (Grafana) as Grafana `Admin` | With `analytics.enabled` and `ingress.enabled`, Grafana signs every visitor in anonymously as `Admin`, and with `traefik.enabled: false` (the default) the `/analytics` ingress has no authentication. | Use `traefik.enabled: true`, add forward authentication, or do not expose `/analytics` ([Grafana](access.md#grafana-when-analytics-is-enabled)). |

## See also

- [Index of these pages](README.md)
- [Requirements](requirements.md)
- [State and backups](state.md)
