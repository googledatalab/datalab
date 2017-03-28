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

# Setup environment variables.
. /datalab/setup-env.sh

# Run the user's custom extension script if it exists. To avoid platform issues with 
# execution permissions, line endings, etc, we create a local sanitized copy.
if [ -f /content/datalab/.config/startup.sh ]
then
  tr -d '\r' < /content/datalab/.config/startup.sh > ~/startup.sh
  chmod +x ~/startup.sh
  . ~/startup.sh
fi

# Start the Datalab kernel gateway.
KG_COMMAND="jupyter kernelgateway --JupyterWebsocketPersonality.list_kernels=True --KernelGatewayApp.port=8080 --KernelGatewayApp.ip=0.0.0.0"
if [ -n "${DATALAB_NOTEBOOK}" ]; then
  KG_COMMAND="${KG_COMMAND} --KernelGatewayApp.api=kernel_gateway.notebook_http --KernelGatewayApp.seed_uri=${DATALAB_NOTEBOOK}"
fi

${KG_COMMAND}
