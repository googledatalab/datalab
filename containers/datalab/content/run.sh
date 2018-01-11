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

# This script supports a live mode in which a datalab git-clone directory is
# mapped to /devroot in this container. When /devroot exists, this script
# sets things up so that changes are immediately picked up by the noteboook
# server. For files in the static and templates directories, this means the
# developer can just modify the files in their datalab source tree and
# reload the web page to pick up the changes. For typescript
# files that get compiled into javascript, the developer needs to run the
# build script for those files, after which the changes will get noticed by
# the notebook server and it will automatically restart.

[ -n "${EXTERNAL_PORT}" ] || EXTERNAL_PORT=8081
USAGE='USAGE:

    docker run -it -p "EXTERNAL_PORT:8080" -v "${HOME}:/content" gcr.io/cloud-datalab/datalab:local

where EXTERNAL_PORT can be 8080, 8081 etc.
'

GATEWAY_DEPRECATED_MSG='Running Datalab against a kernel gateway is no longer supported.

Please either switch to running all of Datalab in a VM via the `datalab` command line tool,
or continue to use the unsupported image gcr.io/cloud-datalab/datalab:local-20170224
'

ERR_UNSUPPORTED_GATEWAY_OPTION=1
ERR_TMP_NOT_WRITABLE=2

if [ -n "${GATEWAY_VM}" ] || [ -n "${EXPERIMENTAL_KERNEL_GATEWAY_URL}" ] || [ -n "${KG_URL}" ]; then
  echo "${GATEWAY_DEPRECATED_MSG}"
  exit "${ERR_UNSUPPORTED_GATEWAY_OPTION}"
fi

PYTHON2_ENV='py2env'
PYTHON3_ENV='py3env'

check_tmp_directory() {
    echo "Verifying that the /tmp directory is writable"
    test_temp_file=$(mktemp --tmpdir=/tmp)
    if [ ! -e "${test_temp_file}" ]; then
	echo "Unable to write to the /tmp directory"
	exit "${ERR_TMP_NOT_WRITABLE}"
    fi
    rm "${test_temp_file}"
    echo "The /tmp directory is writable"
}

# Reinstall the parts of pydatalab from /content/pydatalab, which is where it gets live-mounted.
function reinstall_pydatalab() {
  PYDATALAB=/content/pydatalab
  echo "Reinstalling pydatalab from ${PYDATALAB}"
  source deactivate
  source activate ${PYTHON2_ENV}
  pip install --upgrade --no-deps --force-reinstall --no-cache-dir ${PYDATALAB}
  pip install --upgrade --no-deps --force-reinstall ${PYDATALAB}/solutionbox/image_classification/.
  pip install --upgrade --no-deps --force-reinstall ${PYDATALAB}/solutionbox/structured_data/.
  source deactivate
  source activate ${PYTHON3_ENV}
  pip install --upgrade --no-deps --force-reinstall --no-cache-dir ${PYDATALAB}
  pip install --upgrade --no-deps --force-reinstall ${PYDATALAB}/solutionbox/image_classification/.
  pip install --upgrade --no-deps --force-reinstall ${PYDATALAB}/solutionbox/structured_data/.
  source deactivate
  echo "Done reinstalling pydatalab"
}

if [ -d "$HOME" ]; then
  source /datalab/setup-env.sh
fi

if [ "${ENABLE_USAGE_REPORTING}" = "true" ]
then
  if [ -n "${PROJECT_ID}" ]
  then
    export PROJECT_NUMBER=${PROJECT_NUMBER:-`gcloud projects describe "${PROJECT_ID}" --format 'value(projectNumber)' 2>/dev/null || true`}
  fi
fi

# Verify that we can write to the /tmp directory
check_tmp_directory

# Make sure widgets notebook extension is installed correctly at /content/.jupyter after the docker volume is mounted.
jupyter nbextension enable --py widgetsnbextension

# Make sure the notebooks directory exists
mkdir -p /content/datalab/notebooks

