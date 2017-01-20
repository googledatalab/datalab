#!/bin/bash -e

# Build the base docker image
cd ../datalab
./build.sh "$1"
cd ../test

# Build the docker image
docker build -t datalab-test .

