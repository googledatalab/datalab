#!/bin/sh

docker run -d -e GCS_BUCKET=datastudio-docker-registry -p 5000:5000 google/docker-registry

