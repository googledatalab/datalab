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

PROJECT_ID="${PROJECT_ID:-cloud-datalab}"
BUILD="${BUILD:-$(date +%Y%m%d)}"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/datalab-gateway:${BUILD}"
FRONTEND_IMAGE="gcr.io/${PROJECT_ID}/datalab:local-${BUILD}"

echo "Releasing the backend image: ${BACKEND_IMAGE}"
gcloud docker -- pull ${BACKEND_IMAGE}
docker tag -f ${BACKEND_IMAGE} gcr.io/${PROJECT_ID}/datalab-gateway:latest
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab-gateway:latest

echo "Releasing the frontend image: ${FRONTEND_IMAGE}"
gcloud docker -- pull ${FRONTEND_IMAGE}
docker tag -f ${FRONTEND_IMAGE} gcr.io/${PROJECT_ID}/datalab:local
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab:local

gsutil cp gs://${PROJECT_ID}/deploy/config_local.js ./config_local.js
OLD_VERSION=`cat ./config_local.js | grep latest | cut -d ':' -f 2`
NEW_VERSION=" ${BUILD},"
echo "Replacing ${OLD_VERSION} with ${NEW_VERSION}"
sed -i -e "s/${OLD_VERSION}/${NEW_VERSION}/" ./config_local.js
gsutil cp ./config_local.js gs://${PROJECT_ID}/deploy/config_local_${BUILD}.js
gsutil cp ./config_local.js gs://${PROJECT_ID}/deploy/config_local.js
