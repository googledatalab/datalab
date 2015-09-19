# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied. See the License for the specific language governing permissions and limitations under
# the License.

import os
import sys
import unittest

# Set up the path so that we can import our gcp.* packages.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../api')))

import bigquery_tests
import chart_tests
import commands_tests
import html_tests
import module_tests
import sql_tests
import storage_tests
import utils_tests

_TEST_MODULES = [
    bigquery_tests,
    chart_tests,
    commands_tests,
    html_tests,
    module_tests,
    sql_tests,
    storage_tests,
    utils_tests
]

if __name__ == '__main__':
  suite = unittest.TestSuite()
  for m in _TEST_MODULES:
    suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(m))

  runner = unittest.TextTestRunner()
  result = runner.run(suite)

  sys.exit(result.errors)
