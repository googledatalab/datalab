#!/bin/sh
# Copyright 2014 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

BUILD_DIR=$REPO_DIR/build/ipython
mkdir -p $BUILD_DIR

cp profile/config.py $BUILD_DIR/config.py
cp -R profile/static $BUILD_DIR

PYLIB_DIR=$REPO_DIR/build/python
mkdir -p $PYLIB_DIR

python setup.py sdist --dist-dir=$PYLIB_DIR
mv MANIFEST $PYLIB_DIR/IPythonGCP.manifest

cd $REPO_DIR/build
tar cvfz ipython.tar.gz ipython
