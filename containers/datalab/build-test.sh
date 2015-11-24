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

# Builds the Google Cloud DataLab docker image with vcrpy and urllib
# added.
#

# Create a versioned Dockerfile based on current date and git commit hash
VERSION=`date +%Y%m%d`
VERSION_SUBSTITUTION="s/_version_/0.5.$VERSION/"

COMMIT=`git log --pretty=format:'%H' -n 1`
COMMIT_SUBSTITUTION="s/_commit_/$COMMIT/"

cat Dockerfile.in | sed $VERSION_SUBSTITUTION | sed $COMMIT_SUBSTITUTION > Dockerfile
echo "RUN pip install -U requests==2.8.1" >> Dockerfile
echo "RUN pip install -U vcrpy==1.7.4" >> Dockerfile

# Temp fix until vcrpy gets this: https://github.com/kevin1024/vcrpy/pull/223/files
echo "RUN mv /usr/local/lib/python2.7/dist-packages/vcr/stubs/requests_stubs.py /tmp/stubs.py" >> Dockerfile
echo "RUN sed 's/requests.packages.urllib3/urllib3/' < /tmp/stubs.py > /usr/local/lib/python2.7/dist-packages/vcr/stubs/requests_stubs.py" >> Dockerfile

# Copy build outputs as a dependency of the Dockerfile
rsync -avp ../../build/ build

# Add test-driver script
cp ../../tools/test.js build/web/static/extensions/

# Build the docker image
docker build -t datalab-test .

# Finally cleanup
rm -rf build
rm Dockerfile

