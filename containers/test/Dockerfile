FROM datalab
MAINTAINER Google Cloud DataLab

# install firefox and xvfb
RUN apt-get update && apt-get install -y pkg-mozilla-archive-keyring

RUN echo 'deb http://mozilla.debian.net/ jessie-backports firefox-esr' > /etc/apt/sources.list.d/jessie-backports.list

RUN apt-get update && apt-get install -y xvfb && \
    apt-get install -y -t jessie-backports firefox-esr

# download the firefox gecko driver for selenium and place it under PATH
RUN wget https://github.com/mozilla/geckodriver/releases/download/v0.15.0/geckodriver-v0.15.0-linux64.tar.gz && \
    tar -xvf geckodriver-v0.15.0-linux64.tar.gz && \
    mv geckodriver /usr/local/bin/

RUN pip install selenium

# add test files
ADD content/ /datalab/test

# Use virtual display to open firefox
ENV DISPLAY=:10

# Startup
ENTRYPOINT [ "/datalab/test/startup.sh" ]
