# verify/policy_bundle.sh

`verify/policy_bundle.sh` reads the [policy bundle](../../GLOSSARY.md#policy-bundle) of a [fork server image](../../GLOSSARY.md#fork-server-image) or of a running server and compares its issue, comment and Team Analytics policies, byte for byte, with the files of the [fork tree](../../GLOSSARY.md#fork-tree). Run it after an install or an upgrade to confirm that the server enforces the policies you built. `build-server.sh` runs it on every build itself.

The policy bundle is the archive of authorization rules that the CVAT server builds from its `rules/*.rego` files and serves to its policy engine. The fork changes two of them (`issues.rego` and `comments.rego`) and adds a third (`team_analytics.rego`) when [analytics](../../GLOSSARY.md#analytics) is enabled.

## Examples

Check the bundle of an image before you deploy it:

```bash
cd <fork-root>
verify/policy_bundle.sh from-image registry.example.com/cvat/server:<tag> | verify/policy_bundle.sh check
```

Check the same image as it runs with analytics enabled:

```bash
verify/policy_bundle.sh from-image registry.example.com/cvat/server:<tag> analytics | verify/policy_bundle.sh check-analytics
```

Check the bundle that a running server serves:

```bash
curl -s https://cvat.example.com/api/auth/rules | verify/policy_bundle.sh check
```

## Syntax and inputs

```text
verify/policy_bundle.sh from-image IMAGE [analytics] | check [REF] | check-analytics
```

| Input | Default | Description |
| --- | --- | --- |
| `from-image` | | Subcommand: writes the bundle of an image to stdout. |
| `check` | | Subcommand: reads a bundle on stdin and compares the issue and comment policies. |
| `check-analytics` | | Subcommand: reads a bundle on stdin and compares the issue, comment and Team Analytics policies. |
| `IMAGE` | (required) | Image reference for `from-image`. |
| `analytics` | not set | Optional third argument of `from-image`: builds the bundle as a server with analytics enabled does. |
| `REF` | the files on disk | Optional argument of `check`: a git tag or commit whose policy files are the expected ones. `check-analytics` takes no `REF` and ignores extra arguments. |

The script finds the fork tree from its own location (the directory above `verify/`), so you can run it from any directory.

What it needs: `bash`, `python3`, `tar`, `cmp` for the checks; `docker` and the image for `from-image`; `curl` to fetch a served bundle; `git` and a git work tree that has `REF` for `check REF`.

The usage messages print the script path as you typed it (`verify/policy_bundle.sh`, `./verify/policy_bundle.sh`, an absolute path).

A pipeline `from-image ... | check` has the exit code of `check` alone, unless your shell has `pipefail` set (`set -o pipefail` in bash). Without it, a failed `from-image` shows only as `check` refusing an empty or unreadable archive.

## How it works

### from-image

Prints the policy bundle that a server started from `IMAGE` would serve, as a gzipped tar archive on stdout.

1. Starts a one-off container: `docker run --rm --network none --cpus=1`, working directory `/opt/cvat`, entrypoint `/opt/venv/bin/python`. With `analytics`, the container also gets `CVAT_ANALYTICS=1`.
2. Inside it, sets up Django with `cvat.settings.production` and writes the bytes of the server's own bundle builder (`get_opa_bundle`) to stdout. This is the same code that answers `/api/auth/rules`. It packs every `*.rego` file (except `*.gen.rego`) of every installed app's `rules/` directory under `rules/<name>`.
3. The container is removed. `--network none` applies to the container only: if `IMAGE` is not present locally, `docker run` first tries to pull it (`Unable to find image '<IMAGE>' locally`). In a closed network, load the image before you run the script.

Without `analytics`, the Team Analytics app is not installed and its policy is not in the bundle.

### check

Reads a bundle on stdin and compares `rules/issues.rego` and `rules/comments.rego` with the fork tree.

1. Saves stdin to a temporary directory (removed on exit).
2. Checks the archive's listing before anything is extracted (see [Listing checks](../../GLOSSARY.md#listing-checks)). Any problem stops the script with exit code `1`.
3. Extracts the archive.
4. Takes the expected files:
   - without `REF`: `cvat/apps/engine/rules/issues.rego` and `cvat/apps/engine/rules/comments.rego` of the fork tree, as the files are on disk (no git is used);
   - with `REF`: the same paths as `git show REF:<path>` gives them. Use `check v2.82.0` to compare a bundle with the stock upstream policies; this needs a git work tree that has the tag `v2.82.0`.
5. Compares each expected file with `rules/<name>` in the bundle using `cmp` and prints one line per file.

A fork server image or a fork server is expected to pass `check` without `REF`. Against `v2.82.0` it prints `DIFFERS` for both files, because the fork changes both.

### check-analytics

Reads a bundle on stdin and compares `rules/issues.rego`, `rules/comments.rego` and `rules/team_analytics.rego` with `cvat/apps/engine/rules/issues.rego`, `cvat/apps/engine/rules/comments.rego` and `cvat/apps/team_analytics/rules/team_analytics.rego` of the fork tree on disk. It takes no `REF`.

Use it for the bundle of `from-image IMAGE analytics`, or of a running server where analytics is enabled. A bundle built without analytics prints `missing  rules/team_analytics.rego` and exits with `1`. The bundle of a server with analytics also passes `check`, which does not look at the Team Analytics policy.

The same steps as `check`, with the three files above, always from the files on disk.

### Listing checks

Before comparing, `check` and `check-analytics` refuse an archive that:

| Message (stderr) | Cause |
| --- | --- |
| `not a readable bundle archive: <reason>` | stdin is not a gzipped tar archive (for example an HTML error page, an empty answer, a wrong URL). |
| `NOT FILE <name> (link: only regular files and directories are read)` | an entry is a symbolic or hard link. |
| `NOT FILE <name> (other: only regular files and directories are read)` | an entry is a device, FIFO or another non-regular type. |
| `OUTSIDE  <name> (leaves the bundle)` | an entry name resolves above the archive root (`../`). |
| `TWICE    <name> (<count> entries of one name)` | two file entries are one name once normalised (`a` and `./a`, or `b/c` and `b//c`); extraction would keep only the last. |

Every problem found is printed; then the script exits with `1`.

### Checking a running server

The server serves its bundle at `GET /api/auth/rules` as `application/x-tar`. The endpoint needs no authentication. It is the bundle the server built when its process started; the server caches it, so after you deploy a new image, restart the backend before you check.

```bash
curl -s https://cvat.example.com/api/auth/rules | verify/policy_bundle.sh check
# with analytics enabled:
curl -s https://cvat.example.com/api/auth/rules | verify/policy_bundle.sh check-analytics
```

The comparison is with the `<fork-root>` on the machine where you run the script: use the fork tree of the [stage tag](../../GLOSSARY.md#stage-tag) that is deployed.

### How the build uses it

`build-server.sh` runs, against its temporary tag, `from-image <tag> | check` and `from-image <tag> analytics | check-analytics`. If either fails, the build fails and the image is not tagged. See [build-server.sh](build-server.md).

## Result

`from-image` writes the bundle, a gzipped tar archive, to stdout: redirect it to a file or pipe it into `check` or `check-analytics`. `check` and `check-analytics` print one line per policy file, `equal` on stdout and `DIFFERS` or `missing` on stderr:

```text
equal    rules/issues.rego = tree:cvat/apps/engine/rules/issues.rego
DIFFERS  rules/comments.rego != v2.82.0:cvat/apps/engine/rules/comments.rego
missing  rules/team_analytics.rego
```

| Line | Meaning |
| --- | --- |
| `equal` | The bundle file is byte for byte the expected file. `tree` means the files on disk; otherwise the `REF` is printed. |
| `DIFFERS` | The bundle file differs from the expected file. |
| `missing` | The bundle has no such file under `rules/`. |

### Exit codes

| Subcommand | Exit code | Meaning |
| --- | --- | --- |
| any | `2` | No subcommand or an unknown one, or the third argument of `from-image` is something other than `analytics`. |
| `from-image` | `0` | The bundle was written. |
| `from-image` | `1` | `IMAGE` is missing (see Common errors). |
| `from-image` | other | The exit code of `docker run`: `125` when docker cannot start the container (for example the image is absent and cannot be pulled), or the exit code of the Python process inside the image. |
| `check`, `check-analytics` | `0` | Every file is `equal`. |
| `check`, `check-analytics` | `1` | A file `DIFFERS` or is `missing`, or a listing check refused the archive. |
| `check` | `128` | `git show` failed: `REF` does not exist, or `<fork-root>` is not a git work tree. `check-analytics` uses no git and never gives `128`. |

## Common errors

| Message | Cause | Fix |
| --- | --- | --- |
| `usage: verify/policy_bundle.sh from-image IMAGE [analytics] \| check [REF] \| check-analytics` | No subcommand or an unknown one. Exit code `2`. | Give one of the three subcommands. |
| `verify/policy_bundle.sh: line <n>: 2: usage: verify/policy_bundle.sh from-image IMAGE [analytics]` | `from-image` without `IMAGE`. Exit code `1`. | Add the image reference. |
| `usage: verify/policy_bundle.sh from-image IMAGE [analytics]` | The third argument is not `analytics`. Exit code `2`. | Use `analytics` or nothing. |
| `Unable to find image '<IMAGE>' locally` followed by a pull error | `IMAGE` is not present locally and cannot be pulled. Exit code `125`. | Load or pull the image first, or fix the reference. |
| `not a readable bundle archive: not a gzip file` (`empty file` when stdin is empty) | stdin is not a bundle: the `from-image` step failed, or `curl` got an error page or nothing. | Run the first part of the pipeline alone; for `curl`, check the URL and add `-f` to see HTTP errors. |
| `DIFFERS  rules/issues.rego != tree:cvat/apps/engine/rules/issues.rego` | The image or server runs other policies than the fork tree, or the server still serves the bundle of the previous image. | Compare with the fork tree of the deployed stage tag; rebuild the image; restart the backend. |
| `missing  rules/team_analytics.rego` | `check-analytics` on a bundle without analytics. | Use `check`, or `from-image IMAGE analytics`. |
| `fatal: invalid object name '<REF>'.` | `REF` is not in the git work tree, or `<fork-root>` is not a git work tree. Exit code `128`. | Make the tag available in the work tree, or run `check` without `REF`. |

## See also

- [build-server.sh](build-server.md)
- [Access](../access.md): what the issue and comment policies allow
- [Upgrade and rollback](../scenarios/upgrade-and-rollback.md)
- [Glossary](../../GLOSSARY.md)
