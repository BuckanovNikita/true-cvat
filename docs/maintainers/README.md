# Maintainer reference

Read on demand. Rules that bind every change are in [AGENTS.md](../../AGENTS.md); domain terms are in [GLOSSARY.md](../../GLOSSARY.md); the Russian overview is [README.fork.md](../../README.fork.md). What an installer needs is under [docs/](../README.md): those pages own the build inputs, the chart values, the backend settings and the operating procedures.

| Page | Read it when |
| --- | --- |
| [Architecture and contracts](architecture.md) | you need the fork-owned paths, the edited upstream files, the Helm delta, the data flow, the downstream-vendored set or the client event names |
| [Decisions](decisions.md) | a change touches something an ADR (0001 to 0010) or a specification id (UI-1, UI-2, IAM-1, IAM-2, BUILD-1, TA-1) binds |
| [Team Analytics internals](team-analytics.md) | you change the Team Analytics app, page or worker, or an upstream internal they rely on |
| [Upstream upgrade](upstream-upgrade.md) | the fork moves to a new upstream release |
| [Cut a release](release.md) | `develop` is cut into `release` under a new stage tag |
| [Test stack](test-stack.md) | you run the live checks |
| [Known open items](open-items.md) | you look for a known limit before reporting it |
| [History](history.md) | a comment cites a ticket number, `DOCS.md` or an older document |
