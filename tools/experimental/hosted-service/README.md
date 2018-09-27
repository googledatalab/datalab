# Managed Datalab Service Example

This directory shows how you can run your own service for automatically
allocating and managing Datalab instances.

This is done by defining a VM manager that creates and deletes the instances,
and pairing that with an [inverting proxy](https://github.com/google/inverting-proxy)
that is used to connect to those instances.

The resulting service allows users under a particular domain (e.g.
`some-user@your-company.com`) to automatically get a Datalab instance that
is assigned to them and runs in your GCP project.

Each Datalab instance runs with its own service account which can be found
by clicking on the user icon in the Datalab UI.

## DISCLAIMER

This is experimental and unsupported.

Note, also, that this is not cheap. The pool of VMs, the VM manager, and
the static file server are all running continuously. If you run this with
the default settings then you should expect it to cost you at least several
hundred dollars per month. If you increase the machine type then it will
cost even more.

## Setup

To deploy this, first create a GCP project to run the service and enable
the Compute Engine API in that project.

Then, set the `PROJECT_ID` environment variable to the ID of your project,
and run the following commands to deploy the inverting proxy to your project:

```sh
pushd ./
cd /tmp
git clone https://github.com/google/inverting-proxy
cd inverting-proxy
make deploy
popd
```

Next, deploy the `datalabstatic` App Engine service to your project.

This serves static content for Datalab instances directly from a single,
read-only instance of Datalab, and makes the UI much more responsive by
avoiding the need to proxy static resources:

Run the following commands to deploy it. The `app deploy` step can sometimes
fail saying that the backend did not report as healthy in time. If that happens,
just retry it:

```sh
gcloud --project ${PROJECT_ID} app deploy staticfiles/*.yaml
```

Now, you can deploy the VM manager, which also runs in an App Engine Flex app.

Before you do, set the value of the `MY_DOMAIN` environment variable to the
domain portion of your user's email addresses. For example, if you are allowing
users with `@example.com` email addresses, then you would run
`export MY_DOMAIN=example.com`:

```sh
sed -i -e "s/MY_DOMAIN/${MY_DOMAIN}/" vmmanager/vmmanager.yaml
gcloud --project ${PROJECT_ID} app deploy vmmanager/vmmanager.yaml
git checkout -- vmmanager/vmmanager.yaml
```

Finally, configure the VM manager as the default backend for your proxy:

```sh
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
    -d "{\"id\": \"vm-manager\", \"endUser\": \"allUsers\", \"pathPrefixes\": [\"\"], \"backendUser\": \"${PROJECT_ID}@appspot.gserviceaccount.com\"}" \
    https://api-dot-${PROJECT_ID}.appspot.com/api/backends
```
