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
CLI_TARBALL="datalab-cli-${LABEL}.tgz"

function install_node() {
  echo "Installing NodeJS"

  mkdir -p /tools/node
  wget -nv https://nodejs.org/dist/v4.3.2/node-v4.3.2-linux-x64.tar.gz -O node.tar.gz
  tar xzf node.tar.gz -C /tools/node --strip-components=1
  rm node.tar.gz
  export "PATH=${PATH}:/tools/node/bin"
}

function install_typescript() {
  npm -h >/dev/null 2>&1 || install_node

  echo "Installing Typescript"
  npm install -g typescript
}

function install_prereqs() {
  tsc -h >/dev/null 2>&1  || install_typescript
  rsync -h >/dev/null 2>&1  || apt-get install -y -qq rsync
  source ./tools/initenv.sh
}

pushd ./
cd $(dirname "${BASH_SOURCE[0]}")/../../
install_prereqs

echo "Building the base image"
cd containers/base

# We do not use the base image's `build.sh` script because we
# want to make sure that we are not using any cached layers.
mkdir -p pydatalab
docker build --no-cache -t datalab-base .
rm -rf pydatalab

echo "Building the gateway image ${GATEWAY_IMAGE}"
cd ../../containers/gateway
./build.sh
docker tag -f datalab-gateway ${GATEWAY_IMAGE}
gcloud docker -- push ${GATEWAY_IMAGE}

echo "Building the Datalab image ${DATALAB_IMAGE}"
cd ../../containers/datalab
./build.sh
docker tag -f datalab ${DATALAB_IMAGE}
gcloud docker -- push ${DATALAB_IMAGE}

cd ../../
tar -cvzf "/tmp/${CLI_TARBALL}" --transform 's,^tools/cli,datalab,' tools/cli
gsutil cp "/tmp/${CLI_TARBALL}" "gs://${PROJECT_ID}/${CLI_TARBALL}"

popd

