# The test stack on a shared machine and in a public repository

This describes the Kubernetes test stack in [`team-analytics-stack/`](team-analytics-stack/README.md)
as it runs on the cluster of the machine the fork is developed on. It was a
section of the [fork specification](../docs/fork-specification.md#the-test-stack)
until 2026-11-19 and moved here with the stack; its text is unchanged apart
from two remarks about a real deployment and the check pipeline's output, which
stayed in the specification.

The stack's namespace is `cvat-ta-it-<TA_RUN_ID>`, and `TA_RUN_ID` defaults to
the machine user. Every checkout of the same user therefore shares one stack:
one namespace, one state directory and one port-forward, and the ownership
label is the same for all of them. An `up` from a second checkout upgrades the
first one's release and its `down` deletes it. Give each concurrent run its own
`TA_RUN_ID` (and its own reserved host port). `down` refuses a namespace
without the label and stops only its own port-forward.

Before anything is applied, the launcher's render check (`render_guard.py`,
listed in the stack's README) judges every object. These ways of reaching
another project on the shared cluster through storage or routes are judged by
allowlist, against what the genuine render contains: pod volume sources,
claims naming a volume, any Ingress (the stack has none; its address is the
proxy behind a port-forward), hand-written Endpoints or EndpointSlices, and
Secret types. With analytics on it also requires the Team Analytics worker,
and with analytics off refuses it. Not judged: a
claim, or a claim template, that binds an existing volume without naming it
(a label selector, a data source, or an empty storage class); the genuine
render has none. The checks for
reaching the host still refuse by list. It judges the `helm template` render,
not what the installation creates.

The cluster's sweeper drops a namespace at its age limit or when it was created
before the cluster's last restart. The launcher recreates a namespace older
than `TA_MAX_REUSE_HOURS`, and one created before the restart time the
sweeper's last tick recorded (`infra-janitor/last-run`, `restart_at`). That
time can lag a restart by one tick, and k8s-infra does not yet count the
sweeper's restart detection as proven; without a readable time only the age
rule applies.

The repository is public. What it shows about the stack, none of it a secret
of a running system: the default of the disposable seed password
(`stack.env`); upstream's default database and cache passwords in the chart's
`helm-chart/values.yaml`; and, in evidence dated before 2026-11-15, the
stack's former default namespace and Ingress host, which carry the machine
user's name; and a machine
path outside the home directory in [`INFRA_MIGRATION.md`](INFRA_MIGRATION.md), the platform's own
notice text. Older evidence is not rewritten. The seed password
reaches the backend pod through the seed script's standard input, not a
command line.
