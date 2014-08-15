#!/bin/sh

# Script to launch IPython customized to current user in context of repository.

USERNAME=$1
if [ "$USERNAME" == "" ]; then
  USERNAME=$USER
fi

USER_DIR=$REPO_DIR/dev/$USERNAME
USER_PY_DIR=$USER_DIR/python
USER_NB_DIR=$USER_DIR/notebooks

# Create a notebooks directory
mkdir -p $USER_NB_DIR

# Setup python path to include modules being developed as well as any
# developer specific modules.
LIBS=$REPO_DIR/sources/sdk/pygcp:$REPO_DIR/sources/ipython
export PYTHONPATH=$PYTHONPATH:$LIBS:$USER_PY_DIR

# Spew out some informative output.
echo 'Notebooks:' $USER_NB_DIR
echo 'Lib Path :' $PYTHONPATH
echo 'Local URL: http://localhost:9000'
echo '----------'

# Finally start IPython.
ipython notebook --notebook-dir=$USER_NB_DIR \
  --config=$REPO_DIR/sources/ipython/config.py \
  --ip="*" --port=9000 \
  --pylab=inline --no-mathjax --no-browser --no-script --quiet

