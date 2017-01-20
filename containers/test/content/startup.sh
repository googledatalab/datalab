#!/bin/bash -e

/datalab/run.sh &
Xvfb :10 -ac &

cd /datalab/test
python test.py
