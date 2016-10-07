#!/bin/bash -e

# Copyright 2016 Google Inc. All rights reserved.
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

ERR_CANCELLED=1
ERR_NETWORK_CREATE=2
ERR_FIREWALL_RULE=3
ERR_INSTANCE_CREATE=4

DOCS="We are about to deploy the Datalab kernel gateway to a GCE VM.

This will:

1. Ensure that the project contains a network named
   'datalab-kernels' with inbound SSH connections allowed
2. Crate a new VM in the default zone connected to the
   'datalab-kernels' network.
3. Run the gateway image in that VM

Datalab will then connect to the resulting VM via an SSH tunnel.
"

PROJECT=${1}
ZONE=${2}
INSTANCE=${3}

echo "${DOCS}"

echo "Will deploy a GCE VM named '${INSTANCE}' to the project '${PROJECT}' in zone '${ZONE}'"
read -p "Proceed? [y/N] " PROCEED

if [[ "${PROCEED}" != "y" ]]; then
  echo "Deploy cancelled"
  exit ${ERR_CANCELLED}
fi

NETWORK="datalab-kernels"
if [[ -z `gcloud --project "${PROJECT}" compute networks list | grep ${NETWORK}` ]]; then
  echo "Creating the compute network '${NETWORK}'"
  gcloud compute networks create "${NETWORK}" --project "${PROJECT}" --description "Network for Datalab kernel gateway VMs" || exit ${ERR_NETWORK_CREATE}
  gcloud compute firewall-rules create allow-ssh --project "${PROJECT}" --allow tcp:22 --description 'Allow SSH access' --network "${NETWORK}" || exit ${ERR_FIREWALL_RULE}
fi

IMAGE="gcr.io/${PROJECT}/datalab-gateway"
CONFIG="apiVersion: v1
kind: Pod
metadata:
  name: '${INSTANCE}'
spec:
  containers:
    - name: datalab-kernel-gateway
      image: ${IMAGE}
      command: ['/datalab/run.sh']
      imagePullPolicy: IfNotPresent
      ports:
        - containerPort: 8080
          hostPort: 8080
          hostIP: 127.0.0.1
      env:
        - name: DATALAB_ENV
          value: GCE
    - name: logger
      image: gcr.io/google_containers/fluentd-gcp:1.18
      env:
        - name: FLUENTD_ARGS
          value: -q
      volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
  volumes:
    - name: varlog
      hostPath:
        path: /var/log
    - name: varlibdockercontainers
      hostPath:
        path: /var/lib/docker/containers
"

echo "Creating the compute VM ${INSTANCE} with config: ${CONFIG}"
gcloud compute instances create "${INSTANCE}" \
    --project "${PROJECT}" \
    --zone "${ZONE}" \
    --network "${NETWORK}" \
    --image-family "container-vm" \
    --image-project "google-containers" \
    --metadata "google-container-manifest=${CONFIG}" \
    --machine-type "n1-highmem-2" \
    --scopes "cloud-platform" || exit ${ERR_INSTANCE_CREATE}

echo "Finished creating the vm ${INSTANCE} running a Datalab kernel gateway

When you no longer need it, please remember to delete the instance to avoid incurring additional costs.

The command to delete this instance is:

    gcloud compute instances delete ${INSTANCE} --project ${PROJECT} --zone ${ZONE}
"
