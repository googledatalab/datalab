#!/bin/sh

mkdir -p build
mkdir -p notebooks

cp extern/ijava build/ijava
cp extern/ijavart.jar build/ijavart.jar
cp extern/joda-time.jar build/joda-time.jar
cp sdk/build/libs/dataflow-sdk-1.0.jar build/dataflow-sdk.jar
cp shell/build/libs/ijavaext-cloud-1.0.jar build/ijavaext-cloud.jar

ipython notebook --config=profile/config.py \
  --notebook-dir=notebooks \
  --ip="*" --port=9999 \
  --matplotlib=inline --no-mathjax --no-script --quiet

