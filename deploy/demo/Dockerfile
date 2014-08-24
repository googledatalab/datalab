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

RUN apt-get update -y && apt-get install --no-install-recommends -y -q python2.7 python-pip
RUN pip install -U pip

RUN apt-get install --no-install-recommends -y -q python-zmq python-tornado python-jinja2
RUN apt-get install --no-install-recommends -y -q python-numpy python-pandas python-matplotlib
RUN apt-get install --no-install-recommends -y -q python-oauth2client python-httplib2
RUN pip install -U ipython==2.2.0

# Setup java, and jzmq
RUN apt-get install -y openjdk-7-jdk
RUN apt-get install -y git build-essential pkg-config ant libtool autoconf automake make unzip libzmq-dev
RUN git clone --recursive https://github.com/zeromq/jzmq.git
RUN cd jzmq && ./autogen.sh && ./configure && make && make install && ldconfig

ENV LD_LIBRARY_PATH /usr/local/lib:/usr/local/share/java

# Setup ipython
RUN ipython profile create ipython
RUN ipython profile create ijava

# Setup python libraries
ADD PyGCP.tar.gz /
RUN cd PyGCP-0.1.0 && python setup.py install

ADD IPythonGCP.tar.gz /
RUN cd IPythonGCP-0.1.0 && python setup.py install

# Setup IPython customizations
ADD ipython.tar.gz /

# Setup ijava
ADD ijava.tar.gz /

ENV IPYTHON_ENV cloud
CMD ipython notebook --no-browser --no-mathjax --matplotlib inline \
  --config=/$NBPROFILE/config.py --profile=$NBPROFILE \
  --ip="0.0.0.0" --port $NBPORT
