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

# Builds all components.

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run `source tools/initenv.sh` first";
  exit 1;
fi

SRC_PATHS=(
  "lib/api"
  "lib/datalab"
  "tools"
  "web"
)

BUILD_DIR=$REPO_DIR/build
LOG_FILE=$BUILD_DIR/build.log

rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

for SRC in "${SRC_PATHS[@]}"
do
  echo "Building $SRC ... " | tee -a $LOG_FILE

  SRC_DIR=$REPO_DIR/sources/$SRC
  pushd $SRC_DIR >> /dev/null

  ./build.sh >> $LOG_FILE 2>&1

  if [ "$?" -ne "0" ]; then
    echo "failed" | tee -a $LOG_FILE
    echo "Build aborted." | tee -a $LOG_FILE
    exit 1
  else
    echo "succeeded" | tee -a $LOG_FILE
  fi

  popd >> /dev/null
  echo | tee -a $LOG_FILE
done

echo "Build completed." | tee -a $LOG_FILE
