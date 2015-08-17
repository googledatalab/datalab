#!/bin/bash
# Build IPython extensions, customized profile, and proxy server
#

# Fail the build on the first error, instead of carrying on by default
set -o errexit;

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

BUILD_DIR="$REPO_DIR/build"
WEB_DIR=$BUILD_DIR/web

mkdir -p $WEB_DIR

# Compile the nodejs proxy server
tsc --module commonjs --noImplicitAny \
    --outDir $WEB_DIR \
    ./datalab/*.ts

rsync -avp ./datalab/config/ $WEB_DIR/config
rsync -avp ./datalab/static/ $WEB_DIR/static
rsync -avp ./datalab/package.json $WEB_DIR/package.json
