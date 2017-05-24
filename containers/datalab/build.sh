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

# Builds the Google Cloud DataLab docker image. Usage:
#   build.sh [path_of_pydatalab_dir]
# If [path_of_pydatalab_dir] is provided, it will copy the content of that dir into image.
# Otherwise, it will get the pydatalab by "git clone" from pydatalab repo.

# Create a versioned Dockerfile based on current date and git commit hash
source ../../tools/release/version.sh

VERSION_SUBSTITUTION="s/_version_/$DATALAB_VERSION/"
COMMIT_SUBSTITUTION="s/_commit_/$DATALAB_COMMIT/"

if [ -z "$1" ]; then
  pydatalabPath=''
else
  pydatalabPath=$(realpath "$1")
fi

cd $(dirname $0)

cat Dockerfile.in | sed $VERSION_SUBSTITUTION | sed $COMMIT_SUBSTITUTION > Dockerfile

# Set up our required environment
source ../../tools/initenv.sh

# Build the datalab frontend
../../sources/web/build.sh

# Copy build outputs as a dependency of the Dockerfile
rsync -avp ../../build/ build

# Copy the license file into the container
cp ../../third_party/license.txt content/license.txt

# Build the base docker image
../base/build.sh "$pydatalabPath"

# Build the docker image
docker build ${DOCKER_BUILD_ARGS} -t datalab .

# Finally cleanup
rm -rf build
rm content/license.txt
rm Dockerfile
