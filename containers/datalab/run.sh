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

HERE=$(dirname $0)
CONTENT=$HOME
ENTRYPOINT="/datalab/run.sh"
DEVROOT_DOCKER_OPTION=''
LIVE_MODE=1

function setup_live_mode() {
    # Live mode makes the datalab container use a live copy of the
    # development directory so your changes are visible to the container
    # without rebuilding.
    echo "Setting up live mode"
    DEVROOT=$(cd "$HERE" && realpath ../..)
    DEVROOT_DOCKER_OPTION="-v $DEVROOT:/devroot"
    echo "Updating build-dev"
    rsync -a \
        --exclude web/nb/config \
        --exclude web/nb/static \
        --exclude web/nb/templates \
        "$DEVROOT/build/" "$DEVROOT/build-dev"
    if [ ! -h "$DEVROOT/build-dev/web/nb/node_modules" ]; then
      echo linking node_modules
      # This link only resolves correctly inside the datalab container.
      ln -s /datalab/web/node_modules "$DEVROOT/build-dev/web/nb/node_modules"
    fi
    # The files in the subdirs of build/web/nb are just copied from the
    # source dirs. In order to allow using updated versions of those files
    # without having to run the build script, we remove them from build-dev
    # and link them directly to the source dirs.
    # You need to restart the notebook server in the container to make it
    # pick up your changes.
    for dir in config static templates; do
      if [ ! -h "$DEVROOT/build-dev/web/nb/$dir" ]; then
        echo "linking $dir"
        # This link only resolves correctly inside the datalab container.
        ln -s "/devroot/sources/web/datalab/$dir" "$DEVROOT/build-dev/web/nb/$dir"
      fi
    done
    # The js files in web/nb are compiled typescript files from
    # sources/web/datalab. if you make changes to those, run
    # sources/web/build.sh to compile those files, which updates them in
    # the build dir and then copies them to the build-dev dir.
    # You need to restart the notebook server in the container to make it
    # pick up your changes.
}

while [ $# -gt 0 ]; do
  case "$1" in
    shell)
      ENTRYPOINT="/bin/bash"
      ;;
    --no-live)
      LIVE_MODE=0
      ;;
    -*) echo "Unrecognized option '$1'"
      exit 1
      ;;
    *)
      # For any other non-option argument, assume it is the content root.
      CONTENT="$1"
      ;;
  esac
  shift
done

if [[ $LIVE_MODE == 1 ]]; then
  setup_live_mode
fi

docker run -it --entrypoint=$ENTRYPOINT \
  -p 127.0.0.1:8081:8080 \
  -v "$CONTENT:/content" \
  ${DEVROOT_DOCKER_OPTION} \
  -e "PROJECT_ID=$PROJECT_ID" \
  -e "DATALAB_ENV=local" \
  -e "DATALAB_DEBUG=true" \
  -e 'DATALAB_SETTINGS_OVERRIDES={"consoleLogLevel": "debug" }' \
  datalab
