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

while [ $# -gt 0 ]; do
  case "$1" in
    -d | --debug)
      DEBUG=1
      shift
      ;;
    -*) echo "Unrecognized option '$1'"
      exit 1
      ;;
  esac
done

cd $(dirname $0)

if [ -z "$REPO_DIR" ]; then
  source ../../tools/initenv.sh
fi

BUILD_DIR="$REPO_DIR/build"
WEB_DIR=$BUILD_DIR/web/nb

mkdir -p $WEB_DIR

# Experimental UI build step
cd datalab/polymer
npm run build
if [[ $DEBUG == 1 ]]; then
  rsync -avpq ./build/polymer_unbundled/ ../static/experimental
else
echo "Using bundled polymer resources.."
  rsync -avpq ./build/polymer_bundled/ ../static/experimental
fi
cd ../..
# End experimental UI build step

# Compile the nodejs server
cd datalab
npm install
npm run transpile -- --outDir $WEB_DIR 
cd ..

rsync -avpq ./datalab/config/ $WEB_DIR/config
rsync -avpq ./datalab/static/ $WEB_DIR/static
rsync -avpq ./datalab/templates/ $WEB_DIR/templates
rsync -avpq ./datalab/package.json $WEB_DIR/package.json
