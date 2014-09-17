#!/bin/sh

# Script to launch IPython with notebooks in a specified directory.

if [ "$#" -ne 1 ]; then
    echo "Usage: ipy.sh <notebook_dir>"
    exit
fi

# Setup python path to include modules being developed as well as any
# developer specific modules.
LIBS=$REPO_DIR/sources/sdk/pygcp:$REPO_DIR/sources/ipython
export PYTHONPATH=$PYTHONPATH:$LIBS

# Spew out some informative output.
echo 'Notebooks:' $1
echo 'Lib Path :' $PYTHONPATH
echo 'Local URL: http://localhost:9000'
echo '----------'

# Finally start IPython.
ipython notebook --notebook-dir=$1 \
  --config=$REPO_DIR/sources/ipython/profile/config.py \
  --ip="*" --port=9000 \
  --matplotlib=inline --no-mathjax --no-script --quiet
