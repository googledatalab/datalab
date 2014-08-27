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

# Sets up a GCE build vm or runs build on it

if [ "$#" -ne 2 ]; then
    echo "Usage: build.sh <build_vm> <step>"
    echo "step: 'stage' (to stage files) - or -"
    echo "      'image' (to build/publish the docker image)"
    exit
fi

VM=$1

if [ "$2" == "stage" ]; then
  # Stages files for building onto the VM

  gcloud compute ssh --zone us-central1-a $VM --command="mkdir -p ~/build"

  gcloud compute copy-files --zone us-central1-a Dockerfile $VM:~/build/Dockerfile
  gcloud compute copy-files --zone us-central1-a ../../build/python/PyGCP-0.1.0.tar.gz $VM:~/build/PyGCP.tar.gz
  gcloud compute copy-files --zone us-central1-a ../../build/python/IPythonGCP-0.1.0.tar.gz $VM:~/build/IPythonGCP.tar.gz
  gcloud compute copy-files --zone us-central1-a ../../build/ipython.tar.gz $VM:~/build/ipython.tar.gz

  gcloud compute ssh --zone us-central1-a $VM --command="cd ~/build && gsutil cp gs://datastudio-misc/ijava.tar.gz ijava.tar.gz"

  gcloud compute ssh --zone us-central1-a $VM --command="cd ~/build && ls -l"
fi

if [ "$2" == "image" ]; then
  # Build and publish a docker image.

  gcloud compute ssh --zone us-central1-a $VM \
    --command="cd ~/build && sudo docker build -t docker-registry:5000/ds:preview . && sudo docker push docker-registry:5000/ds:preview ."
fi
