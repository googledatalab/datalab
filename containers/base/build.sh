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

# Builds the Google Cloud DataLab base docker image. Usage:
#   build.sh [path_of_pydatalab_dir]
# If [path_of_pydatalab_dir] is provided, it will copy the content of that dir into image.
# Otherwise, it will get the pydatalab by "git clone" from pydatalab repo.

# Get VM information if running on google cloud
machine_metadata_url="http://metadata.google.internal/computeMetadata/v1/instance"
export VM_NAME=$(curl -s "${machine_metadata_url}/hostname" -H "Metadata-Flavor: Google" | cut -d '.' -f 1)
export VM_ZONE=$(curl -s "${machine_metadata_url}/zone" -H "Metadata-Flavor: Google" | sed 's/.*zones\///')

# Build the docker image
if [ -n "$1" ]; then
  src_pydatalab="$1"

  # Append trailing / if needed.
  if [ "${src_pydatalab: -1}" != "/" ]; then
  	src_pydatalab=$src_pydatalab"/"
  fi

  rsync -avp "$src_pydatalab" pydatalab;
else
  # Create empty dir to make docker build happy.
  mkdir -p pydatalab;
fi
docker build -t datalab-base .
rm -rf pydatalab
