# build-server.sh

`./build-server.sh` builds the [fork server image](../../GLOSSARY.md#fork-server-image) from `<fork-root>` with `Dockerfile.server`. The server and every worker run this one image. It tags the image only after a set of checks inside the image pass. Run it for a first install, for every upgrade, and again after any change to the policies or to the [Team Analytics](../../GLOSSARY.md#team-analytics) app, because the policies are built into the image.

The script never pushes. You push the image to your registry yourself, or carry it across with `SAVE=1`.

## Examples

Build from the public network with every default:

```bash
cd <fork-root>
IMAGE=registry.example.com/cvat/server:v2.82.0-fork-0a1b2c3d ./build-server.sh
```

Build in a closed network, with bases from the internal registry and every download through a mirror:

```bash
cd <fork-root>
IMAGE=registry.example.com/cvat/server:v2.82.0-fork-0a1b2c3d \
BASE_IMAGE=registry.example.com/library/python:3.12-slim-bookworm \
RUST_IMAGE=registry.example.com/library/rust:1.85-slim-bookworm \
GOLANG_IMAGE=registry.example.com/library/golang:1.27.2 \
APT_REMOTE=https://mirror.example.com/debian \
APT_SECURITY_REMOTE=https://mirror.example.com/debian-security \
PIP_INDEX=https://mirror.example.com/pypi/simple \
GO_PROXY=https://mirror.example.com/goproxy \
CARGO_INDEX=sparse+https://mirror.example.com/crates/ \
GITHUB_PROXY=https://mirror.example.com/github \
./build-server.sh
```

Build on a host with network access and write an archive to carry the image across:

```bash
cd <fork-root>
SAVE=1 ./build-server.sh
```

## Syntax and inputs

```text
[VARIABLE=value ...] ./build-server.sh
```

The script takes no arguments. Every input is an environment variable. An empty variable counts as not set.

| Input | Default | Description |
| --- | --- | --- |
| `IMAGE` | `cvat/server:v2.82.0-fork` | The reference the finished image is tagged with. Also names the `SAVE=1` archive. |
| `MAKE_JOBS` | `5` | Parallel jobs of each compile step (`make -j`, and `CARGO_BUILD_JOBS`). Must be a positive integer without leading zeros (`0`, `007` and `-1` are refused). The FFmpeg, wheel and Go stages run at the same time, so the build can use several times this many cores. |
| `SAVE` | `0` | `1` writes a gzipped `docker save` archive of `IMAGE` after a successful build. Any other value writes nothing. |
| `BASE_IMAGE` | `python:3.12-slim-bookworm`, pinned by digest in `Dockerfile.server` | Base of the build stages and of the runtime image. Must be a Debian 12 (bookworm) image with Python 3.12 under `/usr/local`. |
| `RUST_IMAGE` | `rust:1.85-slim-bookworm`, pinned by digest in `Dockerfile.server` | Source of the Rust toolchain copied into the build stages. |
| `GOLANG_IMAGE` | `golang:1.27.2`, pinned by digest in `Dockerfile.server` | Base of the stage that builds smokescreen. |
| `APT_REMOTE` | not set: the base's own apt sources | A Debian mirror URL, the root that holds `dists/bookworm`. |
| `APT_SECURITY_REMOTE` | not set: the value of `APT_REMOTE` | A Debian security mirror URL, the root that holds `dists/bookworm-security`. Used only when `APT_REMOTE` is set. |
| `PIP_INDEX` | not set: PyPI | A pip index URL (the "simple" API). |
| `GO_PROXY` | not set: `proxy.golang.org` and `sum.golang.org` | A Go module proxy URL. |
| `CARGO_INDEX` | not set: crates.io | A cargo registry index URL. |
| `GITHUB_PROXY` | not set: `https://github.com` | A URL prefix that mirrors `https://github.com`, without a trailing slash. |

For a base, a value of the environment wins; otherwise the script reads the `ARG` default from `Dockerfile.server`. A base may be a tag or a tag pinned by digest. The script pulls every base before the build, so each reference must be pullable from a registry your daemon can reach; an image that exists only in the local daemon fails the pull. The script logs the digest a tag resolved to and does not refuse an unpinned tag.

The last six are the [perimeter inputs](../../GLOSSARY.md#perimeter-input). Each one is passed as a build argument of the same name only when it is set, so an unset input keeps the empty public default of `Dockerfile.server`.

### What each perimeter input replaces

- `APT_REMOTE`: in the build stage and in the runtime stage, the base's `/etc/apt/sources.list` and `/etc/apt/sources.list.d/debian.sources` are deleted and one file, `/etc/apt/sources.list.d/mirror.sources`, is written. It names `APT_REMOTE` for the suites `bookworm bookworm-updates` and `APT_SECURITY_REMOTE` (or `APT_REMOTE` again) for `bookworm-security`, components `main non-free`, signed by `/usr/share/keyrings/debian-archive-keyring.gpg`. The mirror must therefore serve Debian's own signed Release files; there is no `trusted=yes`. Without `APT_REMOTE`, the base's sources are widened to `non-free` for the runtime install and narrowed back to `main` afterwards. Example: `https://mirror.example.com/debian`.
- `APT_SECURITY_REMOTE`: only the `bookworm-security` entry of that file. Example: `https://mirror.example.com/debian-security`.
- `PIP_INDEX`: exported as `PIP_INDEX_URL`, together with `PIP_DEFAULT_TIMEOUT=300`, inside each `pip` step only: the PyAV wheel build, the wheel build of the server requirements, and the optional `debugpy` install. It is not put into the image's environment. Example: `https://mirror.example.com/pypi/simple`.
- `GO_PROXY`: exported as `GOPROXY`, with `GOSUMDB=off`, for `go mod download` of smokescreen. With it set, the checksum database is not consulted at all. Example: `https://mirror.example.com/goproxy`.
- `CARGO_INDEX`: written into `/usr/local/cargo/config.toml` of the Rust stage as a source replacement of crates.io (`[source.crates-io] replace-with = "mirror"`, `[source.mirror] registry = "<value>"`), with `[net] retry = 5` and `[http] timeout = 300`. The value goes into cargo's `registry` key as it is, so use the form your mirror documents for cargo (a `sparse+https://…/` URL or a git index URL). Example: `sparse+https://mirror.example.com/crates/`.
- `GITHUB_PROXY`: replaces `https://github.com` at the start of the four `curl` downloads: `<prefix>/cisco/openh264/archive/v<version>.tar.gz`, `<prefix>/FFmpeg/FFmpeg/archive/refs/tags/n<version>.tar.gz`, `<prefix>/cvat-ai/datumaro/archive/<commit>.zip` and `<prefix>/stripe/smokescreen/archive/eb1ac09.tar.gz`. Each file is checked against a SHA-256 fixed in `Dockerfile.server`, so the mirror must return the same bytes as github.com. Example: `https://mirror.example.com/github`.

### Build arguments the script never passes

`Dockerfile.server` declares more build arguments than the script sets. These keep their `Dockerfile.server` defaults: `CLAM_AV` (`no`), `CVAT_DEBUG_ENABLED` (empty), `CVAT_CONFIGURATION` (`production`), `USER` (`django`), `TZ` (`Etc/UTC`), `http_proxy`, `https_proxy`, `no_proxy`, `socks_proxy`, `PIP_DISABLE_PIP_VERSION_CHECK` (`1`), `COVERAGE_PROCESS_START`, `PREFIX` (`/opt/ffmpeg`) and `PKG_CONFIG_PATH` (`${PREFIX}/lib/pkgconfig`). To change one of them you build `Dockerfile.server` yourself with `docker build --build-arg`; the script has no input for it.

Tools the build host needs and the files `<fork-root>` must contain are listed in [Requirements](../requirements.md).

## How it works

1. Checks `MAKE_JOBS`. A value that is not a positive integer (no leading zeros) stops the script.
2. Computes the SHA-256 of upstream's `Dockerfile` in `<fork-root>` and compares it with the hash recorded in the script. A missing `Dockerfile` stops the script here too. `Dockerfile.server` is a port of that exact file; a different file stops the script.
3. Resolves the three bases (environment first, then the `ARG` default of `Dockerfile.server`) and collects the perimeter inputs that are set.
4. Runs `git ls-files` over the paths `Dockerfile.server` copies: `backend_entrypoint.d`, `cvat`, `supervisord`, `utils`, `backend_entrypoint.sh`, `components/analytics/clickhouse/init.py`, `manage.py`, `rqscheduler.py`, `wait_for_deps.sh`. A file there that is not tracked and not ignored stops the script, and so does a tracked file that is missing from the working tree.
5. Builds the context in a temporary directory: the tracked files of those paths, as they are in the working tree (uncommitted edits to tracked files are included). Prints the number of files and the inputs taken from the environment.
6. Pulls each base with `docker pull -q`. A failed pull is retried once; a second failure stops the script. After each pull, prints the repo digest the reference resolved to (or the image id when the daemon has no repo digest for it).
7. Runs `docker build --help`. When the client lists `--provenance`, the build gets `--provenance=false`; otherwise it builds without the flag.
8. Runs `DOCKER_BUILDKIT=1 docker build --pull=false` with `Dockerfile.server` and the build arguments, to a temporary tag `cvat-server-build:<YYYYmmddHHMMSS>-<pid>`. A build failure stops the script. The script then asks the daemon for the image id of the temporary tag (falling back to the id file of the build, with a note on stderr); with neither, it stops.
9. Runs the checks below on the temporary tag. Every check runs in a one-off container with `--rm --network none --cpus=1`, no mounts for the policy checks, and the image's own user. All checks run, even after one fails.
   - Policy bundle: `verify/policy_bundle.sh from-image <tmp tag> | verify/policy_bundle.sh check`. Proves that the [policy bundle](../../GLOSSARY.md#policy-bundle) the server builds holds the tree's `issues.rego` and `comments.rego`, each once, byte for byte. See [verify/policy_bundle.sh](policy-bundle.md).
   - Policy bundle with analytics: `from-image <tmp tag> analytics | check-analytics`. Proves that with analytics enabled the bundle also holds the tree's Team Analytics policy.
   - Programs: `python`, `python3`, `django-admin` and `uvicorn` resolve under `/opt/venv/bin`; the two scripts start with `#!/opt/venv/bin/python`; `python` and `python3` are Python 3.12; `supervisord --version` runs; `nginx -t` accepts `/etc/nginx/nginx.conf`.
   - Shared objects: the FFmpeg and OpenH264 libraries under `/usr/lib` exist, and no shared object among them or under `/opt/venv` (except those in a wheel's `.libs` directory) has a dependency that `ldd` reports as `not found`.
   - Django: with `CVAT_ANALYTICS=1` and again with `0`, Django sets up on the production settings, and the Team Analytics app is installed and `/api/team-analytics/status` is routed exactly when analytics is enabled.
   - Migrations: `manage.py makemigrations --check --dry-run` with `CVAT_ANALYTICS=1` finds no model change without a migration. There is no database; a warning that it cannot reach one is expected.
10. If any check failed, prints which image `IMAGE` names now and exits. Nothing is tagged or saved.
11. Tags the built image as `IMAGE` and prints the summary line.
12. With `SAVE=1`, writes the archive in `<fork-root>`.
13. On every exit from the context step on (so not after a refusal in steps 1 to 4), removes the temporary tag and the temporary directory. The image itself goes only when no other tag names it. The build cache stays.

## Result

- `IMAGE` names the new image on the local Docker daemon. Nothing is pushed.
- Progress lines of the script (context, inputs, pulls, digests, the check headings) go to stderr, as does the output of `docker build`. The in-image checks print their `ok`, `WRONG` and `MISSING` lines, the `equal` policy lines and the Django line on stdout; a policy mismatch (`missing`, `DIFFERS`), tracebacks and Django's own warnings go to stderr.
- The last line on stdout of a successful build is:

```text
built <IMAGE> (<image id>) from the fork's tree in <seconds>s; every check passed; image size <bytes> bytes; base digests: BASE_IMAGE=<digest> RUST_IMAGE=<digest> GOLANG_IMAGE=<digest>
```

  Its fields: the image reference, the image id, the wall-clock time of the whole run, the image size in bytes, and the digest each base resolved to (all repo digests the daemon lists for it, separated by spaces; the image id when it lists none). Keep this line as the record of what was built from.
- With `SAVE=1`: an archive `<IMAGE with every ":" and "/" replaced by "-">.tar.gz` in `<fork-root>`, and the line `saved <name>.tar.gz` on stdout. The default `IMAGE` gives `cvat-server-v2.82.0-fork.tar.gz`. Load it on the other side with `docker load -i <name>.tar.gz`.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | The image passed every check and is tagged as `IMAGE` (and saved, with `SAVE=1`). |
| `1` | A refusal (`MAKE_JOBS`, upstream `Dockerfile` hash, missing base default, untracked or deleted files), no image id after the build, or a failed in-image check. |
| `130` | Interrupted (`INT` or `TERM`). |
| other non-zero | A command failed under `set -e`: the second `docker pull`, `docker build`, `git` (`128` when `<fork-root>` is not a git work tree), `docker tag` or `docker save`. The code is that command's. |

## Common errors

```text
MAKE_JOBS must be a positive integer, not '0'
```

`MAKE_JOBS` is `0`, negative, or not a number. Set it to `1` or more, or unset it.

```text
sha256sum: <fork-root>/Dockerfile: No such file or directory
```

Upstream's `Dockerfile` is missing from `<fork-root>` (exit `1`). Restore it: the script hashes it even though the image is built from `Dockerfile.server`.

```text
upstream's Dockerfile changed since Dockerfile.server was ported from it
  ported from sha256 <recorded>, the tree has <actual>
port the change into Dockerfile.server, then record the new hash in this script
(docs/maintainers/upstream-upgrade.md, step 3)
```

The `Dockerfile` in `<fork-root>` is not the one `Dockerfile.server` was ported from. The vendored tree is incomplete, mixed with another release, or the file was edited. Restore the `Dockerfile` of the [fork tree](../../GLOSSARY.md#fork-tree) you build. The fix the message names is for whoever maintains the fork tree, not for an install.

```text
Dockerfile.server: ARG BASE_IMAGE has no default, and BASE_IMAGE is not set in the environment
```

The same for `RUST_IMAGE` and `GOLANG_IMAGE`. `Dockerfile.server` lacks the `ARG <name>=<default>` line. Set the variable, or restore `Dockerfile.server`.

```text
these files are not tracked, so the image would lack them while the working tree has them:
  <path>
add them (git add) or remove them, then build again
```

A file under a copied path is in the working tree but not in the git index. Add it or remove it.

```text
these tracked files are missing from the working tree:
  <path>
restore them or remove them from the index (git rm), then build again
```

A tracked file under a copied path was deleted. Restore it, or remove it from the index.

```text
fatal: not a git repository (or any parent up to mount point <path>)
```

`<fork-root>` is not a git work tree (the script exits with git's code, `128`). The script reads the list of copied files from git, so the vendored tree must be a work tree in which those files are tracked. See [Requirements](../requirements.md).

```text
pulling base BASE_IMAGE: <reference>
  pull failed once; retrying (a slow TLS handshake to the registry)
```

The first pull failed. When the retry fails too, Docker's own error follows and the script exits with Docker's code. Check that the reference exists in your registry and that the daemon can log in to it, or set the base variable to a reference it can reach.

```text
this docker client predates --provenance: building without the flag
```

Not an error: the client is older than the `--provenance` flag, and the build goes on without it.

```text
the build produced no image id: nothing to check or tag
```

`docker build` returned success but the daemon reports no image for the temporary tag and wrote no image id. Nothing is tagged. Check the daemon and its image store, then build again.

```text
a check failed: this run's build <id> was not tagged and nothing was saved
```

One of the in-image checks failed; the lines above it on stdout and stderr name which:

| Line | Meaning |
| --- | --- |
| `missing  rules/<name>` or `DIFFERS  rules/<name> != tree:<path>` | The image's policy bundle lacks a policy, or holds one that differs from the file in `<fork-root>`. Rebuild after fixing the tree. |
| `NOT FILE`, `OUTSIDE`, `TWICE` | The bundle archive is malformed. |
| `MISSING  <program> is not on PATH`, `WRONG    <program> -> <path> (not the venv)` | A program does not resolve under `/opt/venv/bin`. |
| `WRONG    <program> is Python <version>` | `python` or `python3` is not 3.12: the base is not Python 3.12. |
| `WRONG    supervisord does not run: …`, `WRONG    nginx -t: …` | The program does not start or reject its configuration. |
| `MISSING  <file>:` followed by `not found` lines, then `WRONG    <n> shared objects scanned` | A library has an unresolved dependency. |
| `MISSING  no FFmpeg or OpenH264 library under /usr/lib` | The FFmpeg stage produced no libraries. |
| `CVAT_ANALYTICS=<0 or 1>: Team Analytics app installed: <bool>, its API routed: <bool>` with exit `1`, or a traceback | Django does not set up, or the app and its route do not follow the flag. |
| `makemigrations` output naming a model change | A model changed without a migration. |
 It is followed by one of:

- `no image is under <IMAGE>`: `IMAGE` names nothing.
- `<IMAGE> still names the earlier build <id>; this run did not check that build`: an earlier image is left under `IMAGE` unchanged.
- `<IMAGE> still names <id>, which is identical to this run's build and failed its checks`: the earlier image under `IMAGE` is the same image that just failed, so do not deploy it.

Fix the cause in the fork tree and build again.

## See also

- [Requirements](../requirements.md): tools, network endpoints and the contents of `<fork-root>`.
- [build-ui.sh](build-ui.md): the [UI image](../../GLOSSARY.md#ui-image).
- [verify/policy_bundle.sh](policy-bundle.md): the policy check the build runs, and how to check a running server.
