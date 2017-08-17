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

RUN_NOTEBOOK=0
RUN_UI=0
RUN_CLIENT_UNIT=0
RUN_SERVER_UNIT=0

CONTAINER_STARTED=0

HERE=$(dirname $0)
JASMINE=$HERE/node_modules/jasmine/bin/jasmine.js

function parseOptions() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --client-unit-tests)
        RUN_CLIENT_UNIT=1
        shift
        ;;
      --notebook-tests)
        RUN_NOTEBOOK=1
        shift
        ;;
      --server-unit-tests)
        RUN_SERVER_UNIT=1
        shift
        ;;
      -u|--unit-tests)
        RUN_CLIENT_UNIT=1
        RUN_SERVER_UNIT=1
        shift
        ;;
      --ui-tests)
        RUN_UI=1
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

  if (( RUN_CLIENT_UNIT + RUN_SERVER_UNIT + RUN_NOTEBOOK + RUN_UI == 0 )); then
    # If no parts were specified, run all parts
    echo Run all test sections
    RUN_CLIENT_UNIT=1
    RUN_SERVER_UNIT=1
    RUN_NOTEBOOK=1
    RUN_UI=1
  fi
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

# Delete the files using the same container context as they were created.
function cleanTestsHome() {
  echo "Deleting old content from ${TESTS_HOME}.."
  docker run \
    --entrypoint="/bin/bash" \
    -p 127.0.0.1:8081:8080 \
    -v $TESTS_HOME:/content \
    datalab \
    -c "rm -rf /content/* && sleep 1"
}

function startContainers() {
  CONTAINER_STARTED=1
  echo Starting Datalab container..
  container_datalab=$(docker run -d \
    --entrypoint="/datalab/run.sh" \
    -p 127.0.0.1:8081:8080 \
    -v $TESTS_HOME:/content \
    -e "ENABLE_USAGE_REPORTING=false" \
    -e "DATALAB_SHUTDOWN_COMMAND=echo" \
    datalab)

  docker pull selenium/standalone-chrome > /dev/null
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

function installNodeModulesInBuild() {
  echo "Running 'npm install' in build dir"
  (cd ${HERE}/../build/web/nb && npm install)
}

function runNotebookTests() {
  echo Running notebook integration tests
  $JASMINE --config=$HERE/notebook/jasmine.json
}

function runUiTests() {
  echo Running ui integration tests
  $JASMINE --config=$HERE/ui/jasmine.json
}

function runClientUnitTests() {
  echo Running client unit tests
  $JASMINE --config=$HERE/client-unit/jasmine.json
}

function runServerUnitTests() {
  echo Running server unit tests
  $JASMINE --config=$HERE/server-unit/jasmine.json
}

function main() {
  parseOptions "$@"

  # For travis, we do not care about interrupts and cleanup,
  # it will just waste time
  if [ -z "$TRAVIS" ]; then
    trap cleanup INT EXIT SIGHUP SIGINT SIGTERM
  fi

  # Unit tests are fast, run them first
  if (( RUN_CLIENT_UNIT > 0 )); then
    runClientUnitTests
  fi
  if (( RUN_SERVER_UNIT > 0 )); then
    installNodeModulesInBuild
    runServerUnitTests
  fi

  if (( RUN_NOTEBOOK + RUN_UI > 0 )); then
    makeTestsHome
    cleanTestsHome
    startContainers
    if (( RUN_NOTEBOOK > 0 )); then
      runNotebookTests
    fi
    if (( RUN_UI > 0 )); then
      runUiTests
    fi
  fi
}

main "$@"
