#!/bin/sh

# If this docker container instance is running outside of the cloud, then
# start the local metadata service that works against gcloud, and export the
# endpoint it is listening on for all child processes.
if [ "$GAE_VM" = "" ]; then
  export METADATA_HOST=localhost
  export METADATA_PORT=8000

  node /tools/metadata/server.js &
fi

ipython notebook --no-browser --no-mathjax --matplotlib inline \
  --ip="127.0.0.1" --port 8081 \
  --config=/ipython/config.py > /dev/null 2> /dev/null &

sleep 5

cd /ipython/proxy
node app.js

