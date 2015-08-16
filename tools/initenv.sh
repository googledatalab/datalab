#!/bin/sh

# This script initializes an dev prompt with the required environment variables
# and any other environment customizations.

# Export a variable corresponding to the root of the repository
SCRIPT=$0
if [ "$SCRIPT" == "-bash" ]; then
  SCRIPT=${BASH_SOURCE[0]}
fi
export REPO_DIR=$(git rev-parse --show-toplevel)

# Turn off python's default behavior of generating .pyc files, so that we don't
# end up picking up stale code when running samples or tests during development.
export PYTHONDONTWRITEBYTECODE=1

# Add this tools directory to the path
export PATH=$PATH:$REPO_DIR/tools

# Add aliases
alias pylint='pylint --rcfile=$REPO_DIR/tools/pylint.rc'

# Add variables related to boot2docker
if [ "$1" == "docker" ]; then
  export DOCKER_HOST=tcp://192.168.59.103:2376
  export DOCKER_CERT_PATH=/Users/$USER/.boot2docker/certs/boot2docker-vm
  export DOCKER_TLS_VERIFY=1
fi

