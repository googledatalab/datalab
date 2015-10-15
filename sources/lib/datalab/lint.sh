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

# Lints the Google Cloud Platform API python library.

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

#LINTER="pylint"

# Ignore 4 character indents (E111 and E114), and unused imports (F401).
# The latter is for our __init__ files.
LINTER="flake8 --ignore=E111,E114,F401 --max-line-length=100"

# We cannot import both lib/api and lib/datalab packages from the source
# directories as there must be a gcp package in each case and they cannot
# be distinct. I.e. if we have gcp package in lib/api, then Python will
# expect to find gcp.datalab under it. So we create a symlink for the
# duration of the test run then remove it. We add a Ctrl-C handler too
# to make sure we clean up if interrupted, although that is likely overkill.

trap ctrl_c INT

function ctrl_c() {
  rm ../api/gcp/datalab
  exit -1
}

ln -s $REPO_DIR/sources/lib/datalab/gcp/datalab ../api/gcp/datalab
pushd $REPO_DIR/sources/lib/api
$LINTER gcp/datalab
popd

rm ../api/gcp/datalab

