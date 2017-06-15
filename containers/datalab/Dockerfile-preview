# Copyright 2017 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# This file defines the "preview" Datalab images.
#
# These images are meant to be used by end users who want to try out
# experiental features that are planned for a future release but are
# not yet ready for general use.
#
# Each such feature has a corresponding environment variable that
# controls whether or not the feature is enabled. This image extends
# the standard Datalab images by setting those environment variables
# to enable the various preview features.

FROM datalab
MAINTAINER Google Cloud DataLab

env DATALAB_EXPERIMENTAL_UI true
