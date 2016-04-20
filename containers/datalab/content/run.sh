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

export DATALAB_INSTANCE_NAME=local

mkdir -p /content/datalab/notebooks
mkdir -p /content/datalab/docs
rsync -r /datalab/docs/* /content/datalab/docs

# Setup environment variables.
. /datalab/setup-env.sh

# Start the DataLab server
forever /datalab/web/app.js
