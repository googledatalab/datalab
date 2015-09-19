#!/bin/bash
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

# Builds the DataLab web server.

# Fail the build on the first error, instead of carrying on by default
set -o errexit;

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

BUILD_DIR="$REPO_DIR/build"
WEB_DIR=$BUILD_DIR/web

mkdir -p $WEB_DIR

# Compile the nodejs server
tsc --module commonjs --noImplicitAny \
    --outDir $WEB_DIR \
    ./datalab/*.ts

rsync -avp ./datalab/config/ $WEB_DIR/config
rsync -avp ./datalab/static/ $WEB_DIR/static
rsync -avp ./datalab/templates/ $WEB_DIR/templates
rsync -avp ./datalab/package.json $WEB_DIR/package.json
