#!/bin/sh

echo 'Deploys the docker image as a managed VM application'

sudo gcloud preview app deploy . --force \
  --project data-studio-team \
  --version ipython \
  --server preview.appengine.google.com \
  --docker-host unix:///var/run/docker.sock

