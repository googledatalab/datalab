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

import unittest
import gcp
import gcp.bigquery
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  def test_sql_building(self):
    context = self._create_context()
    table = gcp.bigquery.Table('test:requestlogs.today', context=context)

    udf = self._create_udf()
    query = gcp.bigquery.Query('SELECT * FROM foo($t)', t=table, udfs=[udf], context=context)

    expected_js = '\nfoo=function(r,emit) { emit({output1: r.field2, output2: r.field1 }); };\n' +\
                  'bigquery.defineFunction(\'foo\', ["field1", "field2"], ' +\
                  '[{"name": "output1", "type": "integer"}, ' +\
                  '{"name": "output2", "type": "string"}], foo);'
    self.assertEqual(query.sql, 'SELECT * FROM (SELECT output1, output2 FROM foo([test:requestlogs.today]))')
    self.assertEqual(udf._code, expected_js)

  def _create_udf(self):
    inputs = [('field1', 'string'), ('field2', 'integer')]
    outputs = [('output1', 'integer'), ('output2', 'string')]
    impl = 'function(r,emit) { emit({output1: r.field2, output2: r.field1 }); }'
    udf = gcp.bigquery.UDF(inputs, outputs, 'foo', impl)
    return udf

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
