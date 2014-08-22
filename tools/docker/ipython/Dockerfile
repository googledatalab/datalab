# Base image for datastudio
FROM debian:jessie

MAINTAINER datastudio-team

RUN apt-get update -y && apt-get install --no-install-recommends -y -q python2.7 python-pip 
RUN pip install -U pip

RUN apt-get install --no-install-recommends -y -q python-zmq python-tornado python-jinja2 python-oauth2client
RUN apt-get install --no-install-recommends -y -q python-numpy python-pandas python-matplotlib
RUN pip install -U ipython==2.2.0
