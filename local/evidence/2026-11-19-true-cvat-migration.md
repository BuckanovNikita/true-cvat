# Move of the fork to `true-cvat` with `main`, `develop` and `release`, 2026-11-19

Linear issue: [SIP-153](https://linear.app/sip-ds-team/issue/SIP-153/move-the-fork-to-true-cvat-with-main-develop-and-release).
Decision: [ADR 0009](../../docs/adr/0009-three-branches-in-a-github-fork-and-develop-rebased-onto-upstream.md).

## Source

- Upstream `v2.82.0`: `02bd74fde78e00f770b7dfc3c33761ad9ab00095`, read from `cvat-ai/cvat` with
  `git ls-remote` on 2026-11-19.
- `BuckanovNikita/cvat-fork`, `main` at `2558c2c7983aea8374610dc5eca39302e70b70d9` (the squash of
  PR 3, merged 2026-11-19), fetched on 2026-11-19. Its tree is `306afbaeb5579c495f6f2b6f817a9e89138058f2`.
- In the old clone the local tag `v2.82.0` names `b313362c3`, a copy of upstream's commit with the
  same tree and other parents, and the local `main` sits on that copy. Neither was used. The old
  clone and `cvat-fork` on GitHub were not changed.

## What was built

A new local repository, with upstream's history taken without blobs and `cvat-fork`'s `main` taken
whole. Every commit below reuses an existing tree; nothing was replayed or resolved.

`main` is `02bd74fde`. `develop` is five commits on it, each with the tree, author, author date and
message of the `cvat-fork` commit it stands for and a `Landed-as:` trailer naming it. One thing in
the messages differs: a subject that ended in a pull request number, `(#3)`, now names the
repository, `(BuckanovNikita/cvat-fork#3)`, because GitHub would link a bare number to this
repository's own pull requests:

| `develop` | `cvat-fork` | Landing |
| --- | --- | --- |
| `2b556d4d9dcf53330b20bb99af89d8a3f94602ff` | `f3a4a89fb44f61fa373c8689e38a2ebe8bae53b8` | the full-source fork with Team Analytics inside the backend |
| `01cd7b178cf1905e56bf423cdb57f8a040d3cc6d` | `2afbb331b48e4861e433b25d69e4aa10f0b44a7c` | Team Analytics for administrators with settings, the server image from public bases |
| `91eeb4f7639efcedd05f0dea1863f50d5163f0fc` | `529a95a5e41ca89e80c2b299152db211ed1fc6c2` | PR 1, the tracker moved to Linear |
| `eaafadf95b0413d0132b3a7af9d85df2ea8c7290` | `2eec034b50e7ce65d3a7ea25eb33e7b9ea8ba269` | PR 2, the second review pass on the Linear guidance |
| `37ab133ffbe5aa4a0086012d0225c06e7e255380` | `2558c2c7983aea8374610dc5eca39302e70b70d9` | PR 3, parameterised builds and the fork's two charts |

`release` is three merge commits on `main`. Each has the previous release as first parent and a
`develop` commit as second, and its tree is that commit's tree without `docs/evidence`,
`.scratch`, `INFRA_MIGRATION.md` and `verify/team-analytics-stack`, the four paths that this work
then moved into `local/`. Each carries an annotated tag:

| Tag | Tag object | Commit | Cut from `develop` | Files dropped |
| --- | --- | --- | --- | --- |
| `v2.82.0.1` | `1a66f6736c1cd938d495745ddf0c923ebfebdc63` | `97d66e862aa9aa19f0813f7cb987f82e0454fa0b` | `2b556d4d9dcf` | 215 |
| `v2.82.0.2` | `bf2cee8cca03312033aca0a4845c965c8f79ed4b` | `fc344215a704614d65bd0b26cc9d0a321d9c6cb2` | `01cd7b178cf1` | 239 |
| `v2.82.0.3` | `fbe50a5273919ffff41160d631fba227c9032e47` | `34dc29e62f96a70f48e546269b53e8d533e623a5` | `37ab133ffbe5` | 240 |

The three stage tags are the landings as they were. Their shipped documents therefore still
describe `cvat-fork` and the join by a merge, and link to the four dropped paths. The tip of
`release` stays so until the next release is cut from a `develop` that has this work.

## Checks on the bootstrap, all passed

Run on 2026-11-19 in the new repository, before any push.

- `main` names upstream's `v2.82.0` commit.
- `develop^{tree}` equals the tree of `cvat-fork` `main`; `main..develop` is five commits, none a
  merge, and `merge-base main develop` is `main`.
- Each `develop` commit has the tree, author and author date of the commit its trailer names.
- For each tag, `git diff --name-status <develop commit> <tag>` lists deletions under the four paths
  and nothing else, and none of the four paths is left in the tag's tree.
- `git diff --quiet` between `cvat-fork` `main` and `v2.82.0.3` over the shared set of ADR 0008:
  both Dockerfiles and the UI's ignore file, both build scripts, `.dockerignore`, `.yarnrc.yml`,
  `package.json`, `yarn.lock`, the backend entry points, `supervisord/`, `components/`, `cvat/`,
  the five frontend packages and both charts. No difference, and every path is present.
- `helm template` of `helm-chart/` and of `helm-chart-nuclio/`, extracted from `v2.82.0.3`, in a
  network namespace without a route: 59 and 13 objects. Two renders of the main chart differ in
  four lines, the Grafana subchart's generated admin password and the checksum over it.
- A search of the fork's added and changed files in each of the three release trees for
  `/mnt/wsl`, `k8s.docker.internal`, `docker-desktop`, `cvat-ta-it-`, `k8s-infra` and
  `infra-janitor`: three lines in `docs/fork-specification.md` in each tree, and nothing else.

## The branch `chore/sip-153-collect-local-files`

From `develop` at `37ab133ffbe5`. Its first commit, `d4ab4ba2b`, is 240 renames with no content
change. The later commits follow the files in shipped documents and in the stack's own files,
change `ruff.toml`, and add ADR 0009, `local/README.md`, `local/test-stack-on-a-shared-machine.md`
and this file. The moved records were not rewritten.

Checks on the branch, 2026-11-19:

- The shared set of ADR 0008 is identical to `develop`: no Dockerfile, build script, chart or
  vendored source file changed.
- ruff, by the hook's own command: passed. It reads 95 files, the same number as in the old layout.
- The moved stack: `bash -n run.sh`, `node --check` on its four `.cjs` files and `py_compile` on its
  fourteen Python files passed. From its new place `run.sh` and `fixes_run.py` still resolve the
  repository root, two levels up as before.
- The documented "Cut a release" commands, run as written in a scratch clone with this branch as
  `develop`: a commit with two parents, the old `release` and `develop`; its difference from
  `develop` is 242 deletions, all under `local/`; `helm template` of both charts from the result
  renders 59 and 13 objects without a network. The same search for machine references over the
  fork's added and changed files of that tree found nothing.
- The first run of those commands failed, and the procedure was corrected before this record:
  `git rm` without `-f` refuses files whose staged content differs from `HEAD`, and left `local/`
  in the commit.
- Relative links and heading anchors of the changed and added Markdown files resolve.

The check pipeline, `prek run --all-files`, on the working tree of the branch: all twelve hooks
passed, in two runs. In the first run ten passed (ESLint, stylelint, the type check, ruff, black,
isort, the two policy tests, upstream's generated policy suite, the task progress suite) and the
two jsdom suites failed on "Cannot find module '../build/Release/canvas.node'". The cause was the
run's own setup: `verify/node_modules` was a symbolic link to the old clone's directory, and the
harness's guard against the root `canvas` package does not see through a link. After
`npm ci --prefix verify` in this repository the two suites, and the task progress suite again,
passed by `prek run <hook> --all-files`. The root `node_modules` was a symbolic link to the old
clone's throughout; `yarn.lock` is identical in both. The task progress suite ran without
`BROWSER_BIN`, so its browser check was skipped, as in the pipeline's default. The pipeline ran
before the review's fixes, which changed Markdown files only; ruff and `git diff --check` were run
again on the committed tip and passed.

## The upgrade and release procedures in a sandbox

The command blocks of the upgrade procedure's sections 1, 2 and 5 and of "Cut a release" were
extracted from the committed document and run as written on 2026-11-19, with two literals replaced
(the example release and the example stage). The sandbox was a throwaway clone with throwaway bare
repositories as `origin`, holding this branch as `develop`, and as `upstream`, holding a made-up
later release: upstream's `v2.82.0` tree plus one file. All of it was deleted afterwards.

- The start points were recorded as `refs/upgrade/base` and `refs/upgrade/start`, and the rebase
  replayed the fork's commits onto the made-up release with no conflict and no merge commit.
- A commit was then put on `origin`'s `develop`. The push block stopped at its check, moved neither
  branch and kept the two refs. The cherry-pick block took the commit and advanced
  `refs/upgrade/start`. The push block then moved `main` to the release and `develop` to the
  upgrade branch together; `develop` kept the landed commit, has no merge, and the refs were removed.
- The release block with a commit hook that fails: it stopped before the tag, nothing was pushed,
  and a rerun without backing out stopped as well. After `git merge --abort` and without the hook it
  cut the release: two parents, the old `release` and the published `develop`; a difference from
  `develop` of deletions under `local/` only; the branch and the tag on `origin` at the same commit.
- The block again with the same stage stopped on the existing tag. With the next stage and nothing
  new on `develop` it stopped too, and made no tag.

Not covered by this: a real later release, with its conflicts, and a push to GitHub.

## Independent review

Two fresh reviewers read the branch against the owner's requirements, without the author's
conclusions. Neither found a defect in product code; every finding was in the new procedures and
their wording, and all are closed in the branch.

The first read the whole branch. It confirmed the pure renames, the untouched shared set, the
unchanged versions, the stack's path derivations at its new place and ruff's unchanged coverage,
and found nine defects:

- High: after the documented pushes the local `main` and `develop` stayed behind, so a release cut
  that followed, and the next upgrade's rebase, would have used the old commits.
- Medium: the lease value was read just before the push and so guarded nothing, and the two pushes
  could leave `main` moved without `develop`.
- Medium: the search for the old release number excluded all of `local/` and so skipped the stack,
  which the text says it finds; it now excludes the records only.
- Medium: this file was not yet committed while three documents linked to it.
- Low: missing preconditions in "Cut a release"; leftover "merge" wording in the upgrade
  procedure's section 3 heading, the specification and ADR 0003; a contradiction about
  `Dockerfile.ui` in the specification; the stack's README citing ADR 0005; three delta commands
  with different exclusions.

The second read only the rewritten sections 1, 2 and 5 and "Cut a release", and reproduced its
findings in a synthetic repository:

- High: the start points were shell variables. Setting them again in a new shell, or after a
  cherry-pick that failed, made the lease pass and replaced `develop` without a commit that had
  landed on it. They are now two refs in the clone, advanced only by a command chained to a
  successful pick.
- High: the release block had no stop on error. A failed `git switch` committed the release on
  `develop` and published the tag; a cut with nothing new put a second tag on the old release. The
  block is now one chained command with the checks as conditions, starts `release` from the
  published one, refuses an existing tag and an empty cut, and says how to back out.
- Medium and low: the wrong merge named as the "nothing to cut" signal; inventory commands that
  read local branches; `git branch -f` failing on a checked-out branch or dropping local commits;
  a branch and tag pushed separately; checks that did not stop a pasted block.

The fixes for both passes were exercised by the sandbox run above. They were not reviewed a third
time.

## Not run, and why

- The test stack. `run.sh render` stops with "the import's chart directory holds a Chart.lock or
  charts/; the lock is the stack's own". PR 3 committed both, and the stack's chart build refuses
  them. The same command fails the same way in `cvat-fork` at `526a4069d` with the stack at its old
  path, so the move did not cause it. No subcommand that builds the chart can run, `preflight`
  and `up` included. Recorded as
  [SIP-154](https://linear.app/sip-ds-team/issue/SIP-154/the-test-stack-refuses-the-chart-since-its-dependencies-were-committed).
- The image builds, the calculation tests against ClickHouse and the policy bundle check. No file
  they read changed.
- A rebase of `develop` onto a real later release. The commands ran against a made-up one (above).

## Limits

- Lazily fetched blobs came over SSH (`url."git@github.com:".insteadOf`): HTTPS to GitHub delivered
  about 5 MB in nine minutes on this machine on this day.
- The links from shipped documents into `local/` do not resolve on `release`. That is by design
  (ADR 0009) and is stated in `README.fork.md` and the specification.

## Remote state

`BuckanovNikita/true-cvat` was created on 2026-11-19 as a public GitHub fork of `cvat-ai/cvat` with
its default branch only. GitHub made it with a copy of upstream's `develop` at `a86931299939` and no
tags. In this order:

- Actions was disabled before the first push, because `main` carries upstream's workflows. Read
  back afterwards: disabled, and no workflow run exists.
- `main` and upstream's tag `v2.82.0` were pushed as new names.
- `develop` replaced the copied upstream branch with `--force-with-lease` naming that copy's
  commit. This is the one forced push of the bootstrap.
- `release` and the three stage tags were pushed together.
- Merge commits were switched off for pull requests; squash and rebase stay. `develop` is the
  default branch.

`git ls-remote origin` afterwards names the same commits and tag objects as the tables above.
This branch is delivered as a pull request against `develop` in `BuckanovNikita/true-cvat`; the
checks above ran before the fork existed, on the same commits' trees. The commits were rebuilt once
before the push, to write the pull request numbers in three subjects with their repository; the
tree and ancestry checks were repeated on the rebuilt commits and passed, and the check pipeline
and the sandbox run were not, since no tree changed.
