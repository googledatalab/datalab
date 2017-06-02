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

# This script defines the rollback process for Datalab.
#
# It assumes that there is at least one build that has been released using
# the build.sh and publish.sh scripts. The rollback works by getting the
# previous release name from the config_local.js file in Google Cloud
# Storage. The desired rollback can also be specified as an argument.

# The script supports two (optional) environment variables that can be
# defined externally to modify its behavior:
#
# 1. "PROJECT_ID": Sets the name of the target project where the
#    images will be pulled from and pushed to. Defaults to "cloud-datalab"
# 2. "ROLLBACK_BUILD": The label of the build to pull down and rollback to.
#    If omitted, this will extract the 'previous' field from the config_local.js

PROJECT_ID="${PROJECT_ID:-cloud-datalab}"

gsutil cp gs://${PROJECT_ID}/deploy/config_local.js ./config_local.js
if [[ $(cat ./config_local.js | grep "PREV_SEMVER = ") ]]; then
  REGEX='PREV_SEMVER = "(.*)";'
else
  REGEX='previous: ([0-9]+)'
fi
if [[ $(cat config_local.js) =~ $REGEX ]]; then
  OLD_BUILD=${BASH_REMATCH[1]}
  PREVIOUS_BUILD="${ROLLBACK_BUILD:-$OLD_BUILD}"
else
  echo "Could not extract previous build to rollback to. Aborting."
  exit 1
fi

GATEWAY_IMAGE="gcr.io/${PROJECT_ID}/datalab-gateway:${PREVIOUS_BUILD}"
DATALAB_IMAGE="gcr.io/${PROJECT_ID}/datalab:local-${PREVIOUS_BUILD}"
DATALAB_GPU_IMAGE="gcr.io/${PROJECT_ID}/datalab-gpu:local-${PREVIOUS_BUILD}"

read -p "Proceed to release ${GATEWAY_IMAGE}, ${DATALAB_GPU_IMAGE}, and ${DATALAB_IMAGE} as latest? [Y/n]: " answer
if echo $answer | grep -iq -v '^y'; then
  exit 1
fi

echo "Updating config_local_${PREVIOUS_BUILD}.js to be config_local.js"
gsutil cp gs://${PROJECT_ID}/deploy/config_local_${PREVIOUS_BUILD}.js gs://${PROJECT_ID}/deploy/config_local.js

echo "Pulling the rollback gateway and Datalab images: ${GATEWAY_IMAGE}, ${DATALAB_IMAGE}"
gcloud docker -- pull ${GATEWAY_IMAGE}
gcloud docker -- pull ${DATALAB_IMAGE}

echo "Releasing the gateway image: ${GATEWAY_IMAGE}"
docker tag -f ${GATEWAY_IMAGE} gcr.io/${PROJECT_ID}/datalab-gateway:latest
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab-gateway:latest

echo "Releasing the Datalab image: ${DATALAB_IMAGE}"
docker tag -f ${DATALAB_IMAGE} gcr.io/${PROJECT_ID}/datalab:local
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab:local

echo "Pulling the rollback GPU images: ${DATALAB_GPU_IMAGE}"
# This will fail and exit if the previous GPU image doesn't exist.
# This will happen if we try to rollback the first GPU release, and
# that is fine since there is nothing to rollback to.
gcloud docker -- pull ${DATALAB_GPU_IMAGE} || exit 0
echo "Releasing the Datalab GPU image: ${DATALAB_GPU_IMAGE}"
docker tag -f ${DATALAB_GPU_IMAGE} gcr.io/${PROJECT_ID}/datalab-gpu:local
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab-gpu:local
