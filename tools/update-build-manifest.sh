#!/bin/bash

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run `source tools/initenv.sh` first";
  exit 1;
fi

BUILD_MANIFEST=$REPO_DIR/tools/build_manifest.txt

echo "----build----" > $BUILD_MANIFEST
find $REPO_DIR/build | sed "s#$REPO_DIR##g" >> $BUILD_MANIFEST
