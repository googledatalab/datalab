#!/bin/sh

mkdir -p build
mkdir -p notebooks

cp extern/ijava build/ijava
cp extern/ijavart.jar build/ijavart.jar
cp extern/ijavaext-charting.jar build/ijavaext-charting.jar
cp extern/dataflow-sdk.jar build/dataflow-sdk.jar
cp sdk/build/libs/dataflow-sdk-plus-1.0.jar build/dataflow-sdk-plus.jar
cp shell/build/libs/dataflow-shell-1.0.jar build/ijavaext-dataflow.jar

ipython notebook --config=profile/config.py \
  --notebook-dir=notebooks \
  --ip="*" --port=9999 \
  --matplotlib=inline --no-mathjax --no-script --quiet

