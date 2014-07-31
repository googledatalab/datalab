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

import os
import sys
import unittest

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Test modules need to be loaded after the path has been modified to
# include the sources to be tested on the python path.
# pylint: disable=g-import-not-at-top
import bq_query_tests
import bq_table_tests
import http_tests
import metadataservice_tests
import sql_tests

_TEST_MODULES = [metadataservice_tests,
                 http_tests,
                 sql_tests,
                 bq_query_tests,
                 bq_table_tests
                ]

if __name__ == '__main__':
  suite = unittest.TestSuite()
  for m in _TEST_MODULES:
    suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(m))

  runner = unittest.TextTestRunner()
  result = runner.run(suite)

  sys.exit(result.errors)
