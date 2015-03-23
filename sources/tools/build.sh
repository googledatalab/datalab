#!/bin/bash
# Build miscellaneous tools
#

# Fail the build on the first error, instead of carrying on by default
set -o errexit;

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

BUILD_DIR="$REPO_DIR/build"

# Copy the metadata service emulator tool used in the local ipython container
cp -R ./metadata $BUILD_DIR/metadata
