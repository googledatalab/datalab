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

mkdir -p $WEB_DIR

# Compile the nodejs server
tsc --module commonjs --noImplicitAny \
    --outDir $WEB_DIR \
    ./datalab/*.ts

cd datalab/polymer
polymer build
cd ../..

rsync -avp ./datalab/config/ $WEB_DIR/config
rsync -avp ./datalab/polymer/build/raw/ datalab/static
rsync -avp ./datalab/static/ $WEB_DIR/static
rsync -avp ./datalab/templates/ $WEB_DIR/templates
rsync -avp ./datalab/package.json $WEB_DIR/package.json
