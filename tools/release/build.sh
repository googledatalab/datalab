#!/bin/bash -e

# Copyright 2016 Google Inc. All rights reserved.
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

# This script defines the automated build step of the Datalab release process.
#
# That involves a clean build (not using the Docker image cache) of
# the datalab-base, datalab-gateway, and datalab images; tagging the
# resulting images with the current date; and then pushing the
# datalab and datalab-gateway images to the Google Container Registry.

# The script supports two (optional) environment variables that can be
# defined externally to modify its behavior:
#
#  1. "PROJECT_ID": Sets the name of the target project where the
#     images will be pushed. Defaults to "cloud-datalab"
#  2. "LABEL_PREFIX": Adds a prefix to the image labels. This defaults
#     to the empty string and is intended for things like feature builds.

PROJECT_ID="${PROJECT_ID:-cloud-datalab}"
TIMESTAMP=$(date +%Y%m%d)
LABEL="${LABEL_PREFIX:-}${TIMESTAMP}"
GATEWAY_IMAGE="gcr.io/${PROJECT_ID}/datalab-gateway:${LABEL}"
DATALAB_IMAGE="gcr.io/${PROJECT_ID}/datalab:local-${LABEL}"
DATALAB_GPU_IMAGE="gcr.io/${PROJECT_ID}/datalab-gpu:local-${LABEL}"
CLI_TARBALL="datalab-cli-${LABEL}.tgz"

pushd $(pwd) >> /dev/null
BASE_DIR="$(cd $(dirname "${BASH_SOURCE[0]}")/../../ && pwd)"

echo "Building the base image"
cd "${BASE_DIR}/containers/base"

DOCKER_BUILD_ARGS="--no-cache"
./build.sh
echo "Building the base GPU image"
./build.gpu.sh

echo "Building the gateway image ${GATEWAY_IMAGE}"
cd "${BASE_DIR}/containers/gateway"
./build.sh
if ! $(docker tag -f datalab-gateway ${GATEWAY_IMAGE}); then
  docker tag datalab-gateway ${GATEWAY_IMAGE}
fi
gcloud docker -- push ${GATEWAY_IMAGE}

echo "Building the Datalab server"
cd "${BASE_DIR}"
./sources/build.sh

echo "Building the Datalab image ${DATALAB_IMAGE}"
cd "${BASE_DIR}/containers/datalab"
./build.sh
if ! $(docker tag -f datalab ${DATALAB_IMAGE}); then
  docker tag datalab ${DATALAB_IMAGE}
fi
gcloud docker -- push ${DATALAB_IMAGE}

echo "Building the Datalab GPU image ${DATALAB_GPU_IMAGE}"
cd "${BASE_DIR}/containers/datalab"
./build.gpu.sh
if ! $(docker tag -f datalab-gpu ${DATALAB_GPU_IMAGE}); then
  docker tag datalab-gpu ${DATALAB_GPU_IMAGE}
fi
docker tag -f datalab-gpu ${DATALAB_GPU_IMAGE}
gcloud docker -- push ${DATALAB_GPU_IMAGE}

cd "${BASE_DIR}"
tar -cvzf "/tmp/${CLI_TARBALL}" --transform 's,^tools/cli,datalab,' tools/cli
gsutil cp "/tmp/${CLI_TARBALL}" "gs://${PROJECT_ID}/${CLI_TARBALL}"

popd >> /dev/null
