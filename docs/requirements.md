# Requirements

This page lists what you need before you build or install the fork: the tools on the build host, the network endpoints each step reaches, what `<fork-root>` (the [fork tree](../GLOSSARY.md#fork-tree)) must contain, and which images a cluster pulls for a default install.

## Tools on the build host

| Tool | Needed by | What the code fixes |
| --- | --- | --- |
| `bash` | every script | The scripts start with `#!/usr/bin/env bash` and use `set -euo pipefail`, arrays and `${!name}` indirection. |
| Docker with BuildKit | `build-server.sh`, `build-ui.sh` | Both scripts run `DOCKER_BUILDKIT=1 docker build`. `Dockerfile.server` uses `RUN --mount=type=cache`, and `build-ui.sh` relies on BuildKit reading `Dockerfile.ui.dockerignore` in place of `.dockerignore`; the classic builder supports neither. |
| `git` | `build-server.sh`, `build-ui.sh`, `verify/policy_bundle.sh check <REF>` | `build-server.sh` lists tracked files with `git ls-files`; `build-ui.sh` runs `git clean`; `check <REF>` reads files with `git show <REF>:<path>`. |
| `sha256sum`, `sed`, `tar`, `mktemp`, `tr`, `wc`, `date`, `chmod`, `grep` | `build-server.sh` | `tar` must accept `--null --verbatim-files-from -T` (GNU tar). |
| `gzip` | both build scripts with `SAVE=1` | `docker save … \| gzip`. |
| `python3` | `verify/policy_bundle.sh check` and `check-analytics` | The listing of a [policy bundle](../GLOSSARY.md#policy-bundle) is checked with `python3 -I` and the standard `tarfile` module on the host. `build-server.sh` runs these checks too, so the server build needs `python3` on the host. |
| `cmp`, `cp`, `tar` | `verify/policy_bundle.sh` | The bundle is extracted with `tar xzf` and each policy compared with `cmp -s`. |
| Helm 3 | both charts | Both charts are `apiVersion: v2`. |
| Kubernetes | both charts | `helm-chart/Chart.yaml` and `helm-chart-nuclio/Chart.yaml` declare `kubeVersion: ">= 1.23.0-0"`. |

### Docker client version

`build-server.sh` passes `--provenance=false` to `docker build` only when `docker build --help` lists `--provenance`. With a client that does not, the script prints `this docker client predates --provenance: building without the flag` and builds without it. `build-ui.sh` passes no such flag. No other minimum Docker version is checked by the scripts.

## Network endpoints

With no overrides, each step reaches the public endpoints below. In a closed network every one of them is replaced through a [perimeter input](../GLOSSARY.md#perimeter-input); the inputs and their defaults are listed on [build-server.sh](commands/build-server.md) and [build-ui.sh](commands/build-ui.md).

| Step | Endpoint reached by default | Why |
| --- | --- | --- |
| `build-server.sh`: base pulls | Docker Hub (`python:3.12-slim-bookworm`, `rust:1.85-slim-bookworm`, `golang:1.27.2`, each pinned by digest in `Dockerfile.server`) | The script runs `docker pull` for each base before the build. |
| `build-server.sh`: system packages | the Debian apt sources configured in the base image | `apt-get update` and `apt-get install` in the build and runtime stages. |
| `build-server.sh`: Python packages | PyPI | `pip wheel` of the server requirements and of PyAV. |
| `build-server.sh`: source archives | `https://github.com` | OpenH264, FFmpeg, datumaro (a pinned commit archive) and smokescreen are downloaded with `curl` and checked against a SHA-256. |
| `build-server.sh`: Go modules | `proxy.golang.org` and `sum.golang.org` | `go mod download` for smokescreen. `GO_PROXY` also turns the checksum database off (`GOSUMDB=off`), so with it set neither host is reached. |
| `build-server.sh`: Rust crates | `crates.io` | cargo, used while building Python wheels. |
| `build-ui.sh`: base pulls | Docker Hub (`node:24.19.0-slim`, `nginxinc/nginx-unprivileged:1.31.7-alpine3.24-slim`) | The `FROM` lines of `Dockerfile.ui`. |
| `build-ui.sh`: packages | the public npm registry | `npm install -g corepack` (only where the Node image lacks corepack), corepack's download of the pinned yarn release, and `yarn install --immutable`. |
| `verify/policy_bundle.sh` | none | `from-image` runs a container with `--network none`; `check` reads stdin. A `from-image` image that is not on the local daemon makes `docker run` try to pull it. |
| `helm install` / `helm template` | none for the charts themselves | The chart dependencies are committed archives (see below). The cluster pulls images from the registries in [Images a cluster pulls](#images-a-cluster-pulls). |

`Dockerfile.server` also declares `http_proxy` and `https_proxy` build arguments; `build-server.sh` does not pass them.

## What the fork tree must contain

### For `build-server.sh`

- `<fork-root>` must be inside a git work tree. Outside one the script stops at its first git call (`fatal: not a git repository`, exit code 128). The build context is built from `git ls-files` of these paths, as they are in the working tree:
  `backend_entrypoint.d`, `cvat`, `supervisord`, `utils`, `backend_entrypoint.sh`, `components/analytics/clickhouse/init.py`, `manage.py`, `rqscheduler.py`, `wait_for_deps.sh`.
- Every file under those paths must be tracked. The script refuses to build when a file there is untracked (`these files are not tracked, so the image would lack them while the working tree has them:`) or when a tracked file is missing from the working tree (`these tracked files are missing from the working tree:`).
- `Dockerfile.server`: the build file, and the source of the default base references (`ARG BASE_IMAGE=…`, `ARG RUST_IMAGE=…`, `ARG GOLANG_IMAGE=…`).
- Upstream's `Dockerfile` at the root, unchanged. The image never uses it, but the script compares its SHA-256 with the hash recorded in the script and refuses on a mismatch (`upstream's Dockerfile changed since Dockerfile.server was ported from it`).
- `verify/policy_bundle.sh`, which the script runs on the built image, and the three policy files it compares with the bundles: `cvat/apps/engine/rules/issues.rego`, `cvat/apps/engine/rules/comments.rego` and, for the check with [analytics](../GLOSSARY.md#analytics) enabled, `cvat/apps/team_analytics/rules/team_analytics.rego`.

Details of each refusal: [build-server.sh](commands/build-server.md).

### For `build-ui.sh`

- `<fork-root>` must be inside a git work tree: the script starts with `git clean -xdqf -- cvat-ui/dist`, which deletes every untracked or ignored file under `cvat-ui/dist` and fails with `fatal: not a git repository` (exit code 128) outside a work tree.
- `Dockerfile.ui` and `Dockerfile.ui.dockerignore`. The build context is the whole root, cut down by `Dockerfile.ui.dockerignore` to `.yarnrc.yml`, `package.json`, `yarn.lock`, `cvat-data`, `cvat-core`, `cvat-canvas`, `cvat-canvas3d` and `cvat-ui` (without any `node_modules`). All of them must be present.

Details: [build-ui.sh](commands/build-ui.md).

### For `verify/policy_bundle.sh`

- The policy files named above, at their paths. `check <REF>` reads the two engine policies from the git revision `<REF>` (a tag, for example) instead, so that revision must exist in the work tree's repository; `check-analytics` takes no `<REF>`.
- `from-image` needs the image on the local Docker daemon.

Details: [verify/policy_bundle.sh](commands/policy-bundle.md).

### For the charts

- `helm-chart/` with `Chart.yaml`, `Chart.lock`, `values.yaml`, `templates/`, `analytics/` (the templates embed `analytics/clickhouse/*.sh`, `analytics/grafana/dashboards/*.json` and `analytics/vector/*.toml` into ConfigMaps and Secrets) and the dependency archives in `helm-chart/charts/`: `postgresql-12.1.15.tgz`, `vector-0.19.2.tgz`, `clickhouse-4.1.16.tgz`, `grafana-6.60.6.tgz`, `traefik-37.3.0.tgz`, `redis-19.6.4.tgz`. They match `Chart.lock`, so `helm install` and `helm template` need no `helm dependency build` and no network. Do not run `helm dependency update` in a closed network: it would try to reach the chart repositories named in `Chart.yaml`.
- `helm-chart-nuclio/` with `Chart.yaml`, `values.yaml` and `templates/`. It has no dependencies, and it is not a dependency of the CVAT chart: it is installed as its own release ([nuclio chart](charts/nuclio.md)).

## Images a cluster pulls

These are the references the charts render with their default values (`helm template`). An install overrides at least the two CVAT images with the [fork server image](../GLOSSARY.md#fork-server-image) and the [UI image](../GLOSSARY.md#ui-image): the chart defaults name upstream's images. The values that set each reference are on [the CVAT chart page](charts/cvat.md) and [the nuclio chart page](charts/nuclio.md).

| Default reference | Rendered by | When |
| --- | --- | --- |
| `cvat/server:v2.82.0` | backend server, every worker, the initializer job | always |
| `cvat/ui:v2.82.0` | frontend | always |
| `busybox:1.36.1` | the `user-data-permission-fix` init container of the backend server, the annotation, export, import and utils workers, and the [Team Analytics worker](../GLOSSARY.md#team-analytics-worker) | while `cvat.backend.permissionFix.enabled` is true (default) |
| `openpolicyagent/opa:1.12.2` | OPA | always |
| `apache/kvrocks:2.15.0` | kvrocks | always |
| `docker.io/cvat/postgresql:15.2.0-debian-11-r0` | Postgres subchart | while the bundled Postgres is enabled (default) |
| `docker.io/library/redis:7.2.11` | Redis subchart | while the bundled Redis is enabled (default) |
| `docker.io/cvat/clickhouse:23.12.2-debian-11-r0` | ClickHouse subchart | while the bundled ClickHouse is enabled (default) |
| `timberio/vector:0.26.0-alpine` | Vector subchart | with analytics enabled (default) |
| `docker.io/grafana/grafana:10.1.5` | [Grafana](../GLOSSARY.md#grafana) subchart | with analytics enabled (default) |
| `docker.io/bats/bats:v1.4.1` | Grafana's `helm test` pod | only on `helm test` |
| `docker.io/traefik:v3.6.0` | Traefik subchart | only with Traefik enabled (off by default) |
| `quay.io/nuclio/controller:1.14.1-amd64` | nuclio chart | when you install `helm-chart-nuclio/` |
| `quay.io/nuclio/dashboard:1.14.1-amd64` | nuclio chart | when you install `helm-chart-nuclio/` |

The nuclio chart's values also name images that nuclio itself starts at run time (for example `docker.io/curlimages/curl` for cron triggers); see [the nuclio chart page](charts/nuclio.md).

## See also

- [build-server.sh](commands/build-server.md)
- [build-ui.sh](commands/build-ui.md)
- [verify/policy_bundle.sh](commands/policy-bundle.md)
- [CVAT chart](charts/cvat.md)
- [nuclio chart](charts/nuclio.md)
- [State and backups](state.md)
