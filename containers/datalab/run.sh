#!/bin/bash -e
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

# Runs the docker container locally. Auth will happen in the browser when
# the user first opens Datalab after accepting the EULA.

# Passing in 'shell' flag causes the docker container to break into a
# command prompt, which is useful for tinkering within the container before
# manually starting the server.

# Use the --pydatalab option to run the container with the specified pydatalab
# dir mounted on /content/pydatalab in the container in order to speed up the
# development cycle in cases where you need to test your pydatalab code in
# datalab. Then, when you run that container in live mode (the default in
# development), it will uninstall the standard pydatalab and install the live
# one. After making changes to your pydatalab code, compile it, then restart
# the container to pick up the changes.

HERE=$(dirname $0)
CONTENT=$HOME
ENTRYPOINT="/datalab/run.sh"
DEVROOT_DOCKER_OPTION=''
LIVE_MODE=1
PYDATALAB=''
MORE_ENV=''
CONSOLE_LOG_LEVEL='debug'

function realpath() {
  perl -MCwd -e 'print Cwd::realpath($ARGV[0]),qq<\n>' $1
}

function setup_live_mode() {
    # Live mode makes the datalab container use a live copy of the
    # development directory so your changes are visible to the container
    # without rebuilding.
    echo "Setting up live mode"
    DEVROOT=$(cd "$HERE" && realpath ../..)
    DEVROOT_DOCKER_OPTION="-v $DEVROOT:/devroot"
}

while [ $# -gt 0 ]; do
  case "$1" in
    shell)
      ENTRYPOINT="/bin/bash"
      shift
      ;;
    -e)
      MORE_ENV="${MORE_ENV}-e $2 "
      shift
      shift
      ;;
    --log-level)
      # Log levels: trace(10), debug(20), info(30), warn(40), error(50), fatal(60)
      # See https://github.com/trentm/node-bunyan#levels
      CONSOLE_LOG_LEVEL="$2"
      shift
      shift
      ;;
    --no-live)
      LIVE_MODE=0
      shift
      ;;
    --pydatalab)
      if [ $# -lt 2 ]; then
        echo "--pydatalab requires an argument"
        exit 1
      fi
      PYDATALAB=$(realpath "$2")
      PYDATALAB_MOUNT_OPT="-v $PYDATALAB:/content/pydatalab"
      shift
      shift
      ;;
    -*) echo "Unrecognized option '$1'"
      exit 1
      ;;
    *)
      # For any other non-option argument, assume it is the content root.
      CONTENT="$1"
      shift
      ;;
  esac
done

if [[ $LIVE_MODE == 1 ]]; then
  setup_live_mode
fi

docker run -it --entrypoint=$ENTRYPOINT \
  -p 127.0.0.1:8080:8080 \
  -v "$CONTENT/datalab:/content/datalab" \
  $PYDATALAB_MOUNT_OPT \
  ${DEVROOT_DOCKER_OPTION} \
  -e "PROJECT_ID=$PROJECT_ID" \
  -e "DATALAB_ENV=local" \
  -e "DATALAB_DEBUG=true" \
  -e "DATALAB_SETTINGS_OVERRIDES={\"consoleLogLevel\": \"${CONSOLE_LOG_LEVEL}\" }" \
  ${MORE_ENV} \
  datalab
