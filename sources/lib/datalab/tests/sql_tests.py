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

import imp
import mock
from oauth2client.client import AccessTokenCredentials
import unittest

# import Python so we can mock the parts we need to here.
import IPython
import IPython.core


def noop_decorator(func):
  return func

IPython.core.magic.register_line_cell_magic = noop_decorator
IPython.core.magic.register_line_magic = noop_decorator
IPython.core.magic.register_cell_magic = noop_decorator
IPython.get_ipython = mock.Mock()

import gcp
import gcp.data
import gcp.datalab


class TestCases(unittest.TestCase):

  def test_split_cell(self):
    # TODO(gram): add tests for argument parser.
    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell('', m)
    self.assertIsNone(query)
    self.assertNotIn(gcp.data.SqlModule._SQL_MODULE_LAST, m.__dict__)
    self.assertNotIn(gcp.data.SqlModule._SQL_MODULE_MAIN, m.__dict__)

    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell('\n\n', m)
    self.assertIsNone(query)
    self.assertNotIn(gcp.data.SqlModule._SQL_MODULE_LAST, m.__dict__)
    self.assertNotIn(gcp.data.SqlModule._SQL_MODULE_MAIN, m.__dict__)

    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell('SELECT 3 AS x', m)
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN])
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST])
    self.assertEquals('SELECT 3 AS x', m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT 3 AS x', m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST].sql)

    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell('# This is a comment\n\nSELECT 3 AS x', m)
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN])
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST])
    self.assertEquals('SELECT 3 AS x', m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT 3 AS x', m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST].sql)

    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell('# This is a comment\n\nfoo="bar"\nSELECT 3 AS x', m)
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN])
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST])
    self.assertEquals('SELECT 3 AS x', m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT 3 AS x', m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST].sql)

    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell('DEFINE QUERY q1\nSELECT 3 AS x', m)
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST])
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST])
    self.assertEquals('SELECT 3 AS x', m.q1.sql)
    self.assertNotIn(gcp.data.SqlModule._SQL_MODULE_MAIN, m.__dict__)
    self.assertEquals('SELECT 3 AS x', m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST].sql)

    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell('DEFINE QUERY q1\nSELECT 3 AS x\nSELECT * FROM $q1', m)
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN])
    self.assertEquals(query, m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST])
    self.assertEquals('SELECT 3 AS x', m.q1.sql)
    self.assertEquals('SELECT * FROM $q1', m.__dict__[gcp.data.SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT * FROM $q1', m.__dict__[gcp.data.SqlModule._SQL_MODULE_LAST].sql)

  @mock.patch('gcp._context.Context.default')
  def test_arguments(self, mock_default_context):
    mock_default_context.return_value = self._create_context()
    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell("""
words = ('thus', 'forsooth')
limit = 10

SELECT * FROM [publicdata:samples.shakespeare]
WHERE word IN $words
LIMIT $limit
""", m)
    sql = gcp.bigquery.Query(query, values={}).sql
    self.assertEquals('SELECT * FROM [publicdata:samples.shakespeare]\n' +
                      'WHERE word IN ("thus", "forsooth")\nLIMIT 10', sql)
    # As above but with overrides, using list
    sql = gcp.bigquery.Query(query, words=['eyeball'], limit=5).sql
    self.assertEquals('SELECT * FROM [publicdata:samples.shakespeare]\n' +
                      'WHERE word IN ("eyeball")\nLIMIT 5', sql)
    # As above but with overrides, using tuple and values dict
    sql = gcp.bigquery.Query(query, values={'limit': 3, 'words': ('thus',)}).sql
    self.assertEquals('SELECT * FROM [publicdata:samples.shakespeare]\n' +
                      'WHERE word IN ("thus")\nLIMIT 3', sql)
    # As above but with list argument
    m = imp.new_module('m')
    query = gcp.datalab._sql._split_cell("""
words = ['thus', 'forsooth']
limit = 10

SELECT * FROM [publicdata:samples.shakespeare]
WHERE word IN $words
LIMIT $limit
""", m)
    sql = gcp.bigquery.Query(query, values={}).sql
    self.assertEquals('SELECT * FROM [publicdata:samples.shakespeare]\n' +
                      'WHERE word IN ("thus", "forsooth")\nLIMIT 10', sql)
    # As above but with overrides, using list
    sql = gcp.bigquery.Query(query, values={'limit': 2, 'words': ['forsooth']}).sql
    self.assertEquals('SELECT * FROM [publicdata:samples.shakespeare]\n' +
                      'WHERE word IN ("forsooth")\nLIMIT 2', sql)
    # As above but with overrides, using tuple
    sql = gcp.bigquery.Query(query, words=('eyeball',)).sql
    self.assertEquals('SELECT * FROM [publicdata:samples.shakespeare]\n' +
                      'WHERE word IN ("eyeball")\nLIMIT 10', sql)
    # TODO(gram): add some tests for source and datestring variables

  def test_date(self):
    # TODO(gram): complete this test
    pass

  def test_sql_cell(self):
    # TODO(gram): complete this test
    pass

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
