#!/bin/sh

ipython notebook --no-browser --no-mathjax --matplotlib inline \
  --ip="127.0.0.1" --port 8081 \
  --config=/ipython/config.py > /dev/null 2> /dev/null &

sleep 5

cd /ipython/proxy
node app.js

