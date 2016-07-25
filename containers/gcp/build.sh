#!/bin/bash
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

# Builds the docker image for running Datalab on the Google Cloud Platform.

USAGE="USAGE: ${0} [-p] [-h]

Where '-p' indicates that the 'datalab-gateway' Docker image should be
built locally and pushed to the Google Container Registry for the
project defined in the environment variable 'PROJECT_ID' (or, if that
variable is not provided, the default project set in the gcloud config).
"

FORCE_PUSH=""
while getopts ":ph" OPT; do
  case $OPT in
    p)
      FORCE_PUSH="true"
      ;;
    h)
      echo "${USAGE}"
      exit 0
      ;;
    \?)
      echo "Unknown args: -${OPTARG}"
      echo "${USAGE}"
      exit 1
      ;;
  esac
done

if [ "${FORCE_PUSH}" == "true" ]; then
  PROJECT_ID=${PROJECT_ID:-`gcloud config list 2> /dev/null | grep 'project = ' | cut -d ' ' -f 3`}
  if [ -z "${PROJECT_ID}" ]; then
    echo "You must specify a target project to which to push the gateway image"
    exit 1
  fi

  GATEWAY_IMAGE="gcr.io/${PROJECT_ID}/datalab-gateway"
  echo "Forcing a build and push of the image ${GATEWAY_IMAGE}"
  cd ../gateway
  ./build.sh
  cd ../gcp

  docker tag -f datalab-gateway "${GATEWAY_IMAGE}"
  gcloud --project="${PROJECT_ID}" docker push "${GATEWAY_IMAGE}"
fi

# Build the base docker image
cd ../datalab
./build.sh
cd ../gcp

# Build the docker image
docker build -t datalab-gcp .
