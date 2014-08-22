# Use pre-built base image
FROM ipython:latest

MAINTAINER datastudio-team

# Dev sources
ADD sources/sdk/pygcp /sources/sdk/pygcp
ADD sources/ipython /sources/ipython

ENV PYTHONPATH /sources/sdk/pygcp:/sources/ipython
ENV IPYTHON_ENV cloud

CMD ipython notebook --ip="0.0.0.0" --port 8080 --config=/sources/ipython/config.py \
  --no-script --no-browser --no-mathjax --matplotlib inline 

