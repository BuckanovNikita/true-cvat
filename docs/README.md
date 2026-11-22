# Installing and operating the fork

This fork is CVAT built from its own [fork tree](../GLOSSARY.md#fork-tree), with its own [fork server image](../GLOSSARY.md#fork-server-image), [UI image](../GLOSSARY.md#ui-image) and Helm charts. It adds task progress by stage and state in the tasks list, a [role floor](../GLOSSARY.md#role-floor) on issue and comment permissions inside an organization, organization creation for [administrators](../GLOSSARY.md#administrator) only, and the [Team Analytics](../GLOSSARY.md#team-analytics) page, API and worker. You build both images with the fork's scripts and install them with the CVAT chart under `<fork-root>/helm-chart/`.

These pages cover what the fork adds or changes for an installer: building the images, the charts' fork values, the settings, access, operating Team Analytics, and the install, upgrade and nuclio procedures. They do not cover stock CVAT administration; for that, see [upstream's Helm guide](https://docs.cvat.ai/docs/administration/advanced/k8s_deployment_with_helm/).

## First install

1. [Requirements](requirements.md)
2. [State and backups](state.md)
3. [build-server.sh](commands/build-server.md)
4. [build-ui.sh](commands/build-ui.md)
5. [Policy bundle check](commands/policy-bundle.md)
6. [CVAT chart](charts/cvat.md)
7. [Backend configuration](configuration.md)
8. [Access](access.md)
9. [First install in a closed network](scenarios/closed-network-install.md), which puts the steps above in order and runs them

## Start here

- [Requirements](requirements.md): which tools, network endpoints and fork tree contents each step needs.
- [State and backups](state.md): which stores an install keeps, and what to back up before an upgrade.

## Building images

- [build-server.sh](commands/build-server.md): how to build and check the fork server image.
- [build-ui.sh](commands/build-ui.md): how to build the UI image.
- [Policy bundle check](commands/policy-bundle.md): whether an image or a running server serves the fork tree's policies.

## Charts

- [CVAT chart](charts/cvat.md): the values the fork adds, the [Team Analytics worker](../GLOSSARY.md#team-analytics-worker), and the render failures.
- [nuclio chart](charts/nuclio.md): installing nuclio as its own release and what must agree with the CVAT chart.

## Configuration and access

- [Backend configuration](configuration.md): every backend setting the fork adds, with defaults and limits.
- [Access](access.md): who may do what because of the fork (role floor, organization creation, Team Analytics), who can open [Grafana](../GLOSSARY.md#grafana), and the default credentials.

## Operating

- [Operating Team Analytics](team-analytics.md): what runs where, status codes, the [technical accounts list](../GLOSSARY.md#technical-accounts-list), failure modes.
- [Troubleshooting](troubleshooting.md): a message or symptom, its cause and its fix.

## Scenarios

- [First install in a closed network](scenarios/closed-network-install.md): the first production install, with a public-network variant.
- [Upgrade and rollback](scenarios/upgrade-and-rollback.md): moving to a new [stage tag](../GLOSSARY.md#stage-tag) and going back.
- [Enabling Team Analytics](scenarios/enable-team-analytics.md): turning it on for a running install.
- [Adding nuclio](scenarios/nuclio.md): adding nuclio as a second release.

## Reference

- [Glossary](../GLOSSARY.md): the terms these pages use.

## See also

- [Upstream's Helm guide](https://docs.cvat.ai/docs/administration/advanced/k8s_deployment_with_helm/): stock CVAT administration.
