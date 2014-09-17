#!/bin/sh

# Script to launch IPython in similar manner to how it would be within a
# container in the cloud.

export IPYTHON_ENV=cloud

# Setup python path to include modules being developed as well as any
# developer specific modules.
LIBS=$REPO_DIR/sources/sdk/pygcp:$REPO_DIR/sources/ipython
export PYTHONPATH=$PYTHONPATH:$LIBS

# Spew out some informative output.
echo 'Lib Path :' $PYTHONPATH
echo 'Local URL: http://localhost:9001'
echo '----------'

# Finally start IPython.
ipython notebook --config=$REPO_DIR/sources/ipython/profile/config.py \
  --ip="*" --port=9001 \
  --matplotlib=inline --no-mathjax --no-script --quiet
