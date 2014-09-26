#!/bin/sh
# Copyright 2014 Google Inc. All rights reserved.
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

# Various commands to run for building and deploying

if [ "$#" -ne 1 ]; then
  echo "Usage: run.sh <command>"
  echo "Commands -"
  echo "  stage  stages files from the build directory to be referenced by Dockerfile."
  echo "  clean  removes previously staged files."
  echo "  build  builds the docker image."
  echo "  start  starts a docker instance from a built docker image."
  echo "  shell  starts a docker instance from a built docker image to launch a shell prompt."
  echo "  cloud  deploys to a managed VM in the cloud."
  echo "  local  deploys to a managed VM in the local dev server."
  echo
  exit
fi

if [ "$1" = "stage" ]; then
  cp ../../build/ipython.tar.gz ipython.tar.gz
  cp ../../build/python/PyGCP-0.1.0.tar.gz PyGCP-0.1.0.tar.gz
  cp ../../build/python/IPythonGCP-0.1.0.tar.gz IPythonGCP-0.1.0.tar.gz
  exit
fi

if [ "$1" = "clean" ]; then
  rm ipython.tar.gz
  rm PyGCP-0.1.0.tar.gz
  rm IPythonGCP-0.1.0.tar.gz
  exit
fi

if [ "$1" = "build" ]; then
  sudo docker build -t gcp-ipython .
  exit
fi

if [ "$1" = "start" ]; then
  sudo docker run -p 127.0.0.1:8080:8080 -t gcp-ipython -name ipy
  exit
fi

if [ "$1" = "shell" ]; then
  sudo docker run -i --entrypoint="/bin/bash" -t gcp-ipython
  exit
fi

if [ "$1" = "cloud" ]; then
  sudo gcloud preview app deploy . --force \
    --project data-studio-team \
    --version ipython \
    --server preview.appengine.google.com \
    --docker-host unix:///var/run/docker.sock
  exit
fi

if [ "$1" = "local" ]; then
  sudo gcloud preview app run . \
    --project data-studio-team \
    --docker-host unix:///var/run/docker.sock
  exit
fi

