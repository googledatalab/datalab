#!/bin/bash -e

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

/datalab/run.sh &> /tmp/datalab_log.txt &
Xvfb :10 -ac &

echo -n "Polling on Datalab."
until $(curl --output /dev/null --silent --head --fail http://localhost:8080); do
  printf "."
  sleep 1
done
echo " Done."

echo -n "VM Info: "
curl http://localhost:8080/_info/vminfo
curl http://localhost:8080/_filesearch

echo -e "\nRunning UI tests.."
mocha ui_tests.js
