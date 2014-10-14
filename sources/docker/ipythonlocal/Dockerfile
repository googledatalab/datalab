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

FROM gcp-ipython

# Add gcloud configuration for auth and project information
ONBUILD ADD gcloud /root/.config/gcloud/

# Add the metadata service emulator tool
ADD server.js /tools/metadata/server.js
ENV METADATA_HOST localhost
ENV METADATA_PORT 8000

ADD commands.sh /commands.sh
RUN chmod +x /commands.sh
ENTRYPOINT /commands.sh

