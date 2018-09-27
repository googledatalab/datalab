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
FROM debian

ADD supervisord.conf /etc/supervisor/conf.d/supervisord.conf
ADD ./ /opt/src/vm-manager

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y -qq --no-install-recommends \
      ca-certificates \
      curl \
      git \
      supervisor \
      unzip \
      wget && \
    mkdir -p /opt/bin && \
    mkdir -p /var/log/supervisor && \
    mkdir -p /var/log/app_engine/custom_logs && \
    wget -O /opt/go1.10.3.linux-amd64.tar.gz \
      https://storage.googleapis.com/golang/go1.10.3.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf /opt/go1.10.3.linux-amd64.tar.gz && \
    export PATH=${PATH}:/usr/local/go/bin/:/opt/bin/ && \
    export GOPATH=/opt/ && \
    cd /opt/src/vm-manager && \
    go get github.com/golang/groupcache/lru && \
    go get golang.org/x/net/context && \
    go get golang.org/x/oauth2/google && \
    go get google.golang.org/api/compute/v1 && \
    go get google.golang.org/api/iam/v1 && \
    go build -o /opt/bin/vm-manager manager.go && \
    go get github.com/google/inverting-proxy/agent && \
    rm -rf /opt/go1.4.2.linux-amd64.tar.gz && \
    rm -rf /usr/local && \
    wget -nv https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.zip && \
    unzip -qq google-cloud-sdk.zip -d /opt/tools && \
    rm google-cloud-sdk.zip && \
    /opt/tools/google-cloud-sdk/install.sh --usage-reporting=false \
        --path-update=false --bash-completion=false \
        --disable-installation-options

ENV ZONE us-west1-a
ENV MACHINE_TYPE n1-standard-1
ENV NETWORK default
ENV ALLOWED_DOMAIN gmail.com

EXPOSE 8080

CMD /usr/bin/supervisord
