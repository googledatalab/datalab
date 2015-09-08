#!/bin/bash
# Runs python tests for the GCPData sdk component
#

# We cannot import both lib/api and lib/datalab packages from the sourcei
# directories as there must be a gcp package in each case and they cannot
# be distinct. I.e. if we have gcp package in lib/api, then Python will
# expect to find gcp.datalab under it. So we create a symlink for the
# duration of the test run then remove it. We add a Ctrl-C handler too
# to make sure we clean up if interrupted, although that is likely overkill.

trap ctrl_c INT

function ctrl_c() {
  rm ../api/gcp/datalab
  exit -1
}

ln -s $REPO_DIR/sources/lib/datalab/gcp/datalab ../api/gcp/datalab
python ./tests/main.py
rm ../api/gcp/datalab

