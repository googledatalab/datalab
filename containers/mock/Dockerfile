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
# CLI. That, in turn, means that it must require the following:
#
# 1. The Cloud SDK, which is used for cloning the source repo.
# 2. The git command line tool, which is used for populating the source repo.
# 3. A webserver that serves a 200 response to the "/_info" path.
#
# This should not be used when testing a build or release; for those
# scenarios use the real image. Instead, this is meant for developers
# modifying the CLI and wanting to quickly check their changes.

FROM nginx
MAINTAINER Google Cloud DataLab
EXPOSE 8080

RUN sed -i -e "s/listen       80;/listen       8080;/g" /etc/nginx/conf.d/default.conf && \
    mkdir -p /usr/share/nginx/html/_info && \
    echo "<html><body>Hello from mock Datalab</body></html>" >> /usr/share/nginx/html/_info/index.html && \
    apt-get update -y && \
    apt-get install -y -q git wget unzip python && \
    wget -nv https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.zip && \
    unzip -qq google-cloud-sdk.zip -d tools && \
    rm google-cloud-sdk.zip && \
    tools/google-cloud-sdk/install.sh --usage-reporting=false \
        --path-update=false --bash-completion=false \
        --disable-installation-options
