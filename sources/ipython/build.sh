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
PYLIB_DIR=$BUILD_DIR/lib
IPY_DIR=$BUILD_DIR/ipython
PROXY_DIR=$BUILD_DIR/ipython/proxy

mkdir -p $PYLIB_DIR
mkdir -p $IPY_DIR
mkdir -p $PROXY_DIR

# Build a source distribution package for the IPython extensions
python setup.py sdist --dist-dir=$PYLIB_DIR
mv MANIFEST $PYLIB_DIR/IPython.manifest

# Copy the IPython customized profile over
rsync -avp ./profile/config.py $IPY_DIR/config.py

# Compile the nodejs proxy server
tsc --module commonjs --noImplicitAny \
    --outDir $PROXY_DIR \
    ./proxy/*.ts

rsync -avp ./proxy/config/ $PROXY_DIR/config
rsync -avp ./proxy/static/ $PROXY_DIR/static
rsync -avp ./proxy/package.json $PROXY_DIR/package.json
