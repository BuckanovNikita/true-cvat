# Test stack

The Kubernetes test stack lives under `local/`, on `develop` only.

`local/team-analytics-stack/run.sh` (see its header and README): `up`, `down`, `cycle`, `preflight` (no cluster changes), `check-issue-policies patched|stock`, `check-policies`, `check-issues`, `check-org-creation`, `check-access`, `check-settings`, `check-cross-org`, `check-fixes [STEP]`, `check-isolation [worker-down|clickhouse-down|totals-dropped|redis-down]`, `check-load` (`TA_LOAD_HEAVY=1`), `check-analytics-off` (last), `check-evidence STEP`, `restore-chart`. Namespace `cvat-ta-it-<TA_RUN_ID>`, labelled `app.kubernetes.io/managed-by=cvat-fork-team-analytics-stack`; access only via `kubectl port-forward`; `render_guard.py` judges the render before apply. Config in `stack.env`. Recorded check limits: the settings HEAD-no-body half cannot fail; the `page` step's instance-scope project-names part can pass on an org-switch failure; `check-load` derives refresh end from rq's "Job OK" line.
