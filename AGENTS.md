# Agent instructions

## Purpose and layout

`BuckanovNikita/true-cvat` is a GitHub fork of `cvat-ai/cvat` (upstream v2.82.0). It adds per-stage/state task progress (UI-1, UI-2), wider organization issue/comment permissions (IAM-1), admin-only organization creation (IAM-2), the Team Analytics page inside the backend (TA-1), and its own server and UI images and two Helm charts (BUILD-1). Details, decisions and procedures: [DOCS.md](DOCS.md). Russian overview: [README.fork.md](README.fork.md).

- Branches: `main` = the upstream release, nothing else (fast-forward only); `develop` = default branch, base of every task branch, linear fork commits rebased onto `main`, no merge commits; `release` = `develop` without `local/`.
- Fork code: `cvat/apps/team_analytics/` (backend app), `cvat-ui/src/components/team-analytics-page/`, `cvat-ui/src/utils/team-analytics-logging/`, `cvat-ui/src/utils/task-jobs-summary.ts`, `cvat-ui/src/components/tasks-page/task-jobs-progress.tsx`; policies `cvat/apps/engine/rules/{issues,comments}.rego`.
- Build surface: `Dockerfile.server`, `build-server.sh`, `build-ui.sh`, `Dockerfile.ui.dockerignore`, `helm-chart/`, `helm-chart-nuclio/`.
- Checks: `verify/` (policy tests, bundle check, frontend suites, backend calculation tests in `verify/team-analytics-backend/`), `tools/gate/` (UI lint wrapper, node-suite runner, uv project pinning ruff/black/isort), `ruff.toml`.
- `local/`: machine-specific material, on `develop` only: the Kubernetes test stack `local/team-analytics-stack/`. Code and shipped docs must not depend on `local/`.
- Everything else is upstream's.

## Environment setup

- Needs `uv`, `python3`, Node, Docker on PATH; network on first run (uv fills `tools/gate/.venv` from `tools/gate/uv.lock`; Docker pulls the OPA image named in `verify/policy_test.sh`).
- Add the upstream remote without a fetch refspec, then fetch the tag the fork is on (the checks compare with it; `main` must name the same commit):
  `git remote add upstream https://github.com/cvat-ai/cvat.git && git config --unset-all remote.upstream.fetch && git fetch --filter=blob:none --no-tags upstream refs/tags/v2.82.0:refs/tags/v2.82.0`.
  Never force-update an existing release tag; investigate one that names another commit.
- `DISABLE_HUSKY=1 yarn install --immutable` at the root, then `npm ci --prefix verify` (jsdom for the Team Analytics suites). A `verify/node_modules` symlinked from another clone breaks the jsdom suites on `canvas.node`; rerun `npm ci --prefix verify`.

## Checks