# Fetch docs and tutorials. This should not abort startup if it fails
{
if [ -d /content/datalab/docs ]; then
  # The docs directory already exists, so we have to either update or initialize it as a git repository
  pushd ./
  cd /content/datalab/docs
  if [ -d /content/datalab/docs/.git ]; then
    git fetch origin master; git reset --hard origin/master
  else
    git init; git remote add origin https://github.com/googledatalab/notebooks.git; git fetch origin;
  fi
  popd
else
  (cd /content/datalab; git clone -n --single-branch https://github.com/googledatalab/notebooks.git docs)
fi
(cd /content/datalab/docs; git config core.sparsecheckout true; echo $'intro/\nsamples/\ntutorials/\n*.ipynb\n' > .git/info/sparse-checkout; git checkout master)
} || echo "Fetching tutorials and samples failed."

# Run the user's custom extension script if it exists. To avoid platform issues with
# execution permissions, line endings, etc, we create a local sanitized copy.
if [ -f /content/datalab/.config/startup.sh ]
then
  tr -d '\r' < /content/datalab/.config/startup.sh > ~/startup.sh
  chmod +x ~/startup.sh
  . ~/startup.sh
fi

# Get VM information if running on google cloud
compute_metadata_url="http://metadata.google.internal/computeMetadata/v1"
vm_project=$(curl -s "${compute_metadata_url}/project/project-id" -H "Metadata-Flavor: Google" || true)
if [ -n "${vm_project}" ] && [ "${vm_project}" != "no-project-id" ]; then
   export VM_PROJECT="${vm_project}"
   export VM_NAME=$(curl -s "${compute_metadata_url}/instance/hostname" -H "Metadata-Flavor: Google" | cut -d '.' -f 1)
   export VM_ZONE=$(curl -s "${compute_metadata_url}/instance/zone" -H "Metadata-Flavor: Google" | sed 's/.*zones\///')
   export DATALAB_SHUTDOWN_COMMAND="gcloud compute instances stop ${VM_NAME} --project ${VM_PROJECT} --zone ${VM_ZONE}"
fi

# Create the notebook notary secret if one does not already exist
if [ ! -f /content/datalab/.config/notary_secret ]
then
  mkdir -p /content/datalab/.config
  openssl rand -base64 128 > /content/datalab/.config/notary_secret
fi

# Parse the settings overrides to get the (potentially overridden) value
# of the `datalabBasePath` setting.
EMPTY_BRACES="{}"
DATALAB_BASE_PATH=$(echo ${DATALAB_SETTINGS_OVERRIDES:-$EMPTY_BRACES} | python -c "import sys,json; print(json.load(sys.stdin).get('datalabBasePath',''))")

# Start the ungit server
ungit --port=8083 --no-launchBrowser --forcedLaunchPath=/content/datalab --ungitVersionCheckOverride 1 --rootPath="${DATALAB_BASE_PATH}" > /dev/null &

# Start the DataLab server
FOREVER_CMD="forever --minUptime 1000 --spinSleepTime 1000"
if [ -z "${DATALAB_DEBUG}" ]
then
  echo "Starting Datalab in silent mode, for debug output, rerun with an additional '-e DATALAB_DEBUG=true' argument"
  FOREVER_CMD="${FOREVER_CMD} -s"
fi

if [ -d /devroot ]; then
  # For development purposes, if the user has mapped a /devroot dir, use it.
  echo "Running notebook server in live mode"
  export DATALAB_LIVE_STATIC_DIR=/devroot/sources/web/datalab/static
  export DATALAB_LIVE_TEMPLATES_DIR=/devroot/sources/web/datalab/templates
  # Use our internal node_modules dir
  export NODE_PATH="${NODE_PATH}:/datalab/web/node_modules"
  if [ -d /content/pydatalab ]; then
    reinstall_pydatalab
  fi
  # Prevent (harmless) error message about missing .foreverignore
  IGNOREFILE=/devroot/build/web/nb/.foreverignore
  [ -f ${IGNOREFILE} ] || touch ${IGNOREFILE}
  # Auto-restart when the developer builds from the typescript files.
  source activate ${PYTHON3_ENV}
  echo ${FOREVER_CMD} --watch --watchDirectory /devroot/build/web/nb /devroot/build/web/nb/app.js
  ${FOREVER_CMD} --watch --watchDirectory /devroot/build/web/nb /devroot/build/web/nb/app.js
else
  source activate ${PYTHON3_ENV}
  echo "Open your browser to http://localhost:${EXTERNAL_PORT}/ to connect to Datalab."
  ${FOREVER_CMD} /datalab/web/app.js
fi
