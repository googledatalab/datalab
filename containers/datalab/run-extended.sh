#!/bin/bash -e
# Copyright 2015 Google Inc. All rights reserved.
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

# Runs the docker container locally. Auth will happen in the browser when
# the user first opens Datalab after accepting the EULA.

# Passing in 'shell' flag causes the docker container to break into a
# command prompt, which is useful for tinkering within the container before
# manually starting the server.

CONTENT=$HOME
DOCKERIMAGE=datalab
ENTRYPOINT="/datalab/run.sh"
if [ "$1" != "" ]; then
  if [ "$1" != "shell" ]; then
    CONTENT=$1
    shift
  fi
  if [ "$1" == "shell" ]; then
    ENTRYPOINT="/bin/bash"
  fi
fi

# Custom packages can be installed in datalab prior to run time. There are 2 options
# available. A simple option is to add the packages to a pip requirements file. Create a file
# called 'custom-packages.txt' and place it in the $REPO_DIR/containers/datalab folder. Use
# 'custom-packages-example.txt' as a starting point. Another option is to create a Dockerfile
# called 'Dockerfile-extended.in' and place it in the $REPO_DIR/containers/datalab folder.
# Use 'Dockerfile-extended-example.in' as a starting point. In both cases, a customized
# docker image will be created which is derived from the standard datalab image.
if [ -f custom-packages.txt ] || [ -f Dockerfile-extended.in ];
then
    if [ -f custom-packages.txt ];
    then
        # First create a new Docker file called Dockerfile-custom-packages. Start with the standard image
        # TODO: at some point the local Datalab container will be tagged 'latest' rather than 'local'
        # and the line below should change.
        echo 'FROM gcr.io/cloud-datalab/datalab:local' > Dockerfile-custom-packages

        # Add the script with a list of custom packages to the Dockerfile
        echo 'ADD custom-packages.txt /datalab/custom-packages.txt' >> Dockerfile-custom-packages
        echo 'RUN pip install -r /datalab/custom-packages.txt' >> Dockerfile-custom-packages

        DOCKERFILE=Dockerfile-custom-packages
        DOCKERIMAGE=datalab-custom-packages

    elif [ -f Dockerfile-extended.in ];
    then
        DOCKERFILE=Dockerfile-extended.in
        DOCKERIMAGE=datalab-extended
    fi

    # Build the customized docker image derived from the standard datalab image
    docker build ${DOCKER_BUILD_ARGS} -t $DOCKERIMAGE -f $DOCKERFILE .
fi

# On linux docker runs directly on host machine, so bind to 127.0.0.1 only
# to avoid it being accessible from network.
# On other platform, it needs to bind to all ip addresses so VirtualBox can
# access it. Users need to make sure in their VirtualBox port forwarding
# settings only 127.0.0.1 is bound.
if [ "$OSTYPE" == "linux"* ]; then
  PORTMAP="127.0.0.1:8081:8080"
else
  PORTMAP="8081:8080"
fi

# Use this flag to map in web server content during development
#  -v $REPO_DIR/sources/web:/sources \
docker run -it --entrypoint=$ENTRYPOINT \
  -p $PORTMAP \
  -v "$CONTENT/datalab:/content/datalab" \
  -e "PROJECT_ID=$PROJECT_ID" \
  -e "DATALAB_ENV=local" \
  -e "EXPERIMENTAL_KERNEL_GATEWAY_URL=${EXPERIMENTAL_KERNEL_GATEWAY_URL}" \
  $DOCKERIMAGE
