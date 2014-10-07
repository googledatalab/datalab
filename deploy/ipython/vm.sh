#!/bin/sh
# Copyright 2014 Google Inc. All rights reserved.
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

# Starts an IPython managed VM

if [ "$#" -lt 2 ]; then
  echo "Usage: vm.sh <command> <cloud project> [<docker registry>]"
  echo "                       [<module>] [<version>]"
  echo
  echo "  command        : deploy | run"
  echo "  cloud project  : the cloud project to deploy to."
  echo "  docker registry: the registry containing the docker image to deploy."
  echo "  module         : the managed VM module to deploy to."
  echo "  version        : the managed VM module version to deploy to."
  echo

  exit
fi


# Variables

CLOUD_PROJECT=$2
APP_MODULE=$4
APP_VERSION=$5

if [ "$3" = "" ]; then
  DOCKER_IMAGE="gcp-ipython"
else
  DOCKER_IMAGE="$3/gcp-ipython"
fi

if [ "$APP_MODULE" = "" ]; then
  APP_MODULE=ipython
fi
if [ "$APP_VERSION" = "" ]; then
  APP_VERSION=preview1
fi

echo "Project: $CLOUD_PROJECT"
echo "Module : $APP_MODULE"
echo "Version: $APP_VERSION"
echo "Image  : $DOCKER_IMAGE"


# Generate supporting files

cat > Dockerfile << EOF1
FROM gcp-ipython

EOF1

cat > app.yaml << EOF2
api_version: 1
module: $APP_MODULE
version: $APP_VERSION

vm: true
manual_scaling:
  instances: 1

runtime: custom
threadsafe: true

handlers:
- url: /.*
  script: app.js
  login: admin
  secure: always

EOF2

cat > app.js << EOF3
// Stub script referenced by app.yaml
//

EOF3


# First pull the IPython docker image
docker pull $DOCKER_IMAGE

# Build the local docker image
docker build -t gcp-ipython-instance .

# Deploy to the cloud (as a managed VM application)
if [ "$1" = "deploy" ]; then
  gcloud preview app deploy . --force \
    --project $CLOUD_PROJECT \
    --server preview.appengine.google.com \
    --docker-host tcp://192.168.59.103:2375
else
  gcloud preview app run . \
    --project $CLOUD_PROJECT \
    --docker-host tcp://192.168.59.103:2375
fi

# Cleanup
rm Dockerfile
rm app.js
rm app.yaml
