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

# Sets up various environment variables within the docker container.

export DATALAB_USER=`gcloud -q config list --format yaml | grep account | awk -F" " '{print $2}'`
export DATALAB_PROJECT_ID=`gcloud -q config list --format yaml | grep project | awk -F" " '{print $2}'`
if [ -z $DATALAB_PROJECT_NUM ]; then
  export DATALAB_PROJECT_NUM=`curl --silent -H "Metadata-Flavor=Google" http://metadata.google.internal/computeMetadata/v1beta1/project/numeric-project-id`
fi
if [ -z $DATALAB_INSTANCE_NAME ]; then
  export DATALAB_INSTANCE_NAME=$GAE_MODULE_VERSION
fi

