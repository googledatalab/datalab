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

export DATALAB_ENV=debug
export DATALAB_INSTANCE_NAME=debug
export METADATA_HOST=localhost

# Setup environment variables.
. /datalab/setup-env.sh

# Setup cloud repository.
. /datalab/setup-repo.sh
if [ $? != "0" ]; then
  exit 1
fi

# Simulate the metadata service
forever start /datalab/metadata/server.js &

# Start the DataLab server
forever /datalab/web/app.js
