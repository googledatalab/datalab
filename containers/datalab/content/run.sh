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

mkdir -p /content/datalab/notebooks
mkdir -p /content/datalab/docs

if [ -d /content/datalab/docs/notebooks/.git ]
then
  (cd /content/datalab/docs/notebooks; git fetch origin master; git reset --hard origin/master)
else
  (cd /content/datalab/docs; git clone -b master --single-branch https://github.com/googledatalab/notebooks.git)
fi

# Setup environment variables.
. /datalab/setup-env.sh

# Run the user's custom extension script if it exists. To avoid platform issues with 
# execution permissions, line endings, etc, we create a local sanitized copy.
if [ -f /content/datalab/.config/startup.sh ]
then
  tr -d '\r' < /content/datalab/.config/startup.sh > ~/startup.sh
  chmod +x ~/startup.sh
  . ~/startup.sh
fi

# Start the DataLab server
forever /datalab/web/app.js