There is no CI (upstream's `.github/` is deleted; GitHub Actions is disabled). Run from the repo root and record outcomes in the Linear issue and the PR: source revision, environment, checks run and their outcomes, exclusions, remaining limits. Required verification that is deferred blocks merge readiness. Confirm a GitHub check, branch protection or Linear automation exists before relying on it.

```bash
tools/gate/ui-lint.sh eslint
tools/gate/ui-lint.sh stylelint
node node_modules/typescript/bin/tsc -p cvat-ui/tsconfig.json
env RAYON_NUM_THREADS=1 uv run --project tools/gate --locked --only-group lint ruff check
uv run --project tools/gate --locked --only-group format black --check --quiet cvat/apps/team_analytics cvat/settings/base.py cvat/urls.py
uv run --project tools/gate --locked --only-group format isort --check --quiet cvat/apps/team_analytics cvat/settings/base.py cvat/urls.py
verify/policy_test.sh
verify/policy_test.sh stock
verify/policy_generated.sh
tools/gate/node-suite.sh --may-start-browser verify/task_progress.cjs
tools/gate/node-suite.sh verify/team_analytics_logging.cjs
tools/gate/node-suite.sh verify/team_analytics_page.cjs
```

- Run them one after another; none rewrites files. `ui-lint.sh` lints only UI files that differ from `UPSTREAM_TAG` (default `v2.82.0`) with `--max-warnings 0`; `ruff` covers only the paths in `ruff.toml`.
- Out of band (need Docker and built images): `SERVER_IMAGE=cvat/server:v2.82.0-fork verify/team_analytics_backend.sh`; `verify/policy_bundle.sh from-image <image> | verify/policy_bundle.sh check` (and `... analytics | ... check-analytics`); `BROWSER_BIN=<chrome> node --test verify/task_progress.cjs`; the live stack `local/team-analytics-stack/run.sh cycle`.
- Run frontend suites only through `tools/gate/node-suite.sh` (8 GiB address-space limit `NODE_SUITE_MEMORY_KB`, 60 s per test `NODE_SUITE_TEST_TIMEOUT_MS`). An unbounded jsdom assertion on a mounted element once exhausted the machine's memory: compare elements as booleans and run ad-hoc code under a memory cap and a time limit.
- Never run `--fix` or a formatter on upstream files. Upstream's Django/REST suites are not fork checks (`tests/python/rest_api/test_issues.py` encodes the stock policy and disagrees with IAM-1).

## Hard constraints

- Never edit upstream's `README.md`, `Dockerfile`, cvat-core, cvat-canvas or other UI packages besides `cvat-ui`. Fork text goes to `README.fork.md`.
- Edits to upstream files are wiring only; append fork blocks at the end of `cvat/settings/base.py`, `cvat/urls.py`, `.gitignore`. Review the delta with `git diff --name-status main develop -- . ':!local' ':!verify' ':!tools' ':!helm-chart-nuclio'`.
- Keep upstream's `.github/` deleted (`git rm` any file a release adds or changes there); never enable GitHub Actions.
- `issues.rego`/`comments.rego` = the release's stock file plus exactly the two additions marked `# Local patch (role floor):`; their test CSVs only add rows. Check with `git diff <tag> HEAD -- cvat/apps/engine/rules`. Never copy an old policy wholesale.
- Team Analytics API process never queries ClickHouse nor imports `core/` or worker jobs: access check, Redis cache, else queue to the `team_analytics` worker and reply 429. `core/` names neither Django nor callers; every SQL statement lives in `cvat/apps/team_analytics/sql/`; no new Python dependency (`cvat/requirements` is upstream's); `cvat/schema.yml` and the SDK do not change.
- Team Analytics is for administrators (`admin` group) only: page, API and settings.
- Never add a client event type or scope (ADR 0002). Event names live in both `contract.ts` and `sql/` and change together. A new upstream event type, scope, call site or shortcut action needs an explicit decision on whether it is an operation: a rename breaks figures silently.
- No Team Analytics page or API address may start with `/analytics` (Grafana). A Team Analytics failure must not affect annotation or other CVAT functions.
- The Team Analytics page is in Russian only (ADR 0010): every user-visible string in `cvat-ui/src/components/team-analytics-page/` is Russian, numbers and dates go through its `format.ts`, a word next to a count through `plural.ts`; no translation library, no language switch. `verify/team-analytics-page/russian.test.cjs` guards it: never allowlist page text there.
- Team Analytics UI wording follows the domain terms in DOCS.md; changing a term updates `definitions.tsx`, `creation-methods.ts`, `settings-modal.tsx` and their tests together.
- A new upstream `JobStage`/`JobState` value needs handling in `cvat-ui/src/utils/task-jobs-summary.ts`.
- Every closed-network build input is a Dockerfile ARG with a public default, read from the environment by the build script and passed only when set. No fork Dockerfile starts `FROM` a `cvat/` image. Never commit corporate hosts, registry paths or credentials: the repository is public.
- Renaming a value in either chart's `values.yaml`, a downstream-vendored file or a build arg is a breaking change; coordinate it with the downstream repository (list in DOCS.md).
- `build-server.sh` refuses an unported upstream `Dockerfile`: port the change into `Dockerfile.server`, then update `PORTED_FROM_SHA256` (DOCS.md, Upstream upgrade step 3).
- Rebuild the server image whenever a policy or the Team Analytics app changes and on every upgrade; restart the backend on it (a running server caches its OPA bundle).
- Kubernetes is the only target (ADR 0003); Compose is unsupported and upstream's Compose files stay untouched.

## Decisions that bind code

ADR 0002 (no new event types), ADR 0003 (Kubernetes only), ADR 0006 (Team Analytics in the backend, reads on a worker), ADR 0007 (public bases, Debian 12 server image), ADR 0008 (downstream compatibility surface), ADR 0009 (three branches), ADR 0010 (the Team Analytics page is in Russian only). Superseded: 0001, 0004, 0005. Spec ids UI-1, UI-2, IAM-1, IAM-2, BUILD-1, TA-1. One line each in DOCS.md, "Decisions".

## Release and delivery

- Issues, specs, plans and status live in Linear, team `SIP`, project `true-cvat`; cite as `SIP-NN`; search before creating. This project is what a skill calls the issue tracker: pass `team: SIP` and `project: true-cvat` on every issue create and list. Create an issue with an explicit `state`: `In Progress` for work that starts now, otherwise the status of its triage role.
- The Linear status is the triage role. Where a skill names a role, set the status:

  | Role              | Status                                | Meaning                 |
  | ----------------- | ------------------------------------- | ----------------------- |
  | `needs-triage`    | `Triage`, no `ready-for-human` label  | Maintainer evaluates    |
  | `needs-info`      | `Backlog`                             | Waiting on the reporter |
  | `ready-for-agent` | `Todo`                                | Specified for an agent  |
  | `ready-for-human` | `Triage` + label `ready-for-human`    | Human implements        |
  | `wontfix`         | `Canceled`, after a comment says why  | Will not be actioned    |

  `ready-for-human` is the only role with a label; remove it when the issue leaves the role. An issue with no role yet goes to `Triage`. `In Progress`, `In Review`, `Done` and `Duplicate` are past triage. Category roles are labels: `bug` = `Bug`, `enhancement` = `Feature`.
- A feature is a parent issue with sub-issues; blocked-by relations override readiness. In Review when implementation and its checks are ready; Done after the merged PR reaches `develop`.
- Work on a task branch from `develop`; push only the task branch; open the PR with `gh pr create -R BuckanovNikita/true-cvat --base develop` and check that the PR URL names true-cvat (a fork PR defaults to `cvat-ai/cvat`). Humans merge by squash or rebase.
- Never push `main`, `develop`, `release` or a tag, never merge locally to deliver, never use GitHub's "Sync fork". Upstream upgrades and release cuts follow DOCS.md and need the owner's word for each push. Publishing an image and deploying each need their own authorization.
- Stacked PRs: record grouping in Linear; each descendant targets its parent branch; `--force-with-lease` only on task-owned branches.
- PR texts, commit messages and the repository are public; Linear is private. Check output is not redacted (a failure prints absolute local paths): summarise it, never paste it raw into PRs or commits.

## Pitfalls

- Each concurrent stack needs its own `TA_RUN_ID` and reserved `TA_HOST_PORT` on every command, or `up`/`down` from another checkout hits the default stack. Clean up only what a run created.
- Never run upstream's Kubernetes test mode against a shared cluster: it flushes databases in the current kube context's namespace.
- The local Kubernetes test infrastructure is shared; its operating guide is the AGENTS.md and DOCS.md of the k8s-infra repository. Never reuse foreign namespaces; keep the stack in its own namespace with quota and teardown.
- Upstream's chart Grafana with analytics enabled grants Admin to every visitor without sign-in.
- Two UI orderings no suite sees: `groupMoved` is called before the first await of the `canvas.groupmoved` handler; frames change only through `changeFrameAsync`.
- `CLAM_AV=yes` and `CVAT_DEBUG_ENABLED=yes` server builds have never been built.
- A bare "ticket NN" in comments names the retired local tracker (DOCS.md, History), not Linear.

## Language standards

- Python: follow upstream's black/isort settings (root `pyproject.toml`, line length 100) and the ruff selection in `ruff.toml`; omit `from __future__ import annotations`; keep syntax within the declared Python floor.
- Use explicit typing; catch specific exceptions at a boundary that can handle them and preserve the cause; never swallow unexpected failures.
- Preserve public imports, CLI output and exit codes, configuration precedence and persisted-data compatibility; add layers only for real responsibilities.
- Python tools run via `uv run --project tools/gate --locked`; change their pins with `uv add`/`uv lock` in `tools/gate/`, never by hand.
- TypeScript/SCSS: upstream's ESLint and stylelint configuration; warnings are failures; no blanket suppressions to get a pass.
- Cleanup: trace consumers before removing code; keep dependency pins; keep each change one behavior-preserving argument.

## Working agreement
- At the start of work, state the worktree path, the current branch and its relation to the default branch; say when remote refs were not fetched.
- Inspect existing and staged changes before editing. Preserve unrelated work and local overrides; stage only task-owned paths and inspect the staged diff.
- Report what each executed check establishes and what remains unverified; distinguish mocked checks, live outcomes and historical evidence. Clean up task-owned processes and temporary resources.
- Tests must exercise product code, never project tooling.
- Changes to behavior, interfaces, dependencies, security or operational policy need a fresh independent review after integration and verification. Small wording edits may be self-reviewed.
- Split large work into independent delegated tasks with explicit write ownership and acceptance evidence; delegated agents do not delegate further.
- Use Conventional Commits. Commit automatic formatting separately from logic. Local commits within the task scope need no approval.
- README.md is Russian; AGENTS.md and DOCS.md are English. Keep observed counts, timings and deployment status out of both files.
- Keep machine-specific paths, endpoints and settings in local configuration, not in these files.
