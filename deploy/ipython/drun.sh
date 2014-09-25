#!/bin/sh

echo 'Runs the docker image'

sudo docker run -p 127.0.0.1:8080:8080 -t gcp-ipython -name ipy

