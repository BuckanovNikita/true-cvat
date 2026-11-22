# build-ui.sh

`./build-ui.sh` builds the [UI image](../../GLOSSARY.md#ui-image) from `<fork-root>` with `Dockerfile.ui`: the whole CVAT UI bundle is compiled inside the image and served by an unprivileged nginx. Run it for a first install and for every upgrade.

The script never pushes. You push the image to your registry yourself, or carry it across with `SAVE=1`.

## Examples

Build from the public network with every default:

```bash
cd <fork-root>
IMAGE=registry.example.com/cvat/ui:v2.82.0-fork-0a1b2c3d ./build-ui.sh
```

Build in a closed network, with bases from the internal registry and packages from an npm mirror:

```bash
cd <fork-root>
IMAGE=registry.example.com/cvat/ui:v2.82.0-fork-0a1b2c3d \
NODE_IMAGE=registry.example.com/library/node:24.19.0-slim \
NGINX_IMAGE=registry.example.com/nginxinc/nginx-unprivileged:1.31.7-alpine3.24-slim \
NPM_REGISTRY=https://mirror.example.com/npm/ \
./build-ui.sh
```

Build and write an archive to carry the image across:

```bash
cd <fork-root>
SAVE=1 ./build-ui.sh
```

## Syntax and inputs

```text
[VARIABLE=value ...] ./build-ui.sh
```

The script takes no arguments. Every input is an environment variable. An empty variable counts as not set.

| Input | Default | Description |
| --- | --- | --- |
| `IMAGE` | `cvat/ui:v2.82.0-fork` | The reference the image is tagged with. Also names the `SAVE=1` archive. |
| `NODE_IMAGE` | `node:24.19.0-slim` | Base of the build stage. Always passed. The script's default pins a version; the `ARG` default in `Dockerfile.ui` is the floating `node:lts-slim`, used only when you build `Dockerfile.ui` without the script. |
| `SAVE` | `0` | `1` writes a gzipped `docker save` archive of `IMAGE` after the build. Any other value writes nothing. |
| `NGINX_IMAGE` | `nginxinc/nginx-unprivileged:1.31.7-alpine3.24-slim` (the `ARG` default in `Dockerfile.ui`) | Base of the runtime stage. Passed only when set. |
| `NPM_REGISTRY` | not set: each tool's own registry | An npm registry URL. Passed only when set. |

`NGINX_IMAGE` and `NPM_REGISTRY` are [perimeter inputs](../../GLOSSARY.md#perimeter-input); so is `NODE_IMAGE`, which the script always sets.

`NPM_REGISTRY` configures three tools, each only inside the build step that uses it:

- npm: `npm install -g corepack --registry <value>`, run only when the Node image has no `corepack`; and `npm_config_registry` during `yarn install`.
- corepack: `COREPACK_NPM_REGISTRY`, from which corepack downloads the yarn release that `package.json` pins (`corepack enable` and `yarn install`).
- yarn: `YARN_NPM_REGISTRY_SERVER` during `yarn install --immutable`.

When it is not set, none of these variables is set.

`Dockerfile.ui` also declares `CLIENT_PLUGINS`; the script does not pass it, so it stays empty. `SOURCE_MAPS_ENABLED` is always passed as `false`.

Tools the build host needs and the files `<fork-root>` must contain are listed in [Requirements](../requirements.md).

## How it works

1. Changes to the directory that holds the script and runs `git clean -xdqf -- cvat-ui/dist`: deletes every untracked and ignored file under `cvat-ui/dist`. Files the [fork tree](../../GLOSSARY.md#fork-tree) tracks there (`favicon.ico`) stay. That directory is part of the build context and webpack does not clean it, so a stale build on the host would otherwise end up in the image.
2. Collects the build arguments: `NODE_IMAGE`, `SOURCE_MAPS_ENABLED=false`, and `NGINX_IMAGE` and `NPM_REGISTRY` when set. When either of the last two is set, prints `inputs from the environment: <names>` on stderr.
3. Runs `DOCKER_BUILDKIT=1 docker build -f Dockerfile.ui -t <IMAGE> .` with `<fork-root>` as the context. BuildKit reads `Dockerfile.ui.dockerignore` in place of `.dockerignore`, which cuts the context down to `.yarnrc.yml`, `package.json`, `yarn.lock`, `cvat-data`, `cvat-core`, `cvat-canvas`, `cvat-canvas3d` and `cvat-ui`, without any `node_modules`.
4. Inside the build: installs corepack if the Node image lacks it, runs `corepack enable`, `yarn install --immutable`, then `yarn run build:cvat-ui` with source maps off. The runtime stage copies `cvat-ui/react_nginx.conf` as nginx's `default.conf`, `cvat-ui/robots.txt` and the built bundle.
5. The build tags `IMAGE` directly. There is no temporary tag and no check of the image after the build.
6. Prints the result line, and with `SAVE=1` writes the archive in `<fork-root>`.

## Result

- `IMAGE` names the new image on the local Docker daemon. Nothing is pushed.
- The script does not redirect `docker build`; with BuildKit its progress output goes to stderr. On success the script prints on stdout:

```text
built <IMAGE> on <NODE_IMAGE>
```

- With `SAVE=1`: an archive `<IMAGE with every ":" and "/" replaced by "-">.tar.gz` in `<fork-root>`, and the line `saved <name>.tar.gz` on stdout. The default `IMAGE` gives `cvat-ui-v2.82.0-fork.tar.gz`. Load it on the other side with `docker load -i <name>.tar.gz`.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | The image is built and tagged as `IMAGE` (and saved, with `SAVE=1`). |
| non-zero | A command failed under `set -e`: `git clean`, `docker build`, `docker save` or `gzip`. The code is that command's. |

## Common errors

The script prints no messages of its own for a failure; the error is the one of the command that failed.

- `git clean` fails when `<fork-root>` is not a git work tree. See [Requirements](../requirements.md).
- A failed pull of `NODE_IMAGE` or `NGINX_IMAGE` stops `docker build`. Set the variable to a reference your registry has.
- `yarn install --immutable` fails when the registry cannot be reached, or when it lacks a package of `yarn.lock`. Set `NPM_REGISTRY` to a mirror that serves them all.

## See also

- [Requirements](../requirements.md): tools, network endpoints and the contents of `<fork-root>`.
- [build-server.sh](build-server.md): the [fork server image](../../GLOSSARY.md#fork-server-image).
