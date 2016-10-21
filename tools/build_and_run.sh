#!/bin/bash
#
# Build and run the containers

# Set the project id.
PROJECT_ID="datalab-deploy-test1"

echo "Initializing and cleaning up..."
cd /usr/local/google/home/oemilyo/new_datalab/datalab/
source '/usr/local/google/home/oemilyo/new_datalab/datalab/tools/initenv.sh'
rm -rf build

echo "Building the sources..."
cd sources/
./build.sh || exit $?

echo "Building the containers..."
cd ../containers/datalab
./build.sh || exit $?

echo "Starting the server..."
PROJECT_ID=$PROJECT_ID ./run.sh
