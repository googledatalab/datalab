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

function cleanup() {
  echo Stopping container..
  docker stop $container_datalab $selenium_container
  exit
}

# For travis, we do not care about interrupts and cleanup,
# it will just waste time
#if [ -z "$TRAVIS" ]; then
  #trap cleanup INT EXIT SIGHUP SIGINT SIGTERM
#fi

mkdir -p $HOME/datalab_content
container_datalab=$(docker ps -qf "ancestor=datalab")
if [ -z $container_datalab ]; then
  echo Starting Datalab container..
  container_datalab=$(docker run -d \
    --entrypoint="/datalab/run.sh" \
    -p 127.0.0.1:8081:8080 \
    -v $HOME/datalab_content:/content \
    -e "ENABLE_USAGE_REPORTING=false" \
    datalab)
fi

selenium_container=$(docker ps -qf "ancestor=selenium/standalone-chrome")
if [ -z $selenium_container ]; then
  echo Starting selenium container..
  selenium_container=$(docker run -d -p 4444:4444 --net="host" selenium/standalone-chrome)
fi

echo -n Polling on Datalab..
until $(curl --output /dev/null --silent --head --fail http://localhost:8081); do
  printf '.'
  sleep 1
done
echo ' Done.'
echo -n Polling on Selenium..
until $(curl --output /dev/null --silent --head --fail http://localhost:4444/wd/hub); do
  printf '.'
  sleep 1
done
echo ' Done.'
