#!/bin/sh

source $(dirname $0)/initenv.sh
# Installing pre-push hook for running tests in sources directory
PRE_PUSH_DEST=$REPO_DIR/.git/hooks/pre-push
cp $(dirname $0)/pre-push $PRE_PUSH_DEST
chmod u+x $PRE_PUSH_DEST
