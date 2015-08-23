#!/bin/bash
# Builds the GCPData python library.
#

# Fail the build on the first error, instead of carrying on by default
set -o errexit;

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

BUILD_DIR="$REPO_DIR/build/lib"
mkdir -p $BUILD_DIR

# Build a source distribution package
python setup.py sdist --dist-dir=$BUILD_DIR
