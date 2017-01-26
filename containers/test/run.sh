# Copyright 2017 Google Inc. All rights reserved.
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

CONTENT=$HOME
ENTRYPOINT=""
if [ "$1" != "" ]; then
  if [ "$1" != "shell" ]; then
    CONTENT=$1
    shift
  fi
  if [ "$1" == "shell" ]; then
    ENTRYPOINT="/bin/bash"
  fi
fi

# disable EULA for the sake of tests
mkdir -p $CONTENT/datalab/.config/eula

# Use this flag to map in web server content during development
#  -v $REPO_DIR/sources/web:/sources \
docker run -it --entrypoint=$ENTRYPOINT \
  -v "$CONTENT:/content" \
  -p 127.0.0.1:8081:8080 \
  -p 8910:8910 \
  -e "DATALAB_ENV=local" \
  -e "ENABLE_USAGE_REPORTING=false" \
  datalab-test

