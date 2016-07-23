# DataLab-on-GCP Docker Image

This directory defines a Docker image for running Datalab against a kernel
gateway running in the Google Cloud Platform.

This combines the flexibility and control of storing your notebooks
locally with the performance of running your kernels in the cloud,
close to where your data is stored.

## Building

To build the image simply run the `build.sh` script in this
directory.

```sh
./build.sh
```

## Running

After building, you can run the built image using the `run.sh`
script in this directory. This requires a GCP project to host the
kernel gateway, and a GCE zone where it should be located. These
must be either provided as environment variables, or via the gcloud
default configuration:

```sh
PROJECT_ID="${PROJECT}" ZONE="${COMPUTE_ZONE}" ./run.sh
```

or

```sh
gcloud config set project "${PROJECT}"
gcloud config set compute/zone "${ZONE}"
./run.sh
```

## Authentication

### Used for creating the kernel gateway VM

The bundled `run.sh` script will mount your local gcloud config
directory into the Datalab container, so that you do not have to
reauthenticate inside of the container. This means that the VM
running the kernel gateway will be created using the credentials
of your 'active' account in gcloud.

### Used by the running kernels

Since the kernels are run inside of a GCE VM, they will use the
credentials of that VM for all of their operations. If, instead,
you want to use your personal credentials, then use the 'datalab'
Docker image defined in the `containers/datalab` directory to
run your kernels locally.

## Extending

The Docker image used for running the kernel gateway in your VM
is the one in your project's Google Container Registry bucket
named "gcr.io/${PROJECT_ID}/datalab-gateway".

If it is missing, that image will be built locally based on the
Dockerfile in the `containers/gateway` directory, and then pushed
to your project by the `./run.sh` script.

To override this behavior, simply build your extended image using
the instructions in the `containers/gateway` directory, and then
push your extended image to the Google Container Registry with the
name "gcr.io/${PROJECT_ID}/datalab-gateway".
