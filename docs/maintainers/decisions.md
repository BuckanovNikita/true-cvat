# Decisions and specification ids

The architecture decisions that bind code, and the fork's specification ids.

## Decisions

### ADR 0001
Thin separate analytics service with stored totals. Superseded by ADR 0006; its figure rules stay (calculations are SQL over stored hourly totals; session gap and idle pause fixed at computation time, so changing them means recomputing history).
### ADR 0002
New measurements ride inside existing event types: never add an event type or client scope (one unknown scope makes the server reject the whole batch and the client resends forever); extra payload fields or `debug:info` records told apart by name; every logging call guarded, fire-and-forget, logged through the job with project/task/job ids.
### ADR 0003
Kubernetes only, with the in-tree upstream Helm chart; Compose unsupported (it starts no Team Analytics worker), upstream Compose files stay untouched. Test infrastructure runs in its own namespace with ResourceQuota and LimitRange.
### ADR 0004
Server image adding only the patched policies over the stock image. Superseded by ADR 0007.
### ADR 0005
Full-source fork joined to upstream by one merge. Superseded by ADR 0009.
### ADR 0006
Team Analytics inside the backend (`cvat/apps/team_analytics/`), behind CVAT's OPA permissions; the API process does no analytical work (access check, Redis cache, else queue to the `team_analytics` worker and reply 429 with `Retry-After`); one worker Deployment of the fork server image runs reads and the periodic refresh; endpoints excluded from `cvat/schema.yml` and the SDK. Rejected: Grafana queries (per-user flag exposes all orgs), a second API server routed by path, queries in the API process with limits.
### ADR 0007
Images from public bases; the server image is `Dockerfile.server`, a stage-for-stage port of upstream's `Dockerfile` to Debian 12 on `python:3.12-slim-bookworm`; no fork Dockerfile starts `FROM` a `cvat/` image; base defaults are public `tag@digest` references, but a digest is not required (mirrors re-push with other digests, so a plain tag is accepted); `build-server.sh` logs the digest each base resolved to. Deviations: Debian 12 packages (nginx 1.22, older git/poppler/OpenLDAP), `unrar` from non-free enabled only while installing, a Debian Python 3.11 in `/usr/bin` used only by supervisord.
### ADR 0008
The fork is the original for two repositories: a downstream repository vendors the build set and both charts. Renaming a chart value, a vendored file or a build arg is breaking and must be coordinated downstream. Every closed-network input is a Dockerfile ARG with a public default; no corporate hosts or credentials in the repository (it is public).
### ADR 0009
Three branches in a GitHub fork, `develop` rebased onto each upstream release; never use GitHub's "Sync fork". `BuckanovNikita/cvat-fork` is the frozen earlier history; `develop` commits carry `Landed-as:` trailers naming cvat-fork commits.

### ADR 0010
The Team Analytics page is in Russian only, by the owner's decision of 2026-11-21: Russian replaces English in the page's own files (`cvat-ui/src/components/team-analytics-page/`), with no language switch, no translation library and no stored language preference; the rest of CVAT stays English. No dependency is added (`package.json` and `yarn.lock` are in the downstream-vendored set, ADR 0008) and no upstream file is edited. Numbers, durations and dates go through the page's `format.ts` and plural forms through `plural.ts` (`Intl.PluralRules`); neither reads the browser's language. Keys in the page address and in service requests are unchanged. Left in English: the header link "Team Analytics", hotkey names from upstream's keymap and the server's refusal reasons. Rejected: both wordings in a dictionary with the language taken from the browser (every string and test twice); the same with a switch on the page (a control and a stored preference on top); a translation library with antd's `ConfigProvider` at the application root (a new dependency and an edit to upstream's `index.tsx`). An English page later means bringing back a second wording: a new decision.

### Fork specification ids
- **UI-1** task job summaries: after a task-list fetch, one `cvat.jobs.get` with filter `task_id in [...]` in aggregate mode (none for an empty list); counts by task, stage, state in `tasks.jobsSummary.data`; applied only if its task-fetch timestamp is current; failure falls back to upstream's widget; no polling. New upstream `JobStage`/`JobState` values need handling in `cvat-ui/src/utils/task-jobs-summary.ts`.
- **UI-2** palette (new / in progress / completed / rejected): annotation `#c1c1c1`/`#faad14`/`#fafe01`/`#ff4136`; validation `#b4dafd`/`#1890ff`/`#00478a`/`#ff4136`; acceptance `#b3ff66`/`#b3ff66`/`#61c200`/`#ff4136`; gray `#c1c1c1` "not available" = `max(0, total - fetched)`, last. Labels `<stage> / <state>`; flex weight = count; bar full width, 6 px, min segment 2 px.
- **IAM-1** `issues.rego`/`comments.rego` = stock plus two additions marked `# Local patch (role floor):` (allow same-org members with `utils.has_perm(utils.WORKER)`, no scope whitelist; unrestricted list filter via `utils.add_organization_filter`). Below the floor decisions equal stock; no access for nonmembers, removed members, other orgs or the sandbox. New upstream scopes are granted automatically, so review them on upgrade. Keep upstream's prefix Q-expression filter contract, the `org_filter_proof` marker, and the distinction between an explicitly selected sandbox and an unspecified organization context (they changed between releases; an old policy copied wholesale can restore an isolation bug). `verify/opa_issues_test.rego` is the only test of the patched list filter (upstream's generated tests do not reach it).
- **IAM-2** `ORGANIZATIONS_MIN_ROLE_TO_CREATE = "admin"` appended to `cvat/settings/base.py` (env `CVAT_ORGANIZATIONS_MIN_ROLE_TO_CREATE` overrides; upstream default `user`); not retroactive; checked live only (`run.sh check-org-creation`).
- **BUILD-1** policies reach a server only inside the fork server image; `build-server.sh` tags only after six in-image checks: bundle holds the tree's patched policies, plus the Team Analytics policy with analytics on; programs run on the venv's Python 3.12, supervisord runs, `nginx -t` passes; no `ldd` "not found"; Django sets up with `CVAT_ANALYTICS` 1 and 0; `makemigrations --check --dry-run` clean. `CLAM_AV=yes` and `CVAT_DEBUG_ENABLED=yes` builds have never been built.
- **TA-1** Team Analytics: [Team Analytics internals](team-analytics.md). Acceptance ids UI-A..E, IAM-A..D, BUILD-A/B, TA-A..J map to the suites under `verify/` and `run.sh check-*` subcommands.
