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

    docker run -it -p "8081:8080" -v "${HOME}:/content" gcr.io/cloud-datalab/datalab:local

Or, to connect to a kernel gateway in a GCE VM;

    docker run -it -p "8081:8080" -v "${HOME}:/content" \
      -e "GATEWAY_VM=${PROJECT_ID}/${ZONE}/${INSTANCE}"
      gcr.io/cloud-datalab/datalab:local
'

ERR_MALFORMED_GATEWAY=1
ERR_LOGIN=2
ERR_PROJECT_NOT_FOUND=3
ERR_ZONE_NOT_FOUND=4
ERR_INSTANCE_NOT_FOUND=5
ERR_DEPLOY=6
ERR_GCLOUD_SSH_FAILED=7
ERR_TUNNEL_FAILED=8
ERR_GATEWAY_FAILED=9

run_login() {
  local login_cmd=${1:-"gcloud auth login"}

  USER_EMAIL=`gcloud auth list --format="value(account)"`
  if [[ -z "${USER_EMAIL}" ]]; then
    local failed_login=""
    ${login_cmd} || failed_login="true"
    if [[ -n "${failed_login}" ]]; then
      echo "Failed to log in to gcloud"
      exit "${ERR_LOGIN}"
    fi
  fi
  USER_EMAIL=`gcloud auth list --format="value(account)"`
}

kill_container() {
  echo "Failing with error code $1"
  # Docker will keep running as long as any processes remain
  # running, so we have to kill all of them (not just the first process)
  for PID in `ps -o pid=`; do
    # We have to make sure that the current process does not get
    # killed until it has finished killing all the other processes  
    if [ "$PID" != "$BASHPID" ]; then
      kill -SIGKILL $PID 2>&1 > /dev/null
    fi
  done

  # Finally, we kill the current process.
  exit $1
}

setup_tunnel() {
  project_id=$1
  zone=$2
  instance=$3
  ssh_user=$4
  echo "Will connect to the kernel gateway running on the GCE VM ${instance} as ${ssh_user}"
  gcloud compute ssh --quiet \
    --project "${project_id}" \
    --zone "${zone}" \
    --ssh-flag="-fNL" \
    --ssh-flag="localhost:8082:localhost:8080" \
    --ssh-key-file="/content/datalab/.config/.ssh/google_compute_engine" \
    "${ssh_user}@${instance}" || kill_container "${ERR_GCLOUD_SSH_FAILED}"

  # Test that we can actually call the gateway API via the SSH tunnel
  tunnel_failed=""
  curl -o /tmp/kernel_specs http://localhost:8082/api/kernelspecs 2>/dev/null || tunnel_failed="true"
  if [[ "${tunnel_failed}" == true ]]; then
    echo "Failed to set up the SSH tunnel to the VM ${instance}"
    echo "If the VM was recently created, then it may still be starting up, and retrying the command may work."
    kill_container "${ERR_TUNNEL_FAILED}"
  fi

  default_kernel_spec=`cat /tmp/kernel_specs | python -c $'import json\nprint json.loads(raw_input())["default"]'`
  if [[ -z "${default_kernel_spec}" ]]; then
    echo "Failed to verify that the kernel gateway is running"
    echo "If the VM was recently created, then it may still be starting up, and retrying the command may work."
    kill_container "${ERR_GATEWAY_FAILED}"
  fi
  echo "Successfully established SSH tunnel to ${instance}"

  watch_and_restart_tunnel "${project_id}" "${zone}" "${instance}" "${ssh_user}" &
}

watch_and_restart_tunnel() {
  project_id=$1
  zone=$2
  instance=$3
  ssh_user=$4
  
  while [ "$(ps --ppid $$ -o comm= | grep ssh)" != "" ]; do
    sleep 5
  done
  echo "Restarting SSH tunnel"
  setup_tunnel "${project_id}" "${zone}" "${instance}" "${ssh_user}"
}

source /datalab/setup-env.sh

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

if [[ "${CLI_LOGIN}" == "true" ]]; then
  run_login
fi

if [[ -n "${INSTANCE}" ]]; then
  run_login "node /datalab/web/login.js 2>/dev/null"

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

  SSH_USER=`echo ${USER_EMAIL} | cut -d '@' -f 1`
  setup_tunnel "${PROJECT_ID}" "${ZONE}" "${INSTANCE}" "${SSH_USER}"
  export EXPERIMENTAL_KERNEL_GATEWAY_URL="http://localhost:8082"
fi

if [ -n "${EXPERIMENTAL_KERNEL_GATEWAY_URL}" ]
then
  export KG_URL="${EXPERIMENTAL_KERNEL_GATEWAY_URL}"
fi

if [ "${ENABLE_USAGE_REPORTING}" = "true" ]
then
  if [ -n "${PROJECT_ID}" ]
  then
    export PROJECT_NUMBER=`gcloud projects describe "${PROJECT_ID}" --format 'value(projectNumber)' 2>/dev/null || true`
  fi
fi

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
fi

# Install the kernel gateway server extension, if a kernel gateway URL has been specified
if [ -n "${KG_URL}" ]
then
  jupyter serverextension enable --py nb2kg --sys-prefix
fi

# Create the notebook notary secret if one does not already exist
if [ ! -f /content/datalab/.config/notary_secret ]
then
  mkdir -p /content/datalab/.config
  openssl rand -base64 128 > /content/datalab/.config/notary_secret
fi

# Start the ungit server
ungit --port=8083 --no-launchBrowser --forcedLaunchPath=/content/datalab --ungitVersionCheckOverride 1> /dev/null &

# Start the DataLab server
if [ -z "${DATALAB_DEBUG}" ]
then
  echo "Starting Datalab in silent mode, for debug output, rerun with an additional '-e DATALAB_DEBUG=true' argument"
else
  # The Datalab job logs to this file, make sure it exists and tail it
  touch /var/log/datalab.stdout.log
  tail -f /var/log/datalab.stdout.log &
fi
echo "Open your browser to http://localhost:8081/ to connect to Datalab."
supervisord -n -c /etc/supervisor/conf.d/datalab.conf

