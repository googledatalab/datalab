#!/bin/sh

# Build script for gcp/ipython container running locally.

# To start a container running gcp/ipython on localhost:8080, after build is done:
#   docker run -p 8080:8080 --name gcp gcp/ipython:latest
# To stop running container:
#   docker stop gcp
# Running docker on Goobuntu: 
#   http://go/installdocker

docker build -t google/gcp-ipython ./docker/ipython
docker build -t google/gcp ..

