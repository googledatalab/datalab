#!/bin/bash
# Copyright 2015 Google Inc. All rights reserved.
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

# Lints the Google Cloud Platform API python library.

if [ -z "$REPO_DIR" ];
  then echo "REPO_DIR is not set. Please run source tools/initenv.sh first";
  exit 1;
fi

#LINTER="pylint"

# Ignore 4 character indents (E111 and E114), and unused imports (F401).
# The latter is for our __init__ files.
LINTER="flake8 --ignore=E111,E114,F401 --max-line-length=100"

$LINTER gcp/_util
$LINTER gcp/bigquery
$LINTER gcp/data
$LINTER gcp/storage

