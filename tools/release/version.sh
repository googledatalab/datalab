#!/bin/bash -e

# Copyright 2017 Google Inc. All rights reserved.
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
#
# This script keeps the current Datalab version, and should be incremented
# properly on new releases

DATALAB_VERSION_MAJOR=1
DATALAB_VERSION_MINOR=2
DATE=`date +%Y%m%d`
DATALAB_VERSION_PATCH="${BUILD:-$DATE}"
DATALAB_VERSION="${DATALAB_VERSION_MAJOR}.${DATALAB_VERSION_MINOR}.${DATALAB_VERSION_PATCH}"
DATALAB_COMMIT=`git log --pretty=format:'%H' -n 1`
