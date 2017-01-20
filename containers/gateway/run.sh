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

# Use this flag to map in web server content during development
#  -v $REPO_DIR/sources/web:/sources \
docker run -it --entrypoint=$ENTRYPOINT \
  -p 127.0.0.1:8082:8080 \
  -v "$CONTENT:/content" \
  -e "DATALAB_ENV=local" \
  datalab-gateway
