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
#
# The script sets a 'previous' variable in the config_local script to define
# the rollback version. This script should NOT be executed more than once
# using the same image, as it will overwrite this previous field.

PROJECT_ID="${PROJECT_ID:-cloud-datalab}"
TEST_PROJECT_ID="${TEST_PROJECT_ID:-`gcloud config list -q --format 'value(core.project)' 2> /dev/null`}"
export BUILD="${BUILD:-$(date +%Y%m%d)}"
GATEWAY_IMAGE="gcr.io/${PROJECT_ID}/datalab-gateway:${BUILD}"
DATALAB_IMAGE="gcr.io/${PROJECT_ID}/datalab:local-${BUILD}"
DATALAB_GPU_IMAGE="gcr.io/${PROJECT_ID}/datalab-gpu:local-${BUILD}"

echo "Pulling the daily Datalab images: ${GATEWAY_IMAGE}, ${DATALAB_IMAGE}, ${DATALAB_GPU_IMAGE}"
gcloud docker -- pull ${GATEWAY_IMAGE}
gcloud docker -- pull ${DATALAB_IMAGE}
gcloud docker -- pull ${DATALAB_GPU_IMAGE}

echo "Running the Notebook tests..."
mkdir -p tests
git clone https://github.com/googledatalab/notebooks tests/notebooks
docker run \
  --net host \
  -v "$(pwd)/tests:/content/datalab" \
  -e "CLOUDSDK_CORE_PROJECT=${TEST_PROJECT_ID}" \
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
docker tag -f ${DATALAB_IMAGE} gcr.io/${PROJECT_ID}/datalab:latest
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab:latest

echo "Releasing the Datalab GPU image: ${DATALAB_GPU_IMAGE}"
docker tag -f ${DATALAB_GPU_IMAGE} gcr.io/${PROJECT_ID}/datalab-gpu:local
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab-gpu:local
docker tag -f ${DATALAB_GPU_IMAGE} gcr.io/${PROJECT_ID}/datalab-gpu:latest
gcloud docker -- push gcr.io/${PROJECT_ID}/datalab-gpu:latest

CURRENT_DIR=$(dirname "${BASH_SOURCE[0]}")
gsutil cp gs://${PROJECT_ID}/deploy/config_local.js /tmp/config_local.js
${CURRENT_DIR}/generate_config_local.sh /tmp/config_local.js /tmp/config_local_${BUILD}.js
gsutil cp /tmp/config_local_${BUILD}.js gs://${PROJECT_ID}/deploy/config_local_${BUILD}.js
gsutil cp /tmp/config_local_${BUILD}.js gs://${PROJECT_ID}/deploy/config_local.js

echo "Updating the list of sample notebooks"
pushd ./
git_dir=`mktemp -d`
echo "Cloning into temporary directory ${git_dir}"
cd "${git_dir}"
git clone -b master --depth 1 https://github.com/googledatalab/notebooks ./
nb_list=""
for nb in `find ./ -name '*.ipynb' | sed -e 's/^.\//datalab\/docs\//g' -e 's/ /%20/g'`; do
    if [ -n "${nb_list}" ]; then
	nb_list="${nb_list}, "
    fi
    nb_list="${nb_list}\"${nb}\""
done
nb_js="window.datalab.knownTutorials = [${nb_list}];"
echo "${nb_js}" > ./sample_notebooks.js
gsutil cp sample_notebooks.js gs://${PROJECT_ID}/deploy/sample_notebooks_${BUILD}.js
gsutil cp sample_notebooks.js gs://${PROJECT_ID}/deploy/sample_notebooks.js
popd
echo "Removing temporary directory ${git_dir}"
rm -rf "${git_dir}"
