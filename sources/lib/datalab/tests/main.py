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

# Set up the path so that we can import our datalab.* packages.
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../datalab')))

import bigquery.api_tests
import bigquery.dataset_tests
import bigquery.federated_table_tests
import bigquery.jobs_tests
import bigquery.parser_tests
import bigquery.query_tests
import bigquery.sampling_tests
import bigquery.schema_tests
import bigquery.table_tests
import bigquery.udf_tests
import bigquery.view_tests
import data.sql_tests
import kernel.bigquery_tests
import kernel.chart_data_tests
import kernel.chart_tests
import kernel.commands_tests
import kernel.html_tests
import kernel.module_tests
import kernel.sql_tests
import kernel.storage_tests
import kernel.utils_tests
import storage.api_tests
import storage.bucket_tests
import storage.item_tests
import _util.http_tests
import _util.lru_cache_tests
import _util.util_tests


_TEST_MODULES = [
    bigquery.api_tests,
    bigquery.dataset_tests,
    bigquery.federated_table_tests,
    bigquery.jobs_tests,
    bigquery.parser_tests,
    bigquery.query_tests,
    bigquery.sampling_tests,
    bigquery.schema_tests,
    bigquery.table_tests,
    bigquery.udf_tests,
    bigquery.view_tests,
    bigquery.sampling_tests,
    data.sql_tests,
    kernel.bigquery_tests,
    kernel.chart_data_tests,
    kernel.chart_tests,
    kernel.commands_tests,
    kernel.html_tests,
    kernel.module_tests,
    kernel.sql_tests,
    kernel.storage_tests,
    kernel.utils_tests,
    storage.api_tests,
    storage.bucket_tests,
    storage.item_tests,
    _util.http_tests,
    _util.lru_cache_tests,
    _util.util_tests
]

if __name__ == '__main__':
  suite = unittest.TestSuite()
  for m in _TEST_MODULES:
    suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(m))

  runner = unittest.TextTestRunner()
  result = runner.run(suite)

  sys.exit(result.errors)
