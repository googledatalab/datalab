#!/bin/bash
# Runs all tests by invoking test.sh for specific subcomponents.
#

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run `source tools/initenv.sh` first";
  exit 1;
fi

TEST_PATHS=(
  "sdk/pygcp"
  "server"
)

for p in "${TEST_PATHS[@]}"
do
  echo "Testing $p ... "

  TEST_DIR=$REPO_DIR/sources/$p
  pushd $TEST_DIR >> /dev/null

  ./test.sh

  popd >> /dev/null
  echo
done

