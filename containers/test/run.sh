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

# Use this flag to map in web server content during development
#  -v $REPO_DIR/sources/web:/sources \
docker run -it --entrypoint=$ENTRYPOINT \
  -v "$CONTENT:/content" \
  -p 8081:8080 \
  -p 8910:8910 \
  -e "DATALAB_ENV=local" \
  -e "ENABLE_USAGE_REPORTING=false" \
  datalab-test

