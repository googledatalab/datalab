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

# This file defines a mock Datalab image that can be used for testing
# the command line tool. This is meant to be significantly smaller than
# the real image so that CLI tests can be run much faster.
#
# This only implements the subset of the server that is checked by the
# CLI.
#
# This should not be used when testing a build or release; for those
# scenarios use the real image. Instead, this is meant for developers
# modifying the CLI and wanting to quickly check their changes.

FROM nginx
MAINTAINER Google Cloud DataLab
EXPOSE 8080

RUN mkdir -p /usr/share/nginx/html && \
    sed -i -e "s/listen       80;/listen       8080;/g" /etc/nginx/conf.d/default.conf && \
    echo "<html><body>Hello from mock Datalab</body></html>" >> /usr/share/nginx/html/_info