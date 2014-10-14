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

# Starts an IPython container deployed to a GCE VM.

if [ "$#" -lt 3 ]; then
  echo "Usage: vm.sh <cloud project> <vm> [<zone>] [<docker registry>]"
  echo
  echo "  cloud project  : the cloud project to deploy to."
  echo "  vm             : the name of the VM to create."
  echo "  zone           : the zone to create the VM in."
  echo "  docker registry: the registry containing the docker image to deploy."
  echo

  exit
fi

IMAGE_NAME="gcp-ipython"
NETWORK_NAME=ipython
CLOUD_PROJECT=$1
VM=$2

if [ "$3" = "" ]; then
  ZONE="us-central1-a"
else
  ZONE=$3
fi

if [ "$4" = "" ]; then
  DOCKER_IMAGE=$IMAGE_NAME
else
  DOCKER_IMAGE="$4/$IMAGE_NAME"
fi

# Generate the VM manifest
cat > vm.yaml << EOF1
version: v1beta2
containers:
  - name: $VM
    image: $DOCKER_IMAGE
    ports:
      - name: ipython
        hostPort: 8080
        containerPort: 8080

EOF1

# Create the network (if needed) and allow SSH access
gcloud compute networks describe $NETWORK_NAME --project $CLOUD_PROJECT
if [ $? -gt 0 ]; then
  gcloud compute networks create $NETWORK_NAME --project $CLOUD_PROJECT
  gcloud compute firewall-rules create allow-ssh --allow tcp:22 \
    --project $CLOUD_PROJECT \
    --network $NETWORK_NAME
  gcloud compute firewall-rules create allow-ssh --allow tcp:22 \
    --project $CLOUD_PROJECT \
    --network $NETWORK_NAME
fi


# Create the VM
gcloud compute instances create $VM \
  --image container-vm-v20140731 \
  --image-project google-containers \
  --project $CLOUD_PROJECT \
  --zone $ZONE \
  --machine-type n1-standard-1 \
  --network $NETWORK_NAME \
  --maintenance-policy "MIGRATE" \
  --scopes storage-full bigquery datastore sql \
  --metadata-from-file google-container-manifest=vm.yaml

# Cleanup
rm vm.yaml

# Info
echo ""
echo "VM has been started..."
echo "Once the docker container within the VM is up, setup SSH tunneling:"
echo "gcloud compute ssh --ssh-flag=\"-L 8080:localhost:8080\" --project $CLOUD_PROJECT --zone $ZONE $VM"
echo ""
