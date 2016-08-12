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

USAGE='USAGE: One of...

To run locally:

    docker run -it -p "8081:8080" -v "${HOME}:/content" gcr.io/cloud-datalab/datalab

Or, to connect to a kernel gateway in a GCE VM;

    docker run -it -p "8081:8080" -v "${HOME}:/content" \
      -e "GATEWAY_VM=${PROJECT_ID}/${ZONE}/${INSTANCE}"
      gcr.io/cloud-datalab/datalab
'

ERR_MALFORMED_GATEWAY=1
ERR_LOGIN=2
ERR_PROJECT_NOT_FOUND=3
ERR_ZONE_NOT_FOUND=4
ERR_INSTANCE_NOT_FOUND=5
ERR_DEPLOY=6
ERR_TUNNEL_FAILED=7
ERR_GATEWAY_FAILED=7

# Run the 'setup-env' script to ensure that gcloud has been told to use
# a config directory under the mounted volume (so that the results of
# 'gcloud auth login' are persisted).
source /datalab/setup-env.sh

export PROJECT_ID=${PROJECT_ID:-`gcloud config list -q --format 'value(core.project)' 2> /dev/null`}
export ZONE=${ZONE:-`gcloud config list -q --format 'value(compute.zone)' 2> /dev/null`}

if [[ -n "${GATEWAY_VM}" ]]; then
  GATEWAY_PART_1=`echo "${GATEWAY_VM}" | cut -d '/' -f 1`
  GATEWAY_PART_2=`echo "${GATEWAY_VM}" | cut -d '/' -f 2`
  GATEWAY_PART_3=`echo "${GATEWAY_VM}" | cut -d '/' -f 3`

  if [[ -z "${GATEWAY_PART_3}" &&  -z "${GATEWAY_PART_2}" ]]; then
    export INSTANCE="${GATEWAY_PART_1}"
  elif [[ -z "${GATEWAY_PART_1}" || -z "${GATEWAY_PART_2}" || -z "${GATEWAY_PART_3}" ]]; then
    echo "Malformed gateway VM name"
    echo "${USAGE}"
    exit "${ERR_MALFORMED_GATEWAY}"
  else
    export PROJECT_ID="${GATEWAY_PART_1}"
    export ZONE="${GATEWAY_PART_2}"
    export INSTANCE="${GATEWAY_PART_3}"
  fi
fi

if [[ -n "${INSTANCE}" ]]; then
  USER_EMAIL=`gcloud auth list --format="value(account)"`
  if [[ -z "${USER_EMAIL}" ]]; then
    FAILED_LOGIN=""
    gcloud auth login || FAILED_LOGIN="true"
    if [[ -n "${FAILED_LOGIN}" ]]; then
      echo "Failed to log in to gcloud"
      exit "${ERR_LOGIN}"
    fi
  fi

  PROJECT_NOT_FOUND=""
  ZONE_NOT_FOUND=""
  INSTANCE_NOT_FOUND=""

  if [[ -z "${PROJECT_ID}" ]]; then
    read -p "Please enter the Google Cloud Platform project to use: " PROJECT_ID
  fi
  # Verify that the specified project exists...
  gcloud -q projects describe "${PROJECT_ID}" >/dev/null 2>&1 || PROJECT_NOT_FOUND="true"
  if [[ -n "${PROJECT_NOT_FOUND}" ]]; then
    echo "Project ${PROJECT_ID} not found"
    echo "${USAGE}"
    exit "${ERR_PROJECT_NOT_FOUND}"
  fi
  # Persist the project for future runs.
  gcloud config set project "${PROJECT_ID}"

  if [[ -z "${ZONE}" ]]; then
    read -p "Please enter the zone where the VM should be located: " ZONE
  fi
  # Verify that the specified zone exists...
  gcloud -q compute zones describe "${ZONE}" >/dev/null 2>&1 || ZONE_NOT_FOUND="true"
  if [[ -n "${ZONE_NOT_FOUND}" ]]; then
    echo "Zone ${ZONE} not found"
    echo "${USAGE}"
    exit "${ERR_ZONE_NOT_FOUND}"
  fi
  # Persist the project and zone for future runs.
  gcloud config set compute/zone "${ZONE}"

  # Verify that the specified instance exists...
  gcloud -q compute instances describe "${INSTANCE}" >/dev/null 2>&1 || INSTANCE_NOT_FOUND="true"
  if [[ -n "${INSTANCE_NOT_FOUND}" ]]; then
    echo "Instance ${INSTANCE} not found"
    if [[ "${DEPLOY_VM}" == "true" ]]; then
      /datalab/deploy.sh "${PROJECT_ID}" "${ZONE}" "${INSTANCE}" || exit ${ERR_DEPLOY}
    else
      echo "${USAGE}"
      exit "${ERR_INSTANCE_NOT_FOUND}"
    fi
  fi

  echo "Will connect to the kernel gateway running on the GCE VM ${INSTANCE}"
  gcloud compute ssh --quiet \
    --project "${PROJECT_ID}" \
    --zone "${ZONE}" \
    --ssh-flag="-fNL" \
    --ssh-flag="localhost:8082:localhost:8080" \
    "${INSTANCE}"

  # Test that we can actually call the gateway API via the SSH tunnel
  TUNNEL_FAILED=""
  curl -o /tmp/kernel_specs http://localhost:8082/api/kernelspecs 2>/dev/null || TUNNEL_FAILED="true"
  if [[ "${TUNNEL_FAILED}" == true ]]; then
    echo "Failed to set up the SSH tunnel to the VM ${INSTANCE}"
    echo "If the VM was recently created, then it may still be starting up, and retrying the command may work."
    exit "${ERR_TUNNEL_FAILED}"
  fi

  DEFAULT_KERNEL_SPEC=`cat /tmp/kernel_specs | python -c $'import json\nprint json.loads(raw_input())["default"]'`
  if [[ -z "${DEFAULT_KERNEL_SPEC}" ]]; then
    echo "Failed to verify that the kernel gateway is running"
    echo "If the VM was recently created, then it may still be starting up, and retrying the command may work."
    exit "${ERR_GATEWAY_FAILED}"
  fi

  export EXPERIMENTAL_KERNEL_GATEWAY_URL="http://localhost:8082"
fi

mkdir -p /content/datalab/notebooks
mkdir -p /content/datalab/docs

if [ -d /content/datalab/docs/notebooks/.git ]
then
  (cd /content/datalab/docs/notebooks; git fetch origin master; git reset --hard origin/master)
else
  (cd /content/datalab/docs; git clone -b master --single-branch https://github.com/googledatalab/notebooks.git)
fi

# Run the user's custom extension script if it exists. To avoid platform issues with 
# execution permissions, line endings, etc, we create a local sanitized copy.
if [ -f /content/datalab/.config/startup.sh ]
then
  tr -d '\r' < /content/datalab/.config/startup.sh > ~/startup.sh
  chmod +x ~/startup.sh
  . ~/startup.sh
fi

# Install the kernel gateway server extension, if a kernel gateway URL has been specified
if [ -n "${KG_URL}" ]
then
    jupyter serverextension enable --py nb2kg --sys-prefix
fi

# Start the DataLab server
FOREVER_CMD="forever --minUptime 1000 --spinSleepTime 1000"
if [ -z "${DATALAB_DEBUG}" ]
then
  echo "Starting Datalab in silent mode, for debug output, rerun with an additional '-e DATALAB_DEBUG=true' argument"
  FOREVER_CMD="${FOREVER_CMD} -s"
fi

echo "Open your browser to http://localhost:8081/ to connect to Datalab."
${FOREVER_CMD} /datalab/web/app.js
