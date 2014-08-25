#!/bin/sh

# Script to launch IPython with an in-memory notebook manager, to
# make it easy to try things without needing to do any cleanup.

export IPYTHON_ENV=memory

# Setup python path to include modules being developed as well as any
# developer specific modules.
LIBS=$REPO_DIR/sources/sdk/pygcp:$REPO_DIR/sources/ipython
export PYTHONPATH=$PYTHONPATH:$LIBS

# Spew out some informative output.
echo 'Lib Path :' $PYTHONPATH
echo 'Local URL: http://localhost:9002'
echo '----------'

# Finally start IPython.
ipython notebook --config=$REPO_DIR/sources/ipython/config.py \
  --ip="*" --port=9002 \
  --matplotlib=inline --no-mathjax --no-script --quiet
