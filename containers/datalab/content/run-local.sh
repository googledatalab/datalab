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

# This script serves as the entrypoint for locally running the DataLab
# docker container, i.e. outside a VM on the cloud.

export DATALAB_ENV=local
export METADATA_HOST=localhost

# Simulate the metadata service
node /datalab/metadata/server.js &

# Start the DataLab server
node /datalab/web/app.js

