#!/bin/sh
# Copyright 2014 Google Inc. All rights reserved.
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

docker run -p 127.0.0.1:8080:8080 -i \
  -v ~/.config:/.config:rw \
  -t gcp-ipython

# Note for using boot2docker
# The port is not exposed on the host machine. Run this as well:
# boot2docker ssh -L 8080:localhost:8080
