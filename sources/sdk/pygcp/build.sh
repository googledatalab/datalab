#!/bin/bash
# Builds the PyGCP python sdk library.
#

# Fail the build on the first error, instead of carrying on by default
set -o errexit;

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

BUILD_DIR="$REPO_DIR/build"
PYLIB_DIR=$BUILD_DIR/python

# Build a source distribution package
mkdir -p $PYLIB_DIR

python setup.py sdist --dist-dir=$PYLIB_DIR
mv MANIFEST $PYLIB_DIR/PyGCP.manifest
