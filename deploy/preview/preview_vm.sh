#!/bin/bash
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

# Creates a new demo GCE VM instance. Useful logs on the VM:
#   /var/log/startupscript.log
#   /var/log/kubelet.log
#   /var/log/docker.log

if [ "$#" -ne 2 ]; then
    echo "Usage: preview_vm.sh <instance_name> <ip_range>"
    exit
fi

TAG=ds-preview

gcloud compute firewall-rules update default-allow-$TAG --source-ranges=$2 \
  --source-tags=$TAG --allow tcp:8080 tcp:8081
 
gcloud compute instances create $1 \
  --image container-vm-v20140731 \
  --image-project google-containers \
  --zone us-central1-a \
  --machine-type n1-standard-1 \
  --maintenance-policy "TERMINATE" \
  --tags $TAG \
  --scopes storage-full bigquery datastore sql \
  --metadata-from-file google-container-manifest=preview_vm.yml \
      startup-script=preview_vm_startup.sh
