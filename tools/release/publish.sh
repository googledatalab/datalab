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

# This script defines the publishing step of the Datalab release process.
#
# It assumes that a daily build has been built using the `build.sh` script,
# updates the main tags for the images to the given build, and then updates
# the config_local.js file in Google Cloud Storage.

# The script supports two (optional) environment variables that can be
# defined externally to modify its behavior:
#
#  1. "PROJECT_ID": Sets the name of the target project where the
#     images will be pulled from and pushed to. Defaults to "cloud-datalab"
#  2. "BUILD": The label of the builds to pull down and publish. If omitted
#     this will default to the current date (which is what the build.sh
#     script uses by default).

PROJECT_ID="${PROJECT_ID:-cloud-datalab}"
TEST_PROJECT_ID="${TEST_PROJECT_ID:-`gcloud config list -q --format 'value(core.project)' 2> /dev/null`}"
BUILD="${BUILD:-$(date +%Y%m%d)}"
GATEWAY_IMAGE="gcr.io/${PROJECT_ID}/datalab-gateway:${BUILD}"
DATALAB_IMAGE="gcr.io/${PROJECT_ID}/datalab:local-${BUILD}"

echo "Pulling the daily gateway and Datalab images: ${GATEWAY_IMAGE}, ${DATALAB_IMAGE}"
gcloud docker -- pull ${GATEWAY_IMAGE}
gcloud docker -- pull ${DATALAB_IMAGE}

echo "Running the Notebook tests..."
mkdir -p tests
git clone https://github.com/googledatalab/notebooks tests/notebooks
docker run \
  --net host \
  -v "$(pwd)/tests:/content/datalab" \
  -e "PROJECT_ID=${TEST_PROJECT_ID}" \
  --entrypoint /content/datalab/notebooks/.test.sh \
  --workdir /content/datalab/notebooks \
  ${DATALAB_IMAGE}
sudo rm -rf tests

echo "Releasing the gateway image: ${GATEWAY_IMAGE}"
docker tag -f ${GATEWAY_IMAGE} gcr.io/${PROJECT_ID}/datalab-gateway:latest
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab-gateway:latest

echo "Releasing the Datalab image: ${DATALAB_IMAGE}"
docker tag -f ${DATALAB_IMAGE} gcr.io/${PROJECT_ID}/datalab:local
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab:local

gsutil cp gs://${PROJECT_ID}/deploy/config_local.js ./config_local.js
OLD_VERSION=`cat ./config_local.js | grep last | cut -d ':' -f 2`
CURRENT_VERSION=`cat ./config_local.js | grep latest | cut -d ':' -f 2`
NEW_VERSION=" ${BUILD},"

echo "Replacing latest=${CURRENT_VERSION} with latest=${NEW_VERSION}"
sed -i -e "s/${CURRENT_VERSION}/${NEW_VERSION}/" ./config_local.js
echo "Replacing last=${OLD_VERSION} with last=${CURRENT_VERSION}"
sed -i -e "s/${OLD_VERSION}/${CURRENT_VERSION}/" ./config_local.js

gsutil cp ./config_local.js gs://${PROJECT_ID}/deploy/config_local_${BUILD}.js
gsutil cp ./config_local.js gs://${PROJECT_ID}/deploy/config_local.js
