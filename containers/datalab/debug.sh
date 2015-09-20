#!/bin/sh
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

# Runs the docker container locally.
# Passing in 'shell' flag causes the docker container to break into a
# command prompt, which is useful for tinkering within the container before
# manually starting the server.

# In local mode the container picks up local notebooks, so it can be used
# to work on files saved on the file system.

ENTRYPOINT="/datalab/run-debug.sh"
if [ "$1" == "shell" ]; then
  ENTRYPOINT="/bin/bash"
fi

# Home directories are mapped from host to boot2docker vm automatically,
# so use them for both logs and notebooks.
mkdir -p $HOME/datalab/log/custom_logs

# Delete any existing logs to start fresh on each run.
rm -f $HOME/datalab/log/custom_logs/*.log

# Create a temporary content directory that will be mapped into the container
mkdir -p /tmp/datalab

# For local runs we can get project number only from outside container.
# So get it and then pass to container as DATALAB_PROJECT_NUM env var.
PROJECT_ID=`gcloud -q config list --format yaml | grep project | awk -F" " '{print $2}'`
PROJECT_NUM=`gcloud -q alpha projects describe $PROJECT_ID | grep projectNumber | awk '{print substr($2,2,length($2)-2)}'`

docker run -i --entrypoint=$ENTRYPOINT \
  -p 8081:8080 \
  -v $HOME/datalab/log:/var/log/app_engine \
  -v $HOME/.config/gcloud:/root/.config/gcloud \
  -v /tmp/datalab:/content \
  -e "DATALAB_PROJECT_NUM=$PROJECT_NUM" \
  -t datalab
