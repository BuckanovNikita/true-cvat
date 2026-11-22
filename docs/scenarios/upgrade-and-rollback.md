# Upgrade and rollback

Follow this page to move a running install to a new [stage tag](../../GLOSSARY.md#stage-tag) of the [fork tree](../../GLOSSARY.md#fork-tree), and to go back when the upgrade fails. The install is the one from [First install in a closed network](closed-network-install.md); the examples use its names (`cvat` release and namespace, `values.prod.yaml`).

The server, the workers, the frontend and the policy engine Deployments use the `Recreate` strategy, so CVAT is unavailable from the moment the old pods stop until the new ones are ready. A stage tag changes no image tag and no chart version: the image tag in `values.prod.yaml` is the one you choose in step 2.

## Before you start

- What to back up and why: [Before an upgrade](../state.md#before-an-upgrade). Do it now: the data volume, a Postgres dump, and with [analytics](../../GLOSSARY.md#analytics) the ClickHouse events database.
- The new fork tree, at the new stage tag `v2.82.0.N` (the old one is `v2.82.0.M`), in a second directory next to the old one. It must meet the same [requirements](../requirements.md#what-the-fork-tree-must-contain) as the first one.
- The [perimeter inputs](../../GLOSSARY.md#perimeter-input) of the first build, unchanged unless your mirrors changed.
- Running imports and exports finished ([In-memory Redis](../state.md#in-memory-redis)).

## Steps

1. **Record what runs now.** Keep the output next to your backup.

   ```bash
   cd <old-fork-root>
   helm history cvat --namespace cvat
   helm get values cvat --namespace cvat --output yaml > values.deployed-v2.82.0.M.yaml
   cp values.prod.yaml values.prod-v2.82.0.M.yaml
   ```

   Expect the revision list and two files. Do not delete the previous images from the registry: a rollback runs them. Keep the previous `<fork-root>` too, to check the [policy bundle](../../GLOSSARY.md#policy-bundle) after a rollback, and the previous values file, to upgrade again.

2. **Rebuild both images from the new tree.** Choose a new tag, because the registry keeps the old one. Export the perimeter inputs as in [step 1 of the install](closed-network-install.md#steps), then:

   ```bash
   cd <new-fork-root>
   export TAG=v2.82.0-fork-1d2e3f4a
   IMAGE=registry.example.com/cvat/server:$TAG SAVE=1 ./build-server.sh
   IMAGE=registry.example.com/cvat/ui:$TAG SAVE=1 ./build-ui.sh
   ```

   Expect `every check passed` and two `saved ...tar.gz` lines. Rebuild the server image for every upgrade even if you expect no policy change: the policies live in it. Failures: [build-server.sh](../commands/build-server.md#common-errors).

3. **Carry the archives across, load and push** as in steps 4 and 5 of the [install](closed-network-install.md#steps), with the new tag. Copy any stock image whose tag the new chart changed ([Images a cluster pulls](../requirements.md#images-a-cluster-pulls), step 6 of the install). Expect both new references in the registry.

4. **Set the new tags in `values.prod.yaml`.** Copy `values.prod.yaml` into `<new-fork-root>` and change `cvat.backend.tag` and `cvat.frontend.tag` there to the new tag. Step 5 shows whether the new chart needs anything else.

5. **Render with the new chart and compare.** The new tree's chart renders with your values, and the comparison shows what changes.

   ```bash
   cd <new-fork-root>
   helm template cvat ./helm-chart --namespace cvat -f values.prod.yaml > new.yaml
   helm get manifest cvat --namespace cvat > current.yaml
   diff current.yaml new.yaml
   ```

   Expect the image lines of the backend Deployments, the frontend and the initializer Job to differ, and the Job name: `helm template` always renders revision 1, the deployed Job carries the revision of its release. With analytics on, the `admin-password` of the Grafana Secret and the `checksum/secret` annotation of the Grafana Deployment differ on every render, because the Grafana subchart generates that password anew unless you set one ([Grafana when analytics is enabled](../access.md#grafana-when-analytics-is-enabled)); so the Grafana pod restarts on every upgrade. Everything else that differs comes from the new chart, so read it. A render error names the value ([Render failures](../charts/cvat.md#render-failures)). A renamed value in the new chart is a break you fix here, before the cluster changes.

6. **Upgrade.**

   ```bash
   helm upgrade cvat ./helm-chart --namespace cvat -f values.prod.yaml
   ```

   Expect `STATUS: deployed` and the next revision. The chart creates a new initializer Job for the revision; it runs the new image's `init` (database migrations, the periodic job schedule, and with analytics the ClickHouse events table).

7. **Wait for the initializer and the pods.** Take the revision from `helm history`:

   ```bash
   helm history cvat --namespace cvat --max 1
   kubectl wait --for=condition=complete job/cvat-backend-initializer-r<revision> --namespace cvat --timeout=30m
   kubectl rollout status deployment/cvat-backend-server --namespace cvat
   ```

   Expect `condition met` and `successfully rolled out`. New server pods wait for the migrations, so they are not ready until the Job ends. If the Job does not complete, read `kubectl logs job/cvat-backend-initializer-r<revision> --namespace cvat`: the Job's pod restarts its container after a failure (`restartPolicy: OnFailure`), so a failing migration keeps failing and the server pods stay not ready. Fix the cause, or [roll back](#roll-back).

8. **Restart the backend when its image reference did not change.** A running server builds its [policy bundle](../../GLOSSARY.md#policy-bundle) once and keeps it in memory, and the policy engine reads it from the server; a server that is not restarted keeps serving the old policies ([After a policy change](../access.md#after-a-policy-change)). With a new tag, step 6 replaced the pods and you skip this step. If you pushed a rebuilt image under the tag that was already deployed, the pods do not change on their own. Then restart:

   ```bash
   kubectl rollout restart deployment/cvat-backend-server --namespace cvat
   kubectl rollout status deployment/cvat-backend-server --namespace cvat
   ```

   Expect `successfully rolled out`. `cvat.backend.imagePullPolicy` is `Always` by default, so the restart pulls the pushed image. Restart the workers too, so that every backend pod runs the same image:

   ```bash
   kubectl rollout restart deployment --namespace cvat -l tier=backend,app.kubernetes.io/instance=cvat
   ```

   Prefer a new tag: it avoids this step.

## Check the result

1. The served policy bundle equals the policies of the new tree (run from `<new-fork-root>`; `check` when analytics is off):

   ```bash
   curl -s https://cvat.example.com/api/auth/rules | verify/policy_bundle.sh check-analytics
   ```

   Expect `equal` lines and exit code `0`. A `DIFFERS` line means the server still serves the old bundle: do step 8. See [Checking a running server](../commands/policy-bundle.md#checking-a-running-server).
2. Every pod is ready and the images are the new ones:

   ```bash
   kubectl get pods --namespace cvat
   kubectl get deployment cvat-backend-server --namespace cvat -o jsonpath='{.spec.template.spec.containers[*].image}'
   ```

3. With analytics on, the [Team Analytics worker](../../GLOSSARY.md#team-analytics-worker) runs and the status answers as an [administrator](../../GLOSSARY.md#administrator):

   ```bash
   kubectl get deployment cvat-backend-worker-team-analytics --namespace cvat
   curl -s -u '<admin>:<password>' https://cvat.example.com/api/team-analytics/status
   ```

   Expect `1/1` and a JSON answer (a `429` just after the start means ask again).
4. Sign in and open a task.

## Roll back

Use this when the new release does not start or misbehaves. It needs the previous images in the registry.

1. Find the revision that worked:

   ```bash
   helm history cvat --namespace cvat
   ```

2. Roll back. Helm applies the stored manifests of that revision, and so its image references and its values. Those manifests name the initializer Job of that revision, which Helm removed when you upgraded, so it is created again and runs the old image's `init`.

   ```bash
   helm rollback cvat <revision> --namespace cvat
   kubectl wait --for=condition=complete job/cvat-backend-initializer-r<revision> --namespace cvat --timeout=30m
   kubectl rollout status deployment/cvat-backend-server --namespace cvat
   ```

   Expect `Rollback was a success!`, a new revision in `helm history` described as `Rollback to <revision>`, and the pods back on the previous tags. The values file on disk is still the new one: restore the saved `values.prod-v2.82.0.M.yaml` before you upgrade again.
3. Check the bundle from the previous tree (`<fork-root>` of `v2.82.0.M`), whose policies the server should serve again:

   ```bash
   cd <old-fork-root>
   curl -s https://cvat.example.com/api/auth/rules | verify/policy_bundle.sh check-analytics
   ```

### What a rollback does not undo

`helm rollback` returns manifests and images and touches no data ([What a rollback does not undo](../state.md#what-a-rollback-does-not-undo)):

- Database migrations the new release applied stay applied. The older image may run against the newer schema. To return to the old schema, restore the Postgres dump you took before the upgrade, with CVAT stopped, using your database's own tools. Anything written after the dump is lost.
- Redis migrations, the columns the ClickHouse events table gained, and the tables the Team Analytics worker created stay.
- Volumes and their contents stay as they are; restore the data volume from its backup only if the upgrade damaged it.

## See also

- [State and backups](../state.md)
- [build-server.sh](../commands/build-server.md), [build-ui.sh](../commands/build-ui.md)
- [verify/policy_bundle.sh](../commands/policy-bundle.md)
- [CVAT chart](../charts/cvat.md)
- [First install in a closed network](closed-network-install.md)
