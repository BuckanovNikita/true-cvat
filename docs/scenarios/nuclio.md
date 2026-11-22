# Adding nuclio

Follow this page to add nuclio, the serverless platform CVAT uses for automatic annotation functions, to a running install. nuclio is a second Helm release; the CVAT release only learns where to find it. Deploying a function is outside these docs.

## Before you start

- A running CVAT release, as in [First install in a closed network](closed-network-install.md), in the namespace `cvat`.
- Rights to create cluster-scoped CustomResourceDefinitions for the account that runs `helm` ([nuclio chart](../charts/nuclio.md#installing)).
- The nuclio images in your registry, under the paths your values file names ([Images](../charts/nuclio.md#images)). The chart has no value for pull secrets, so the nodes must pull them without one.
- A registry for the function images and its credentials ([Registry](../charts/nuclio.md#registry)).

## Steps

1. **Create the registry Secret** for the images nuclio builds. Skip it if you set `registry.credentials` in the values file instead ([Credentials](../charts/nuclio.md#credentials)).

   ```bash
   kubectl create secret docker-registry regcred --namespace cvat \
     --docker-server=registry.example.com --docker-username=<user> --docker-password=<password>
   ```

   Expect `secret/regcred created`.

2. **Write `nuclio.values.prod.yaml`** in `<fork-root>`. Start from [Example values](../charts/nuclio.md#example-values), then set the image repositories to your registry (the tags stay as they are, so mirror each image under its default tag), `dashboard.ingress.hosts` to `[nuclio.example.com]` and the `registry.*` URLs to your registry.

3. **Render and install** the chart as the release `nuclio`, in the CVAT namespace.

   ```bash
   cd <fork-root>
   helm lint ./helm-chart-nuclio -f nuclio.values.prod.yaml
   helm template nuclio ./helm-chart-nuclio --namespace cvat -f nuclio.values.prod.yaml > /dev/null
   helm upgrade --install nuclio ./helm-chart-nuclio --namespace cvat -f nuclio.values.prod.yaml
   ```

   Expect `0 chart(s) failed`, then `STATUS: deployed`. The release creates the Services and Deployments `nuclio-dashboard` and `nuclio-controller` ([What it renders](../charts/nuclio.md#what-it-renders)). A different release name changes these names, and then step 4 must follow.

4. **Wait for nuclio.**

   ```bash
   kubectl rollout status deployment/nuclio-dashboard --namespace cvat
   kubectl rollout status deployment/nuclio-controller --namespace cvat
   ```

   Expect `successfully rolled out` for both.

5. **Point the CVAT release at it.** Add to `values.prod.yaml` the two values that must agree with the nuclio release ([What must agree with the CVAT chart](../charts/nuclio.md#what-must-agree-with-the-cvat-chart)). Their meaning is owned by the [CVAT chart page](../charts/cvat.md#nuclio-host):

   ```yaml
   nuclio:
     enabled: true
     dashboard:
       host: nuclio-dashboard
   ```

   The default of `nuclio.dashboard.host` resolves to `cvat-nuclio-dashboard`, which the release `nuclio` does not create. Keep the nuclio release in the CVAT namespace: the backend looks for functions in its own release namespace.

6. **Upgrade the CVAT release.**

   ```bash
   helm template cvat ./helm-chart --namespace cvat -f values.prod.yaml > /dev/null
   helm upgrade cvat ./helm-chart --namespace cvat -f values.prod.yaml
   ```

   Expect `STATUS: deployed`. The backend pods get three new variables and restart; CVAT is unavailable until they are ready, as in any [upgrade](upgrade-and-rollback.md). Wait for the initializer Job as in [step 7 of the upgrade](upgrade-and-rollback.md#steps) and for `kubectl rollout status deployment/cvat-backend-server --namespace cvat`.

## Check the result

1. The backend has the variables:

   ```bash
   kubectl exec deployment/cvat-backend-server --namespace cvat -c cvat-backend -- printenv CVAT_SERVERLESS CVAT_NUCLIO_HOST CVAT_NUCLIO_FUNCTION_NAMESPACE
   ```

   Expect `1`, `nuclio-dashboard` and `cvat`, one per line.
2. The dashboard Service has an endpoint:

   ```bash
   kubectl get endpoints nuclio-dashboard --namespace cvat
   ```

   Expect one address on port `8070`.

3. CVAT reaches the dashboard. Signed in, `GET /api/lambda/functions` answers `200` and a list, empty until you deploy a function:

   ```bash
   curl -s -u '<user>:<password>' https://cvat.example.com/api/lambda/functions
   ```

   Expect `[]`. The route exists whether or not `nuclio.enabled` is set; the variables only tell the backend where the dashboard is, and without `CVAT_NUCLIO_HOST` it looks at `localhost`. An error status means the backend cannot reach the dashboard: check the host value of step 5 and that the Service has an endpoint.
4. Optional: `https://nuclio.example.com` opens the nuclio dashboard, if you kept `dashboard.ingress.enabled`.

## See also

- [nuclio chart](../charts/nuclio.md)
- [CVAT chart](../charts/cvat.md)
- [Requirements](../requirements.md#images-a-cluster-pulls)
- [Upgrade and rollback](upgrade-and-rollback.md)
