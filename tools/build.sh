#!/bin/sh

# Build script for datastudio container running locally.

# To start a container running datastudio on localhost:8080, after build is done:
#   docker run -p 8080:8080 --name datastudio datastudio:latest
# To stop running container:
#   docker stop datastudio
# Running docker on Goobuntu: 
#   http://go/installdocker

docker build -t ipython ./docker/ipython
docker build -t datastudio ..

