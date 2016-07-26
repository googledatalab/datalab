#!/bin/sh
# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Runs the docker container locally. Auth will happen in the browser when
# the user first opens Datalab after accepting the EULA.

# Passing in 'shell' flag causes the docker container to break into a
# command prompt, which is useful for tinkering within the container before
# manually starting the server.

CONTENT=${HOME}
ENTRYPOINT="/datalab/run-with-gce.sh"
if [ "$1" != "" ]; then
  if [ "$1" != "shell" ]; then
    CONTENT=$1
    shift
  fi
  if [ "$1" == "shell" ]; then
    ENTRYPOINT="/bin/bash"
  fi
fi

USAGE="USAGE: ${0} [<CONTENT_DIR>]

Where <CONTENT_DIR> is the directory holding the notebooks that you want
to use with Datalab.

Additionally (for debugging), you can pass in a 'shell' argument to open
a shell inside of the Datalab container, rather than starting Datalab.

    ${0} [<CONTENT_DIR>] shell

You must have the 'gcloud' command line tool installed, and have at least
one (active) account authenticated with gcloud, in order for the container
to be able to set up the kernel gateway for you. Instructions for installing
gcloud are here: https://cloud.google.com/sdk/downloads.

To ensure that a previously installed version of gcloud is up-to-date, run:

    gcloud components update gcloud core

To set up an active account in gcloud, run:

    gcloud auth login

Finally, you must also specify a project ID and zone. The project ID is the
ID of the Google Cloud Platform project that will host the kernel gateway and
the zone is the Google Compute Engine zone where the kernel gateway will run.

These may be specified by either setting the PROJECT_ID and ZONE environment
variables, or by setting the default project and zone using the gcloud tool:

    gcloud config set project <PROJECT_ID>
    gcloud config set compute/zone <ZONE>
"

# Verify that the necessary prerequisites have been set
GCLOUD_ACCOUNT=`gcloud auth list --format 'value(active_account)'`
PROJECT_ID=${PROJECT_ID:-`gcloud config list 2> /dev/null | grep 'project = ' | cut -d ' ' -f 3`}
ZONE=${ZONE:-`gcloud config list 2> /dev/null | grep 'zone = ' | cut -d ' ' -f 3`}

if [[ -z "${CONTENT}" || -z "${GCLOUD_ACCOUNT}" || -z "${PROJECT_ID}" || -z "${ZONE}" ]]; then
  echo "${USAGE}"
  exit 1
fi

# Ensure that the target project has a copy of the gateway image.
# We do this rather than pointing the VM directly at a public
# image so that:
#
# 1. The VM will not accidentally pick up a new version when rebooted.
# and
# 2. The project can switch to a version of the image with custom extensions.
GATEWAY_IMAGE="gcr.io/${PROJECT_ID}/datalab-gateway"

# Only update the gateway image if it has not been pushed to the project yet.
# We want to enforce that the image is there, but do not want to
# override a previously pushed image in case the project has a
# customized gateway image.
gcloud docker pull "${GATEWAY_IMAGE}" || PUSH_IMAGE="true"
if [ "${PUSH_IMAGE}" == "true" ]; then
  # TODO(ojarjur): Remove this block after the
  # "gcr.io/cloud-datalab/datalab-gateway" image is published, and
  # instead just pull that image.
  if [ "$(docker images -q datalab-gateway)" == "" ]; then
    # We do not have a local version of the datalab-gateway image, so build it
    cd ../gateway
    ./build.sh
    cd ../gcp
  fi

  docker tag -f datalab-gateway "${GATEWAY_IMAGE}"
  gcloud --project="${PROJECT_ID}" docker push "${GATEWAY_IMAGE}"
fi

# On linux docker runs directly on host machine, so bind to 127.0.0.1 only
# to avoid it being accessible from network.
# On other platform, it needs to bind to all ip addresses so VirtualBox can
# access it. Users need to make sure in their VirtualBox port forwarding
# settings only 127.0.0.1 is bound.
if [ "$OSTYPE" == "linux"* ]; then
  PORTMAP="127.0.0.1:8081:8080"
else
  PORTMAP="8081:8080"
fi
# Use this flag to map in web server content during development
#  -v $REPO_DIR/sources/web:/sources \
docker run -it --entrypoint=$ENTRYPOINT \
  -p $PORTMAP \
  -v "${CONTENT}:/content" \
  -e "PROJECT_ID=${PROJECT_ID}" \
  -e "ZONE=${ZONE}" \
  datalab-gcp
