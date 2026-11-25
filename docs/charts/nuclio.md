# nuclio chart

`helm-chart-nuclio/` in the [fork tree](../../GLOSSARY.md#fork-tree) installs nuclio, the serverless platform CVAT uses to run automatic annotation functions. You need it only for those functions. It is a separate Helm release: the CVAT chart does not install it.

The chart carries upstream nuclio's templates (chart version `0.22.0`, nuclio `1.14.1`) as plain files, so you install it from the fork tree without a chart repository. Every image and registry setting is a value, and the chart ships no credentials.

## Installing

Install it in the CVAT namespace, under the release name `nuclio`:

```bash
cd <fork-root>
helm lint ./helm-chart-nuclio -f nuclio.values.prod.yaml
helm upgrade --install nuclio ./helm-chart-nuclio --namespace cvat -f nuclio.values.prod.yaml
```

Then point the CVAT release at it (see [What must agree with the CVAT chart](#what-must-agree-with-the-cvat-chart)).

The chart renders cluster-scoped CustomResourceDefinitions, so the account that runs `helm` needs rights to create them. The full step-by-step is [Adding nuclio](../scenarios/nuclio.md).

## What it renders

With default values, `helm template nuclio ./helm-chart-nuclio --namespace cvat` renders:

| Kind | Names |
| --- | --- |
| CustomResourceDefinition | `nucliofunctions.nuclio.io`, `nuclioprojects.nuclio.io`, `nucliofunctionevents.nuclio.io`, `nuclioapigateways.nuclio.io` (`crd.create: false` drops them) |
| Deployment | `nuclio-controller`, `nuclio-dashboard` |
| Service | `nuclio-dashboard`, port `8070` |
| Ingress | `nuclio-dashboard`, host `nuclio.local`, class `nginx` |
| ServiceAccount | `nuclio` |
| Role, RoleBinding | `nuclio-crd-admin-role`, `nuclio-function-deployer-role` and their bindings, in the release namespace |

`autoscaler.enabled`, `dlx.enabled` and `dashboard.opa.enabled` are `false` by default. Every name starts with the release name, plus `-nuclio` unless the release name already contains `nuclio` (the release `other` renders `other-nuclio-dashboard`). The CRD names do not change. The table shows the release `nuclio`.

## Images

| Value | Default | Notes |
| --- | --- | --- |
| `controller.image.repository` | `quay.io/nuclio/controller` | |
| `controller.image.tag` | `1.14.1-amd64` | |
| `dashboard.image.repository` | `quay.io/nuclio/dashboard` | |
| `dashboard.image.tag` | `1.14.1-amd64` | |
| `controller.cronTriggerCronJobImage.repository` | `docker.io/curlimages/curl` | Passed to the controller as `NUCLIO_CONTROLLER_CRON_TRIGGER_CRON_JOB_IMAGE_NAME`. |
| `controller.cronTriggerCronJobImage.tag` | `latest` | |
| `dashboard.kaniko.image.repository` | `gcr.io/kaniko-project/executor` | Passed to the dashboard as `NUCLIO_KANIKO_CONTAINER_IMAGE`: the image that builds function images. |
| `dashboard.kaniko.image.tag` | `v1.23.2` | |
| `dashboard.kaniko.initContainerImage.busybox.repository` | `docker.io/library/busybox` | Passed as `NUCLIO_BUSYBOX_CONTAINER_IMAGE`. |
| `dashboard.kaniko.initContainerImage.busybox.tag` | `1.37.0` | |
| `dashboard.kaniko.initContainerImage.awscli.repository` | `docker.io/amazon/aws-cli` | Passed as `NUCLIO_AWS_CLI_CONTAINER_IMAGE`. |
| `dashboard.kaniko.initContainerImage.awscli.tag` | `2.17.16` | |
| `autoscaler.image.repository` | `quay.io/nuclio/autoscaler` | Only with `autoscaler.enabled`. |
| `autoscaler.image.tag` | `1.14.1-amd64` | |
| `dlx.image.repository` | `quay.io/nuclio/dlx` | Only with `dlx.enabled`. |
| `dlx.image.tag` | `1.14.1-amd64` | |

In a closed network, mirror each image you use to `registry.example.com` and set the repository values to it. The chart's templates put no `imagePullSecrets` on any pod and have no value for them, so the nodes must be able to pull these images without a pull secret. Note that `registry.secretName` is not an image pull secret for the chart's own pods.

## Registry

Function images are built by the dashboard and pushed to a registry. Each value below only becomes the environment variable or Secret named; nuclio interprets them.

| Value | Default | What the chart does with it |
| --- | --- | --- |
| `registry.pushPullUrl` | `""` | Stored in a ConfigMap and passed to the dashboard as `NUCLIO_DASHBOARD_REGISTRY_URL`. Falls back to `global.registry.url`. The ConfigMap and the variable exist only when one of them is set. |
| `registry.runRegistryURL` | `""` | `NUCLIO_DASHBOARD_RUN_REGISTRY_URL` when set. |
| `registry.defaultBaseRegistryURL` | `""` | `NUCLIO_DASHBOARD_DEFAULT_BASE_REGISTRY_URL` when set. |
| `registry.defaultOnbuildRegistryURL` | `""` | `NUCLIO_DASHBOARD_DEFAULT_ONBUILD_REGISTRY_URL` when set. |
| `registry.dependantImageRegistryURL` | `""` | `NUCLIO_DASHBOARD_DEPENDANT_IMAGE_REGISTRY_URL` when set. |
| `registry.kind` | `""` | `NUCLIO_REGISTRY_KIND` when set. |
| `registry.secretName` | `regcred` | Name of the registry credentials Secret: mounted into the dashboard, passed as `NUCLIO_REGISTRY_CREDENTIALS_SECRET_NAME` and as the controller's `NUCLIO_CONTROLLER_IMAGE_PULL_SECRETS`. |
| `registry.loginUrl` | `""` | Registry host written into the credentials Secret when the chart creates it. |
| `registry.credentials` | unset | `{username, password}`. When set, the chart creates a `kubernetes.io/dockerconfigjson` Secret named `registry.secretName`. |
| `offline` | `true` | Sets `NUCLIO_DASHBOARD_OFFLINE=true` on the dashboard. |
| `dashboard.templates.archiveAddress` | `file://tmp/templates.zip` | Passed as `NUCLIO_TEMPLATES_ARCHIVE_ADDRESS`, and the git template source (`NUCLIO_TEMPLATES_GIT_REPOSITORY`, `NUCLIO_TEMPLATES_GIT_REF`) is set to `nil`. Keep it in a closed network: the value `nil` switches to `dashboard.templates.gitRepository` (a github.com URL by default), and the chart then renders an empty `NUCLIO_TEMPLATES_GIT_REF` because the template reads a misspelled value name. |

In a closed network, point the registry URLs at `registry.example.com`.

### Credentials

The chart ships no credentials. Prefer an existing Secret: create a `docker-registry` Secret named `regcred` (or your `registry.secretName`) in the `cvat` namespace and leave `registry.credentials` unset. The chart then only refers to it. With the default `registry.secretName: regcred` the dashboard and the controller name that Secret even when it does not exist; the dashboard mounts it as optional. If you set `registry.credentials`, the password goes through your values file into a Secret the release owns; keep that file encrypted.

## Dashboard ingress

| Value | Default | Notes |
| --- | --- | --- |
| `dashboard.ingress.enabled` | `true` | |
| `dashboard.ingress.hosts` | `[nuclio.local]` | Set `[nuclio.example.com]`. This is the only place the host appears. |
| `dashboard.ingress.ingressClassName` | `nginx` | |
| `dashboard.ingress.tls` | `[]` | Entries of `{hosts, secretName}`. |
| `dashboard.ingress.annotations` | `{}` | |

The ingress host is for people opening the dashboard. The CVAT backend reaches the dashboard through the Service (`nuclio.dashboard.host` in the CVAT chart), not through this host. The ingress is on by default; set `dashboard.ingress.enabled: false` if you do not want it.

## Example values

A minimal `nuclio.values.prod.yaml` for a closed network:

```yaml
controller:
  image:
    repository: registry.example.com/nuclio/controller
  cronTriggerCronJobImage:
    repository: registry.example.com/curlimages/curl
dashboard:
  image:
    repository: registry.example.com/nuclio/dashboard
  kaniko:
    image:
      repository: registry.example.com/kaniko-project/executor
    initContainerImage:
      busybox:
        repository: registry.example.com/library/busybox
      awscli:
        repository: registry.example.com/amazon/aws-cli
  ingress:
    hosts:
      - nuclio.example.com
registry:
  pushPullUrl: registry.example.com/nuclio
  secretName: regcred
```

## What must agree with the CVAT chart

The CVAT chart owns these values; each row links to it.

| CVAT chart value | Must agree with | Why |
| --- | --- | --- |
| [`nuclio.enabled`](cvat.md#nuclio-host) | Set it to `true` in the CVAT release. | It adds three variables to the backend pods: `CVAT_SERVERLESS=1`, `CVAT_NUCLIO_HOST` and `CVAT_NUCLIO_FUNCTION_NAMESPACE`. It installs nothing. |
| [`nuclio.dashboard.host`](cvat.md#nuclio-host) | The dashboard Service of this release: `nuclio-dashboard` for the release `nuclio` in the same namespace. | The CVAT default resolves to `cvat-nuclio-dashboard`, which this release does not create. The backend uses port `8070`, the dashboard Service port. |
| Function namespace (no value) | Install this release in the CVAT release namespace. | The CVAT chart sets `CVAT_NUCLIO_FUNCTION_NAMESPACE` to its own release namespace (see [`nuclio.enabled`](cvat.md#nuclio-host)). This chart's default `rbac.crdAccessMode: namespaced` limits its Roles to the release namespace, and `controller.namespace` is empty. |

In the CVAT release values:

```yaml
nuclio:
  enabled: true
  dashboard:
    host: nuclio-dashboard
```

## See also

- [CVAT chart](cvat.md)
- [Adding nuclio](../scenarios/nuclio.md)
- [Requirements](../requirements.md)
