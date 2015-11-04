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

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import bq_api_tests
import bq_dataset_tests
import bq_federated_table_tests
import bq_jobs_tests
import bq_parser_tests
import bq_query_tests
import bq_sampling_tests
import bq_schema_tests
import bq_table_tests
import bq_udf_tests
import bq_view_tests
import cs_api_tests
import cs_bucket_tests
import cs_item_tests
import http_tests
import lru_cache_tests
import metadataservice_tests
import sql_tests
import util_tests

_TEST_MODULES = [
  bq_api_tests,
  bq_dataset_tests,
  bq_federated_table_tests,
  bq_jobs_tests,
  bq_parser_tests,
  bq_query_tests,
  bq_sampling_tests,
  bq_schema_tests,
  bq_table_tests,
  bq_udf_tests,
  bq_view_tests,
  bq_sampling_tests,
  cs_api_tests,
  cs_bucket_tests,
  cs_item_tests,
  http_tests,
  lru_cache_tests,
  metadataservice_tests,
  sql_tests,
  util_tests
]

if __name__ == '__main__':
  suite = unittest.TestSuite()
  for m in _TEST_MODULES:
    suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(m))

  runner = unittest.TextTestRunner()
  result = runner.run(suite)

  sys.exit(result.errors)
