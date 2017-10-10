#!/bin/bash -e
# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Sets up various environment variables within the docker container.

# TODO(ojarjur): This is a remnant of the old App-Engine based environment,
# and as such, we should remove it.
export DATALAB_ENV="local"

# Ensure that gcloud has been told to use a config directory under the
# mounted volume (so that the results of 'gcloud auth login' are persisted).
export CLOUDSDK_CONFIG=${CLOUDSDK_CONFIG:-"/content/datalab/.config"}

# Lookup the project and zone, which may be in the mapped gcloud config.
export PROJECT_ID=${PROJECT_ID:-`gcloud config list -q --format 'value(core.project)' 2> /dev/null`}
export ZONE=${ZONE:-`gcloud config list -q --format 'value(compute.zone)' 2> /dev/null`}

# Lookup the author email address to use for git commits, and then configure git accordingly
export DATALAB_GIT_AUTHOR=${DATALAB_GIT_AUTHOR:-`gcloud auth list --format 'value(account)' --filter 'status:ACTIVE'`}
git config --global user.email "${DATALAB_GIT_AUTHOR}"
git config --global user.name "${DATALAB_GIT_AUTHOR}"
