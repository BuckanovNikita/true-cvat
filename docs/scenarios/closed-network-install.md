# First install in a closed network

Follow this page for the first production install of the fork in a closed network: you build the two images on a machine that reaches your mirrors, carry them to the internal registry, and install the CVAT chart from the [fork tree](../../GLOSSARY.md#fork-tree). A short variant for a network with public access is at the end.

## Before you start

- Tools, endpoints and the contents of `<fork-root>`: [Requirements](../requirements.md). The build host needs Docker with BuildKit and `<fork-root>` inside a git work tree whose files are tracked ([What the fork tree must contain](../requirements.md#what-the-fork-tree-must-contain)); the installing host needs `helm` 3 and `kubectl` with rights to the namespace. With [analytics](../../GLOSSARY.md#analytics) on, keep `grafana.rbac.namespaced: true` from the example values, or the account also needs rights to create a ClusterRole and a ClusterRoleBinding ([Images](../charts/cvat.md#images)).
- The [perimeter inputs](../../GLOSSARY.md#perimeter-input) your mirrors replace: [build-server.sh](../commands/build-server.md#syntax-and-inputs) and [build-ui.sh](../commands/build-ui.md#syntax-and-inputs).
- Every stock image the chart pulls, copied to the internal registry: [Images a cluster pulls](../requirements.md#images-a-cluster-pulls).
- A storage class that supports `ReadWriteMany` for the [backend data volume](../../GLOSSARY.md#backend-data-volume), and a default storage class (or `cvat.kvrocks.defaultStorage.storageClassName` and `global.storageClass`) for the other volumes ([Storage](../charts/cvat.md#storage)); an ingress controller; and a certificate and key for `cvat.example.com`.
- Decide now whether [analytics](../../GLOSSARY.md#analytics) is on. It is on by default, and [Team Analytics](../../GLOSSARY.md#team-analytics) exists only with it. You can switch it on later: [Enabling Team Analytics](enable-team-analytics.md).

## Steps

1. **Choose the image tag and the perimeter inputs.** On the build host, in `<fork-root>`, set an immutable tag and export the inputs that your mirrors replace. Leave out an input you do not need. The tag ends in `-` and eight hex digits so that `imageTagsGuard` accepts it (see [Image tags guard](../charts/cvat.md#image-tags-guard)).

   ```bash
   cd <fork-root>
   export TAG=v2.82.0-fork-0a1b2c3d
   export BASE_IMAGE=registry.example.com/library/python:3.12-slim-bookworm
   export RUST_IMAGE=registry.example.com/library/rust:1.85-slim-bookworm
   export GOLANG_IMAGE=registry.example.com/library/golang:1.27.2
   export APT_REMOTE=https://mirror.example.com/debian
   export APT_SECURITY_REMOTE=https://mirror.example.com/debian-security
   export PIP_INDEX=https://mirror.example.com/pypi/simple
   export GO_PROXY=https://mirror.example.com/goproxy
   export CARGO_INDEX=sparse+https://mirror.example.com/crates/
   export GITHUB_PROXY=https://mirror.example.com/github
   export NODE_IMAGE=registry.example.com/library/node:24.19.0-slim
   export NGINX_IMAGE=registry.example.com/nginxinc/nginx-unprivileged:1.31.7-alpine3.24-slim
   export NPM_REGISTRY=https://mirror.example.com/npm/
   ```

   Expect no output. Each build script reads only its own inputs. The scripts pull the bases themselves, so run `docker login registry.example.com` first if the bases come from the registry.

2. **Build the [fork server image](../../GLOSSARY.md#fork-server-image).** With `SAVE=1` the script also writes an archive in `<fork-root>`.

   ```bash
   IMAGE=registry.example.com/cvat/server:$TAG SAVE=1 ./build-server.sh
   ```

   Expect the checks to pass and a last line `built registry.example.com/cvat/server:<tag> (<image id>) from the fork's tree ...; every check passed`, then `saved registry.example.com-cvat-server-<tag>.tar.gz`. Nothing is tagged when a check fails. Keep the `built ...` line as the record of what you built from. Failures: [build-server.sh](../commands/build-server.md#common-errors).

3. **Build the [UI image](../../GLOSSARY.md#ui-image).**

   ```bash
   IMAGE=registry.example.com/cvat/ui:$TAG SAVE=1 ./build-ui.sh
   ```

   Expect `built registry.example.com/cvat/ui:<tag> on <NODE_IMAGE>` and `saved registry.example.com-cvat-ui-<tag>.tar.gz`. Failures: [build-ui.sh](../commands/build-ui.md#common-errors).

4. **Carry the archives across.** Move the two `.tar.gz` files to a machine that can reach the internal registry, by whatever transfer your network allows. Expect the same files, byte for byte.

5. **Load and push.** The images carry the registry reference you gave as `IMAGE`, so no re-tagging is needed. If you built under another name, run `docker tag <built> registry.example.com/cvat/server:<tag>` first.

   ```bash
   docker load -i registry.example.com-cvat-server-v2.82.0-fork-0a1b2c3d.tar.gz
   docker load -i registry.example.com-cvat-ui-v2.82.0-fork-0a1b2c3d.tar.gz
   docker push registry.example.com/cvat/server:v2.82.0-fork-0a1b2c3d
   docker push registry.example.com/cvat/ui:v2.82.0-fork-0a1b2c3d
   ```

   Expect `Loaded image: ...` for each archive and a pushed digest for each push. Run `docker login registry.example.com` first. The scripts never push; this step is yours.

6. **Copy the stock images.** Every other image in [Images a cluster pulls](../requirements.md#images-a-cluster-pulls) must be in the registry too, under the paths your values file names. For each one:

   ```bash
   docker pull busybox:1.36.1
   docker tag busybox:1.36.1 registry.example.com/library/busybox:1.36.1
   docker push registry.example.com/library/busybox:1.36.1
   ```

   Do this on a machine that reaches both the source and the registry, or with `docker save` and `docker load` as above. To list the exact references your values file renders, run the render of step 9 and filter it:

   ```bash
   helm template cvat ./helm-chart --namespace cvat -f values.prod.yaml | grep -E '^\s+image:' | sort -u
   ```

   Expect one reference per line. Run it again after step 8; the two fork images are in the list too.

7. **Create the namespace and the pull secret.**

   ```bash
   kubectl create namespace cvat
   kubectl create secret docker-registry <pull-secret> --namespace cvat \
     --docker-server=registry.example.com --docker-username=<user> --docker-password=<password>
   ```

   Expect `namespace/cvat created` and `secret/<pull-secret> created`.

8. **Write `values.prod.yaml`.** Start from the [closed-network example](../charts/cvat.md#closed-network-example) and put the file in `<fork-root>`. Then change:

   | What | Value |
   | --- | --- |
   | Images | `cvat.backend.image`, `cvat.backend.tag`, `cvat.frontend.image`, `cvat.frontend.tag` name the images you pushed in step 5. Check the other image paths against step 6. |
   | Pull secret | `<pull-secret>` is the Secret of step 7, in `imagePullSecrets`, `global.imagePullSecrets` and `vector.image.pullSecrets`. |
   | Ingress host and TLS | `ingress.hostname`, `ingress.className`, `ingress.tls`, `tlscrt`, `tlskey` (write each PEM as a block scalar: `tlscrt: |` and the lines indented below), and `grafana.grafana.ini.server.root_url` with the same host. |
   | Storage | `cvat.backend.defaultStorage.storageClassName` and `size`; the volume is `ReadWriteMany`. Classes and sizes of the other volumes: [Storage](../charts/cvat.md#storage). |
   | Credentials | Replace every `<password>`. The chart ships fixed defaults ([Default credentials the chart ships](../access.md#default-credentials-the-chart-ships)). Choose `analytics.clickhousePassword` now: its Secret is immutable. |
   | Analytics | `analytics.enabled: true` as in the example, or off as below. |
   | [Grafana](../../GLOSSARY.md#grafana) plugin | `grafana.plugins` points at a download URL on your mirror, not at the Grafana plugin catalogue. |

   With analytics on and `traefik.enabled` left `false`, as in the example, `/analytics` is served without sign-in. Read [Grafana when analytics is enabled](../access.md#grafana-when-analytics-is-enabled) and close it before users reach the host.

   To install without analytics, remove the `vector` and `grafana` blocks, replace the `analytics` and `clickhouse` blocks with the lines below, and make PostgreSQL or Redis external. The `redis` block below replaces the one of the example; keep a key only once in the file. For Redis, set the password in `redis.secret.password`:

   ```yaml
   analytics:
     enabled: false
   clickhouse:
     enabled: false
   redis:
     enabled: false
     external:
       host: redis.example.com
     secret:
       password: <password>
   ```

   The chart does not render with analytics off while both bundled PostgreSQL and Redis stay on ([Analytics](../charts/cvat.md#analytics)). Without analytics the [Team Analytics worker](../../GLOSSARY.md#team-analytics-worker) is not rendered.

9. **Check the render.** Nothing reaches the cluster.

   ```bash
   cd <fork-root>
   helm lint ./helm-chart -f values.prod.yaml
   helm template cvat ./helm-chart --namespace cvat -f values.prod.yaml > /dev/null
   ```

   Expect `1 chart(s) linted, 0 chart(s) failed` and no error from the second command. A failure names the value to fix: [Render failures](../charts/cvat.md#render-failures).

10. **Install the chart.** The chart needs no repository and no `helm dependency update`.

    ```bash
    helm upgrade --install cvat ./helm-chart --namespace cvat -f values.prod.yaml
    ```

    Expect `STATUS: deployed` and `REVISION: 1`.

11. **Wait for the initializer and the pods.** The chart renders the initializer as a plain Job named `<release>-backend-initializer-r<revision>`, not as a hook. It migrates the databases; with analytics it also creates the ClickHouse events table. The server pods wait until the migrations are complete, so they stay not ready until the Job ends. The number is the Helm revision: after a repeated install or an upgrade it is higher, and `kubectl get jobs --namespace cvat` lists the current one.

    ```bash
    kubectl wait --for=condition=complete job/cvat-backend-initializer-r1 --namespace cvat --timeout=30m
    kubectl rollout status deployment/cvat-backend-server --namespace cvat
    kubectl get pods --namespace cvat
    ```

    Expect `job.batch/cvat-backend-initializer-r1 condition met`, `successfully rolled out`, and every pod `Running` and ready (the Job's pod `Completed`). `ImagePullBackOff` means an image path or the pull secret is wrong; `kubectl describe pod` names the image.

12. **Create the first administrator.** A user who registers, or is created in the Django admin, gets the global role `user`. An account made with Django's `createsuperuser` is added to the `admin` group instead, so it is an [administrator](../../GLOSSARY.md#administrator). This is stock CVAT: upstream describes it under "How to create superuser?" in its [Helm guide](https://docs.cvat.ai/docs/administration/advanced/k8s_deployment_with_helm/). The command:

    ```bash
    kubectl exec -it --namespace cvat \
      "$(kubectl get pod --namespace cvat -l tier=backend,app.kubernetes.io/instance=cvat,component=server -o jsonpath='{.items[0].metadata.name}')" \
      -c cvat-backend -- python manage.py createsuperuser
    ```

    Expect prompts for a user name, an e-mail address and a password, then `Superuser created successfully.` Without a terminal, give the password in the container's environment and the rest as arguments: `env DJANGO_SUPERUSER_PASSWORD=<password> python manage.py createsuperuser --noinput --username <admin> --email <e-mail>` in place of the last line.

## Check the result

Run these from `<fork-root>` and from a host that reaches `https://cvat.example.com`. Right after a rollout the ingress controller can answer `503` for a few seconds, until it sees the new server pod: ask again.

1. **The site and the account.** Open `https://cvat.example.com` and sign in as the administrator of step 12.
2. **The [policy bundle](../../GLOSSARY.md#policy-bundle) the server serves** equals the policies of the fork tree. Use `check-analytics` when analytics is on, `check` otherwise ([verify/policy_bundle.sh](../commands/policy-bundle.md#checking-a-running-server)):

   ```bash
   curl -s https://cvat.example.com/api/auth/rules | verify/policy_bundle.sh check-analytics
   ```

   Expect one `equal` line per policy and exit code `0`.
3. **The Team Analytics worker**, with analytics on:

   ```bash
   kubectl get deployment cvat-backend-worker-team-analytics --namespace cvat
   curl -s -u '<admin>:<password>' https://cvat.example.com/api/team-analytics/status
   ```

   Expect `1/1` ready and a JSON answer. Right after the start the API may answer `429` with `Retry-After` while the worker prepares its first answer; ask again. `refresh.stale` stays `true` until the first refresh succeeds; the job is queued every minute ([Health checks and status codes](../team-analytics.md#health-checks-and-status-codes)). With analytics off the address answers `404`.
4. **Organization creation is for administrators.** With the account of a user who is not an administrator (create one in the Django admin at `/admin`; new accounts have no administrator rights):

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -u '<user>:<password>' \
     -H 'Content-Type: application/json' -d '{"slug":"policy-check","name":"policy check"}' \
     https://cvat.example.com/api/organizations
   ```

   Expect `403` ([Organization creation](../access.md#organization-creation)). A `201` means an organization was created: delete it, and check `CVAT_ORGANIZATIONS_MIN_ROLE_TO_CREATE` in [Configuration](../configuration.md#organization-creation-cvat_organizations_min_role_to_create).
5. **Grafana is closed**, with analytics on: request `https://cvat.example.com/analytics/` without signing in and confirm you do not get Grafana ([Access](../access.md#grafana-when-analytics-is-enabled)). A Grafana page, its `404` page included, means the request reached Grafana without a check.

## Public network

On a network that reaches Docker Hub, PyPI, npm, crates.io, the Go proxy and github.com, skip steps 1, 4 and 6.

- Build with no perimeter inputs; the defaults are the public sources:

  ```bash
  IMAGE=registry.example.com/cvat/server:v2.82.0-fork-0a1b2c3d ./build-server.sh
  IMAGE=registry.example.com/cvat/ui:v2.82.0-fork-0a1b2c3d ./build-ui.sh
  ```

- The cluster still needs the two images in a registry it reaches: push them as in step 5, without `SAVE=1` and `docker load`.
- In `values.prod.yaml` keep `cvat.backend.image` and `tag`, `cvat.frontend.image` and `tag`, the ingress, storage and credentials. Drop the `registry` overrides of the stock images, the `image` overrides that name `registry.example.com`, the `grafana.plugins` mirror URL, and the pull secrets if your registry needs none ([Closed-network example](../charts/cvat.md#closed-network-example)).
- Steps 7 to 12 and the checks are the same.

## See also

- [Requirements](../requirements.md)
- [build-server.sh](../commands/build-server.md), [build-ui.sh](../commands/build-ui.md)
- [CVAT chart](../charts/cvat.md)
- [Access](../access.md): default credentials and Grafana
- [State and backups](../state.md)
- [Enabling Team Analytics](enable-team-analytics.md), [Adding nuclio](nuclio.md)
- [Upgrade and rollback](upgrade-and-rollback.md)
