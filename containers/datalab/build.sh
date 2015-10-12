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

# Builds the Google Cloud DataLab docker image

# Create a versioned Dockerfile based on current date and git commit hash
VERSION=`date +%Y%m%d`
VERSION_SUBSTITUTION="s/_version_/0.5.$VERSION/"

COMMIT=`git log --pretty=format:'%H' -n 1`
COMMIT_SUBSTITUTION="s/_commit_/$COMMIT/"

cat Dockerfile.in | sed $VERSION_SUBSTITUTION | sed $COMMIT_SUBSTITUTION > Dockerfile

# Copy build outputs as a dependency of the Dockerfile
rsync -avp ../../build/ build

# Build the docker image
docker build -t datalab .

# Finally cleanup
rm -rf build
rm Dockerfile
