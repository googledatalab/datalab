#!/bin/sh

# If this docker container instance is running outside of the cloud, then
# start the local metadata service that works against gcloud, and export the
# endpoint it is listening on for all child processes.
if [ "$GAE_VM" = "" ]; then
  export METADATA_HOST=localhost
  export METADATA_PORT=8000

  node /tools/metadata/server.js &
fi

node /ipython/proxy/app.js
