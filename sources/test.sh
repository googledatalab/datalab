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

# Tests all components.

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run `source tools/initenv.sh` first";
  exit 1;
fi

TEST_PATHS=(
  "lib/api"
  "lib/datalab"
)

for p in "${TEST_PATHS[@]}"
do
  echo "Testing $p ... "

  TEST_DIR=$REPO_DIR/sources/$p
  pushd $TEST_DIR >> /dev/null

  ./test.sh

  popd >> /dev/null
  echo
done
