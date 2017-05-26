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

RUN_INTEGRATION_TESTS=1
CONTAINER_STARTED=0

HERE=$(dirname $0)
MOCHA=$HERE/node_modules/mocha/bin/mocha

function parseOptions() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -u|--unit-tests-only)
        RUN_INTEGRATION_TESTS=0
        shift
        ;;
      -*)
        echo "Uknown option '$1'"
        exit 1
        ;;
      *)
        echo "Uknown argument '$1'"
        exit 1
        ;;
    esac
  done
}

function cleanup() {
  if [[ $CONTAINER_STARTED -ne 0 ]]; then
    echo Stopping container..
    docker stop $container_datalab $selenium_container
  fi
  exit
}

function makeTestsHome() {
  TESTS_HOME=$HOME/datalab_tests
  mkdir -p $TESTS_HOME
}

function startContainers() {
  CONTAINER_STARTED=1
  echo Starting Datalab container..
  container_datalab=$(docker run -d \
    --entrypoint="/datalab/run.sh" \
    -p 127.0.0.1:8081:8080 \
    -v $TESTS_HOME:/content \
    -e "ENABLE_USAGE_REPORTING=false" \
    datalab)

  echo Starting selenium container..
  selenium_container=$(docker run -d -p 4444:4444 --net="host" selenium/standalone-chrome)

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
}

function runIntegrationTests() {
  echo Running mocha notebook tests
  $MOCHA $HERE/notebook/test.js
  echo Running mocha ui tests
  $MOCHA $HERE/ui/test.js
}

function runUnitTests() {
  echo Running jasmine tests
  $HERE/node_modules/jasmine/bin/jasmine.js \
      --config=$HERE/unittests/support/jasmine.json
}

function main() {
  parseOptions "$@"

  # For travis, we do not care about interrupts and cleanup,
  # it will just waste time
  if [ -z "$TRAVIS" ]; then
    trap cleanup INT EXIT SIGHUP SIGINT SIGTERM
  fi

  # Unit tests are fast, run them all first
  runUnitTests

  if [[ $RUN_INTEGRATION_TESTS -ne 0 ]]; then
    makeTestsHome
    startContainers
    runIntegrationTests
  fi
}

main "$@"
