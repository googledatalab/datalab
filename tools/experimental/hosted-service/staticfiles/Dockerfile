# Copyright 2018 Google Inc. All rights reserved.
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

# This relies on the new feature of running a Datalab instance in read-only
# mode, which was submitted in #2075 but has not yet been released.
#
# Once it gets released, this image tag should be changed to be the image
# for the latest release rather than being pinned to this specific commit.
FROM gcr.io/cloud-datalab/datalab:commit-9dd43fe68e6cc2975ca0383caeb04caa4057ab91

ENV DATALAB_SETTINGS_OVERRIDES="{\"proxyWebSockets\": \"true\", \"readOnly\": \"true\"}"