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

# We use the presence of /root/.config to tell whether to show landing page.
# Running gcloud will create it in whatever volume we mapped in which may
# not be the user's home, so we guard against calling gcloud below unless
# it already exists.
if [ -d /root/.config/gcloud ]
then
  PROJECT_ID=`gcloud -q config list --format yaml | grep project | awk -F" " '{print $2}'`
  export DATALAB_PROJECT_NUM=`gcloud -q projects describe $PROJECT_ID | grep projectNumber | awk '{print substr($2,2,length($2)-2)}'`
fi

export DATALAB_ENV=debug
export DATALAB_INSTANCE_NAME=debug
export METADATA_HOST=localhost

mkdir -p /content/datalab/notebooks
mkdir -p /content/datalab/docs
rsync -r /datalab/docs/* /content/datalab/docs

# Setup environment variables.
. /datalab/setup-env.sh

# Simulate the metadata service
forever start /datalab/metadata/server.js &

# Start the DataLab server
forever /datalab/web/app.js
