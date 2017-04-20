FROM datalab
MAINTAINER Google Cloud DataLab

# install firefox and xvfb
RUN apt-get update && apt-get install -y pkg-mozilla-archive-keyring libcairo2-dev \
    libjpeg62-turbo-dev libpango1.0-dev libgif-dev build-essential g++

RUN echo 'deb http://mozilla.debian.net/ jessie-backports firefox-esr' > /etc/apt/sources.list.d/jessie-backports.list

RUN apt-get update && apt-get install -y xvfb && \
    apt-get install -y -t jessie-backports firefox-esr

# download the firefox gecko driver for selenium and place it under PATH
RUN wget https://github.com/mozilla/geckodriver/releases/download/v0.14.0/geckodriver-v0.14.0-linux64.tar.gz && \
    tar -xvf geckodriver-v0.14.0-linux64.tar.gz && \
    mv geckodriver /usr/local/bin/

RUN npm install selenium-webdriver@3.0.1 node-resemble@2.0.1
RUN npm install -g mocha@3.2.0

# add test files
ADD content/ /datalab/test

# Use virtual display to open firefox
ENV DISPLAY=:10

WORKDIR /datalab/test

# Startup
ENTRYPOINT [ "/datalab/test/startup.sh" ]
