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

USAGE="USAGE: ${0}

You must also provide a project ID and zone. The project ID is the ID of
the Google Cloud Platform project that will host the kernel gateway and 
the zone is the Google Compute Engine zone where the kernel gateway will run.

These may be specified by either setting the PROJECT_ID and ZONE environment
variables, or by responding to command line prompts.
"

ERR_LOGIN=1
ERR_PROJECT_NOT_FOUND=2
ERR_ZONE_NOT_FOUND=3
ERR_INSTANCE_NOT_FOUND=3
ERR_DEPLOY=4

DOCS="This script runs Datalab connected to a kernel gateway running in a GCE VM.

The script will first look to see if there is an existing kernel gateway VM,
and if it cannot find one then it will create one using the
'../gateway/deploy.sh' script.

The connection between the locally-running Datalab instance and the kernel
gateway will be tunnelled through an SSH session to the VM hosting the kernel
gateway. When this script is terminated, it will also kill that SSH session.

If a new GCE VM is created, then it will remain running until deleted, so
please remember to delete that VM if you no longer need it to avoid incurring
unnecessary costs.
"

echo "${DOCS}"

# Run the 'setup-env' script to ensure that gcloud has been told to use
# a config directory under the mounted volume (so that the results of
# 'gcloud auth login' are persisted).
source /datalab/setup-env.sh
export HOME=/content

USER_EMAIL=`gcloud info --format="value(config.account)"`
if [[ -z "${USER_EMAIL}" ]]; then
  gcloud auth login || exit "${ERR_LOGIN}"
fi

export PROJECT_ID=${PROJECT_ID:-`gcloud config list -q --format 'value(core.project)' 2> /dev/null`}
export ZONE=${ZONE:-`gcloud config list -q --format 'value(compute.zone)' 2> /dev/null`}

if [[ -z "${PROJECT_ID}" ]]; then
  read -p "Please enter the Google Cloud Platform project to use: " PROJECT_ID

  gcloud projects describe "${PROJECT_ID}" || exit "${ERR_PROJECT_NOT_FOUND}"
fi

if [[ -z "${ZONE}" ]]; then
  read -p "Please enter the zone where the VM should be located: " ZONE

  gcloud compute zones --project "${PROJECT_ID}" describe "${ZONE}" || exit "${ERR_ZONE_NOT_FOUND}"
fi

# Persist the project and zone for future runs.
gcloud config set project "${PROJECT_ID}"
gcloud config set compute/zone "${ZONE}"

if [[ -z "${INSTANCE}" ]]; then
  # We want to run the kernel gateway in a VM. However, we also want to make sure
  # there is a 1:1 correspondence between end user and kernel gateway, so we need
  # to create a separate VM for each user.
  #
  # To do this, we will name the VM with a prefix tied to the user.
  #
  # NOTE: THIS IS NOT A SECURITY SANDBOX. When running in a GCE VM, Datalab is in
  # an inherently shared environment. This separation is merely to prevent
  # accidental conflicts between users, not to provide any sort of privacy or
  # authentication.
  USER_EMAIL=`gcloud info --format="value(config.account)"`
  echo "Looking up gateway VM for ${USER_EMAIL}..."

  # We would like to give the VM a friendly name based on the user, but VM names
  # can only contain letters, numbers, and hyphens, whereas email addresses can
  # contain any characters.
  #
  # We resolve this conflict by trying a simple escaping of the email address,
  # and if that does not produce a valid instance name, then we just hash the
  # email address and use the hash.
  #
  # The escaping we do is based on a 1:1 mapping from '[-@.a-zA-Z0-9]+' to
  # '[-a-zA-Z0-9]+'. Since this mapping is 1:1, we ensure that the uniqueness
  # of email addresses is maintained. There is additionally a length limit
  # of 63 characters for instance names, so we do not use the escaped email
  # address if it is longer than 32 characters.
  EMAIL_WITH_HYPHENS_ESCAPED=`echo "${USER_EMAIL}" | sed -e 's/-/-h-/g'`
  EMAIL_WITH_AT_ESCAPED=`echo "${EMAIL_WITH_HYPHENS_ESCAPED}" | sed -e 's/@/-at-/g'`
  EMAIL_WITH_DOT_ESCAPED=`echo "${EMAIL_WITH_AT_ESCAPED}" | sed -e 's/\./-dot-/g'`
  ESCAPED_USER_EMAIL=`echo "${EMAIL_WITH_DOT_ESCAPED}" | sed -e 's/[^-a-zA-Z0-9]//g'`
  if [[ -z "${ESCAPED_USER_EMAIL}" || "${#ESCAPED_USER_EMAIL}" > 32 ]]; then
    # Since the email address contains other characters, we sanitize it
    # by hashing it. We use the openssl implementation of sha1 for this purpose,
    # solely for the fact that it should be nearly ubiquitous.
    USER_HASH=`echo "${USER_EMAIL}" | openssl sha1 -r | cut -d ' ' -f 1`
    INSTANCE_PREFIX="datalab-${USER_HASH:0:12}"
  else
    INSTANCE_PREFIX="datalab-${ESCAPED_USER_EMAIL}"
  fi

  INSTANCE=`gcloud compute instances list --project "${PROJECT_ID}" --zone "${ZONE}" --regex "${INSTANCE_PREFIX}-[0-9]*" --limit 1 --format "value(name)"`
  if [[ -z "${INSTANCE}" ]]; then
    echo "Could not find an existing gateway VM for '${USER_EMAIL}'. Will create one..."
    INSTANCE="${INSTANCE_PREFIX}-${RANDOM}"
    /datalab/deploy.sh "${PROJECT_ID}" "${ZONE}" "${INSTANCE}" || exit ${ERR_DEPLOY}
  fi
fi

# Verify that the specified instance exists...
gcloud compute instances describe "${INSTANCE}" || exit "${ERR_INSTANCE_NOT_FOUND}"

echo "Will connect to the kernel gateway running on ${INSTANCE}"
gcloud compute ssh --quiet \
  --project "${PROJECT_ID}" \
  --zone "${ZONE}" \
  --ssh-flag="-NL" \
  --ssh-flag="localhost:8082:localhost:8080" \
  "${INSTANCE}" &

export DATALAB_ENV="local"
export EXPERIMENTAL_KERNEL_GATEWAY_URL="http://localhost:8082"
/datalab/run.sh
