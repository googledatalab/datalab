FROM datalab
MAINTAINER Google Cloud DataLab

# install firefox and xvfb
RUN touch /etc/apt/sources.list.d/debian-mozilla.list && \
    echo "deb http://mozilla.debian.net/ jessie-backports firefox-release" > /etc/apt/sources.list.d/debian-mozilla.list && \
    cd ~/ && \
    wget mozilla.debian.net/pkg-mozilla-archive-keyring_1.1_all.deb && \
    dpkg -i pkg-mozilla-archive-keyring_1.1_all.deb && \
    apt-get update && apt-get install -y --no-install-recommends -t jessie-backports firefox xvfb

# download the firefox gecko driver for selenium and place it under PATH
RUN wget https://github.com/mozilla/geckodriver/releases/download/v0.13.0/geckodriver-v0.13.0-linux64.tar.gz && \
    tar -xvf geckodriver-v0.13.0-linux64.tar.gz && \
    mv geckodriver /usr/local/bin/

RUN pip install selenium

# add test files
ADD content/ /datalab/test

# Use virtual display to open firefox
ENV DISPLAY=:10

# Startup
ENTRYPOINT [ "/datalab/test/startup.sh" ]
