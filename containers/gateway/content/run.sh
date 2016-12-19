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

# Start the DataLab kernel gateway.
supervisord -c /etc/supervisor/conf.d/jupyter-gateway.conf

n=0; while true; do
  n=$((n+1)); sleep 1s
  curl -s 'http://127.0.0.1:8081' >/dev/null 2>&1 && curl_error=0 || curl_error=$?
  if [ $curl_error = 0 ]; then echo 'Jupyter kernel gateway started.'; break
  elif [ $curl_error -gt 10 ]; then echo 'Failed to start jupyter kernel gateway.'; exit 1
  fi
done

# Start the proxy.
if [ -z "${DATALAB_DEBUG}" ]
then
  echo "Starting Datalab Kernel Gateway in silent mode, for debug output, rerun with an additional '-e DATALAB_DEBUG=true' argument"
else
  # The Datalab job logs to this file, make sure it exists and tail it
  touch /var/log/gateway.stdout.log
  tail -f /var/log/gateway.stdout.log &
fi

supervisord -n -c /etc/supervisor/conf.d/gateway.conf
