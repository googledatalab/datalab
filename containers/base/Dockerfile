# Copyright 2015 Google Inc. All rights reserved.
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

FROM debian:jessie
MAINTAINER Google Cloud DataLab

# Setup OS and core packages
RUN echo "deb-src http://ftp.us.debian.org/debian testing main" >> /etc/apt/sources.list && \
    apt-get update -y && \
    apt-get install --no-install-recommends -y -q \
        curl wget unzip git vim build-essential ca-certificates pkg-config \
        libatlas-base-dev liblapack-dev gfortran \
        libpng-dev libfreetype6-dev libxft-dev \
        rsync \
        libxml2-dev \
        python2.7 python-dev python-setuptools python-zmq && \
    easy_install pip && \
    mkdir -p /tools && \
    mkdir -p /srcs && \
    cd /srcs && apt-get source -d python-zmq && cd /

# Setup Python packages. Rebuilding numpy/scipy is expensive so we move this early
# to reduce the chance that prior steps can cause changes requiring a rebuild.
RUN pip install -U numpy==1.11.0 && \
    pip install -U pandas==0.18.0 && \
    pip install -U scipy==0.17.0 && \
    pip install -U scikit-learn==0.17.1 && \
    pip install -U sympy==0.7.6.1 && \
    pip install -U statsmodels==0.6.1

RUN pip install -U tornado==4.3 \
                   pyzmq==15.2.0 \
                   jinja2==2.8 \
                   jsonschema==2.5.1 \
                   python-dateutil==2.5.0 \
                   pytz==2015.4 \
                   pandocfilters==1.3.0 \
                   pygments==2.1.3 \
                   argparse==1.2.1 \
                   mock==1.2.0 \
                   requests==2.9.1 \
                   oauth2client==2.0.2 \
                   httplib2==0.9.2 \
                   futures==3.0.5 && \
    pip install -U matplotlib==1.5.1 && \
    pip install -U ggplot==0.6.8 && \
    pip install -U seaborn==0.7.0 && \
    pip install -U notebook==4.2.0 && \
    pip install -U PyYAML==3.11 && \
    pip install -U six==1.9.0 && \
    pip install -U ipywidgets==5.0.0 && \
    pip install -U future==0.15.2 && \
    easy_install pip && \
    find /usr/local/lib/python2.7 -type d -name tests | xargs rm -rf

# Setup Node.js
RUN mkdir -p /tools/node && \
    wget -nv https://nodejs.org/dist/v4.3.2/node-v4.3.2-linux-x64.tar.gz -O node.tar.gz && \
    tar xzf node.tar.gz -C /tools/node --strip-components=1 && \
    rm node.tar.gz

# Setup Google Cloud SDK
# Also apply workaround for gsutil failure brought by this version of Google Cloud.
# (https://code.google.com/p/google-cloud-sdk/issues/detail?id=538) in final step.
RUN wget -nv https://dl.google.com/dl/cloudsdk/release/google-cloud-sdk.zip && \
    unzip -qq google-cloud-sdk.zip -d tools && \
    rm google-cloud-sdk.zip && \
    tools/google-cloud-sdk/install.sh --usage-reporting=false \
        --path-update=false --bash-completion=false \
        --disable-installation-options && \
    tools/google-cloud-sdk/bin/gcloud -q components update \
        gcloud core bq gsutil compute preview alpha beta && \
    touch /tools/google-cloud-sdk/lib/third_party/google.py

# Container configuration
EXPOSE 8080

# Path configuration
ENV PATH $PATH:/tools/node/bin:/tools/google-cloud-sdk/bin
ENV PYTHONPATH /env/python

# Add some unchanging bits - specifically node modules (that need to be kept in sync
# with packages.json manually, but help save build time, by preincluding them in an
# earlier layer).
# Note: ws is now over 1.0 but using that gives issues so leaving at 0.4.2 for now.
RUN /tools/node/bin/npm install \
        ws@0.4.32 \
        http-proxy@1.13.2 \
        mkdirp@0.5.1 \
        node-uuid@1.4.7 \
        bunyan@1.7.1 \
        tcp-port-used@0.1.2 \
        node-cache@3.2.0 && \
    cd / && \
    /tools/node/bin/npm install -g forever && \
    /tools/node/bin/npm install -g typescript

# Install ProtoBuf, TensorFlow
RUN pip install protobuf==3.0.0b2.post2 && \
    wget https://storage.googleapis.com/cloud-datalab/deploy/tf/tensorflow-0.9.0-cp27-none-linux_x86_64.whl && \
    pip install tensorflow-0.9.0-cp27-none-linux_x86_64.whl && \
    rm tensorflow-0.9.0-cp27-none-linux_x86_64.whl

# Install DataFlow
RUN wget https://github.com/GoogleCloudPlatform/DataflowPythonSDK/archive/v0.2.7.tar.gz && \
    pip install v0.2.7.tar.gz && \
    rm v0.2.7.tar.gz

ADD nbconvert /datalab/nbconvert
ADD config/ipython.py /etc/ipython/ipython_config.py
ADD config/nbconvert.py /etc/jupyter/jupyter_notebook_config.py

# Do IPython configuration and install build artifacts
# Then link stuff needed for nbconvert to a location where Jinja will find it.
# I'd prefer to just use absolute path in Jinja imports but those don't work.
RUN ipython profile create default && \
    jupyter notebook --generate-config && \
    mkdir -p /datalab/lib && \
    cd /datalab/lib && \
    git clone https://github.com/googledatalab/pydatalab.git && \
    cd /datalab/lib/pydatalab && \
    tsc --module amd --noImplicitAny --outdir datalab/notebook/static datalab/notebook/static/*.ts && \
    pip install . && \
    jupyter nbextension install --py datalab.notebook && \
    rm datalab/notebook/static/*.js && \
    mkdir -p /datalab/nbconvert && \
    cp -R /usr/local/share/jupyter/nbextensions/gcpdatalab/* /datalab/nbconvert && \
    ln -s /usr/local/lib/python2.7/dist-packages/notebook/static/custom/custom.css /datalab/nbconvert/custom.css && \
    mkdir -p /usr/local/lib/python2.7/dist-packages/notebook/static/components/codemirror/mode/text/sql/text && \
    ln -s /usr/local/share/jupyter/nbextensions/gcpdatalab/codemirror/mode/sql.js /usr/local/lib/python2.7/dist-packages/notebook/static/components/codemirror/mode/text/sql/text/sql.js && \
    cd /

# Include this line above to enable ipywidgets. These aren't working 100% yet so 
# we don't enable them.
#    jupyter nbextension enable --py widgetsnbextension && \
