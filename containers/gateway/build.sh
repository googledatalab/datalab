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

# Builds the Google Cloud DataLab gateway docker image. Usage:
#   build.sh [path_of_pydatalab_dir]
# If [path_of_pydatalab_dir] is provided, it will copy the content of that dir into image.
# Otherwise, it will get the pydatalab by "git clone" from pydatalab repo.

pushd $(pwd) >> /dev/null
HERE=$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)

if [ -z "$1" ]; then
  pydatalabPath=''
else
  pydatalabPath=$(realpath "$1")
fi

# Build the base docker image
cd "${HERE}/../base"
./build.sh "$pydatalabPath"
cd "${HERE}/"

${HERE}/prepare.sh

# Build the docker image
docker build ${DOCKER_BUILD_ARGS} -t datalab-gateway .

# Finally cleanup
${HERE}/cleanup.sh

popd >> /dev/null
