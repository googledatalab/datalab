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

# Copy a snapshot of gcloud configuration
cp -r ~/.config/gcloud gcloud

# Build and run the local docker image
docker build -t gcp-ipython-local-instance .
docker run -p 127.0.0.1:8080:8080 -i -t gcp-ipython-local-instance

# NOTE: When using boot2docker, the port is only exposed to the VM, and
#       not to the host OS. Run the following in addition:
# boot2docker ssh -L 8080:localhost:8080

# Cleanup
rm Dockerfile
rm -rf gcloud

