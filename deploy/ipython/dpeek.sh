#!/bin/sh

echo 'Runs the docker image to peek inside it via a command prompt'

sudo docker run -i --entrypoint="/bin/bash" -t gcp-ipython

