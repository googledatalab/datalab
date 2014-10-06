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

# Various commands to run for building and publishing the docker image.

if [ "$#" -lt 1 ]; then
  echo "Usage: run.sh <command>"
  echo "Commands -"
  echo "  stage  stages files from the build directory to be referenced by Dockerfile."
  echo "  clean  removes previously staged files."
  echo "  image  builds the docker image."
  echo
  echo "  push <target> pushes the built docker image to the specified registry."
  echo
  exit
fi

if [ "$1" = "stage" ]; then
  cp -R ../../../build build
  exit
fi

if [ "$1" = "clean" ]; then
  rm -rf build
  exit
fi

if [ "$1" = "image" ]; then
  sudo docker build -t gcp-ipython .
  exit
fi

if [ "$1" = "push" ]; then
  if [ "$#" -lt 2 ]; then
    echo "Missing registry argument."
    exit
  fi

  sudo docker tag gcp-ipython $2/gcp-ipython
  sudo docker push $2/gcp-ipython
fi

echo "Unknown command."

