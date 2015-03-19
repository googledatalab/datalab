#!/bin/bash
# Builds the repository by invoking build.sh for specific subcomponents.
#

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run `source tools/initenv.sh` first";
  exit 1;
fi

SRC_PATHS=(
  "ipython"
  "sdk/pygcp"
  "server"
  "tools"
)

BUILD_DIR=$REPO_DIR/build
LOG_FILE=$BUILD_DIR/build.log

rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR

for SRC in "${SRC_PATHS[@]}"
do
  echo "Building $SRC ... " | tee -a $LOG_FILE

  SRC_DIR=$REPO_DIR/sources/$SRC
  pushd $SRC_DIR >> /dev/null

  ./build.sh >> $LOG_FILE 2>&1

  if [ "$?" -ne "0" ]; then
    echo "failed" | tee -a $LOG_FILE
    echo "Build aborted." | tee -a $LOG_FILE
    exit 1
  else
    echo "succeeded" | tee -a $LOG_FILE
  fi

  popd >> /dev/null
  echo | tee -a $LOG_FILE
done

echo "Build completed." | tee -a $LOG_FILE

