#!/bin/sh

# Script to launch IJava in similar manner to how it would be within a
# container in the cloud.

# Script to launch IPython with notebooks in a specified directory.

if [ "$#" -ne 1 ]; then
    echo "Usage: ijava.sh <notebook_dir>"
    exit
fi

source $(dirname $0)/initenv.sh

echo 'Notebooks:' $1
echo 'Local URL: http://localhost:9001'
echo '----------'

# Finally start IJava
ipython notebook  --notebook-dir=$1 \
  --config=$REPO_DIR/sources/kernels/ijava/kernel/profile/config.py \
  --ip="*" --port=9001 --no-mathjax --no-script --quiet
