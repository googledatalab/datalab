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

cd $(dirname $0)

if [ -z "$REPO_DIR" ]; then
  source ../../tools/initenv.sh
fi

BUILD_DIR="$REPO_DIR/build"
WEB_DIR=$BUILD_DIR/web/nb
BUILD_DEV_DIR="$REPO_DIR/build-dev"
BUILD_DEV_WEB_DIR="$BUILD_DEV_DIR/web/nb"

mkdir -p $WEB_DIR

# Compile the nodejs server
tsc --module commonjs --noImplicitAny \
    --outDir $WEB_DIR \
    ./datalab/*.ts

echo "Updating config"
rsync -avp ./datalab/config/ $WEB_DIR/config

echo "Updating static"
rsync -avp ./datalab/static/ $WEB_DIR/static

echo "Updating templates"
rsync -avp ./datalab/templates/ $WEB_DIR/templates

echo "Updating package.json"
rsync -avp ./datalab/package.json $WEB_DIR/package.json

# If the user has run the run.sh script with --devroot,
# keep that dir updated as well.
if [ -d "$BUILD_DEV_DIR" ]; then
  echo "Updating js files in $BUILD_DEV_WEB_DIR"
  # tsc changes the timestamps on all the js files, so we might as
  # well just copy them rather than using rsync
  cp -p  $WEB_DIR/*.js $BUILD_DEV_WEB_DIR
fi
