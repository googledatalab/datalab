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

FROM debian:jessie
RUN apt-get update -y
RUN apt-get install --no-install-recommends -y -q curl git wget vim

# Setup Python and Python Libraries
RUN apt-get install --no-install-recommends -y -q python2.7 python-pip
RUN pip install -U pip
RUN apt-get install --no-install-recommends -y -q \
  python-zmq python-tornado python-jinja2 python-numpy python-pandas python-matplotlib \
  python-oauth2client python-httplib2
RUN pip install -U ipython==2.2.0

# Setup Nodejs
RUN mkdir /node && curl http://nodejs.org/dist/v0.10.32/node-v0.10.32-linux-x64.tar.gz | tar xvzf - -C /node --strip-components=1
ENV PATH $PATH:/node/bin

# Add SDK Libraries
ADD PyGCP-0.1.0.tar.gz /sdk/
RUN cd /sdk/PyGCP-0.1.0 && python setup.py install

ADD IPythonGCP-0.1.0.tar.gz /sdk/
RUN cd /sdk/IPythonGCP-0.1.0 && python setup.py install

# Setup IPython
ADD ipython.tar.gz /
RUN cd /ipython/proxy && npm install
ENV IPYTHON_ENV cloud

# Setup User Space
RUN mkdir /env && mkdir /env/python
ENV PYTHONPATH $PYTHONPATH:/env/python

# Managed VM Application Setup
ADD app.yaml /home/vmagent/app/app.yaml
ADD app.js /home/vmagent/app/app.js

# Startup
EXPOSE 8080
ADD startup.sh /
RUN chmod +x /startup.sh

ENTRYPOINT /startup.sh

