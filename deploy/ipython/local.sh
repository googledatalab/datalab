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

# Starts an IPython container locally

# Instructions related to port-forwarding from the Virtual Box VM to the Local OS
echo "-------------------------------------------------------------"
echo "If you're running via boot2docker, run the following as well:"
echo "boot2docker ssh -L 8080:localhost:8080"
echo "-------------------------------------------------------------"
echo ""
echo ""

# Fault-tolerant cleanup
function cleanup {
  rm Dockerfile
  rm -rf gcloud
}
trap cleanup EXIT

IMAGE_NAME="gcp-ipython-local"
if [ "$1" = "" ]; then
  DOCKER_IMAGE=$IMAGE_NAME
else
  DOCKER_IMAGE="$1/$IMAGE_NAME"
fi

# Generate supporting files

cat > Dockerfile << EOF1
FROM $DOCKER_IMAGE

EOF1

# Copy a snapshot of gcloud configuration.
# -L in case user is using linked gcloud
rsync -avp ~/.config/gcloud/ gcloud

# Build and run the local docker image
docker build -t gcp-ipython-local-instance .
docker run -p 127.0.0.1:8080:8080 -i -t gcp-ipython-local-instance
