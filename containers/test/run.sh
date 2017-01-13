CONTENT=$HOME
ENTRYPOINT=""
if [ "$1" != "" ]; then
  if [ "$1" != "shell" ]; then
    CONTENT=$1
    shift
  fi
  if [ "$1" == "shell" ]; then
    ENTRYPOINT="/bin/bash"
  fi
fi

# disable EULA for the sake of tests
mkdir -p $CONTENT/datalab/.config/eula

# On linux docker runs directly on host machine, so bind to 127.0.0.1 only
# to avoid it being accessible from network.
# On other platform, it needs to bind to all ip addresses so VirtualBox can
# access it. Users need to make sure in their VirtualBox port forwarding
# settings only 127.0.0.1 is bound.
if [ "$OSTYPE" == "linux"* ]; then
  PORTMAP="127.0.0.1:8081:8080"
else
  PORTMAP="8081:8080"
fi
# Use this flag to map in web server content during development
#  -v $REPO_DIR/sources/web:/sources \
docker run -it --entrypoint=$ENTRYPOINT \
  -v "$CONTENT:/content" \
  -p $PORTMAP \
  -p 8910:8910 \
  -e "DATALAB_ENV=local" \
  datalab-test

