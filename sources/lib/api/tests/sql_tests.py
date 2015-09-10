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

import imp
import unittest

from gcp.sql import SqlModule
from gcp.sql import SqlStatement as Sql


class TestCases(unittest.TestCase):

  def test_zero_placeholders(self):
    queries = ['SELECT * FROM [logs.today]',
               ' SELECT time FROM [logs.today] ']

    for query in queries:
      formatted_query = Sql.format(query, None)
      self.assertEqual(query, formatted_query)

  def test_single_placeholder(self):
    query = 'SELECT time FROM [logs.today] WHERE status == $param'
    args = {'param': 200}

    formatted_query = Sql.format(query, args)
    self.assertEqual(formatted_query,
                     'SELECT time FROM [logs.today] WHERE status == 200')

  def test_multiple_placeholders(self):
    query = ('SELECT time FROM [logs.today] '
             'WHERE status == $status AND path == $path')
    args = {'status': 200, 'path': '/home'}

    formatted_query = Sql.format(query, args)
    self.assertEqual(formatted_query,
                     ('SELECT time FROM [logs.today] '
                      'WHERE status == 200 AND path == "/home"'))

  def test_escaped_placeholder(self):
    query = 'SELECT time FROM [logs.today] WHERE path == "/foo$$bar"'
    args = {'status': 200}

    formatted_query = Sql.format(query, args)
    self.assertEqual(formatted_query,
                     'SELECT time FROM [logs.today] WHERE path == "/foo$bar"')

  def test_string_escaping(self):
    query = 'SELECT time FROM [logs.today] WHERE path == $path'
    args = {'path': 'xyz"xyz'}

    formatted_query = Sql.format(query, args)
    self.assertEqual(formatted_query,
                     'SELECT time FROM [logs.today] WHERE path == "xyz\\"xyz"')

  def test_all_combinations(self):
    query = ('SELECT time FROM '
             '  (SELECT * FROM [logs.today] '
             '   WHERE path contains "$$" AND path contains $segment '
             '     AND status == $status) '
             'WHERE success == $success AND server == "$$master" '
             'LIMIT $pageSize')
    args = {'status': 200, 'pageSize': 10, 'success': False, 'segment': 'home'}

    expected_query = ('SELECT time FROM '
                      '  (SELECT * FROM [logs.today] '
                      '   WHERE path contains "$" AND path contains "home" '
                      '     AND status == 200) '
                      'WHERE success == False AND server == "$master" '
                      'LIMIT 10')

    formatted_query = Sql.format(query, args)

    self.assertEqual(formatted_query, expected_query)

  def test_missing_args(self):
    query = 'SELECT time FROM [logs.today] WHERE status == $status'
    args = {'s': 200}

    with self.assertRaises(Exception) as error:
      _ = Sql.format(query, args)

    e = error.exception
    self.assertEqual(e.message, 'Unsatisfied dependency $status')

  def test_nested_queries(self):
    query1 = Sql('SELECT 3 as x')
    query2 = Sql('SELECT x FROM $query1')
    query3 = 'SELECT * FROM $query2 WHERE x == $count'

    self.assertEquals('SELECT 3 as x', query1.sql)

    with self.assertRaises(Exception) as e:
      _ = Sql.format(query3)[0]
    self.assertEquals('Unsatisfied dependency $query2', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = Sql.format(query3, {'query1': query1})[0]
    self.assertEquals('Unsatisfied dependency $query2', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = Sql.format(query3, {'query2': query2})[0]
    self.assertEquals('Unsatisfied dependency $query1', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = Sql.format(query3, {'query1': query1, 'query2': query2})
    self.assertEquals('Unsatisfied dependency $count', e.exception.message)

    formatted_query = Sql.format(query3, {'query1': query1, 'query2': query2, 'count': 5})
    self.assertEqual('SELECT * FROM (SELECT x FROM (SELECT 3 as x)) WHERE x == 5', formatted_query)

  def test_shared_nested_queries(self):
    query1 = Sql('SELECT 3 as x')
    query2 = Sql('SELECT x FROM $query1')
    query3 = 'SELECT x AS y FROM $query1, x FROM $query2'
    formatted_query = Sql.format(query3, {'query1': query1, 'query2': query2})
    self.assertEqual('SELECT x AS y FROM (SELECT 3 as x), x FROM (SELECT x FROM (SELECT 3 as x))',
                     formatted_query)

  def test_circular_references(self):
    query1 = Sql('SELECT * FROM $query3')
    query2 = Sql('SELECT x FROM $query1')
    query3 = Sql('SELECT * FROM $query2 WHERE x == $count')
    args = {'query1': query1, 'query2': query2, 'query3': query3}

    with self.assertRaises(Exception) as e:
      _ = Sql.format('SELECT * FROM $query1', args)[0]
    self.assertEquals('Circular dependency in $query1', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = Sql.format('SELECT * FROM $query2', args)[0]
    self.assertEquals('Circular dependency in $query2', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = Sql.format('SELECT * FROM $query3', args)[0]
    self.assertEquals('Circular dependency in $query3', e.exception.message)

  def test_module_reference(self):
    m = imp.new_module('m')
    m.__dict__['q1'] = Sql('SELECT 3 AS x')
    m.__dict__[SqlModule._SQL_MODULE_LAST] =\
        m.__dict__[SqlModule._SQL_MODULE_LAST] = Sql('SELECT * FROM $q1 LIMIT 10')
    with self.assertRaises(Exception) as e:
      _ = Sql.format('SELECT * FROM $s', {'s': m})[0]
    self.assertEquals('Unsatisfied dependency $q1', e.exception.message)

    formatted_query = Sql.format('SELECT * FROM $s', {'s': m, 'q1': m.q1})
    self.assertEqual('SELECT * FROM (SELECT * FROM (SELECT 3 AS x) LIMIT 10)', formatted_query)

    formatted_query = Sql.format('SELECT * FROM $s', {'s': m.q1})
    self.assertEqual('SELECT * FROM (SELECT 3 AS x)', formatted_query)

  def test_split_cell(self):
    m = imp.new_module('m')
    code = SqlModule.split_cell('', m)
    self.assertNotIn(SqlModule._SQL_MODULE_LAST, m.__dict__)
    self.assertNotIn(SqlModule._SQL_MODULE_MAIN, m.__dict__)
    self.assertEquals('', code)

    m = imp.new_module('m')
    code = SqlModule.split_cell('\n\n', m)
    self.assertNotIn(SqlModule._SQL_MODULE_LAST, m.__dict__)
    self.assertNotIn(SqlModule._SQL_MODULE_MAIN, m.__dict__)
    self.assertEquals('', code)

    m = imp.new_module('m')
    code = SqlModule.split_cell('SELECT 3 AS x', m)
    self.assertEquals('SELECT 3 AS x', m.__dict__[SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT 3 AS x', m.__dict__[SqlModule._SQL_MODULE_LAST].sql)
    self.assertEquals('', code)

    m = imp.new_module('m')
    code = SqlModule.split_cell('# This is a comment\n\nSELECT 3 AS x', m)
    self.assertEquals('SELECT 3 AS x', m.__dict__[SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT 3 AS x', m.__dict__[SqlModule._SQL_MODULE_LAST].sql)
    self.assertEquals('# This is a comment\n', code)

    m = imp.new_module('m')
    code = SqlModule.split_cell('# This is a comment\n\nfoo="bar"\nSELECT 3 AS x', m)
    self.assertEquals('SELECT 3 AS x', m.__dict__[SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT 3 AS x', m.__dict__[SqlModule._SQL_MODULE_LAST].sql)
    self.assertEquals('# This is a comment\n\nfoo="bar"\n', code)

    m = imp.new_module('m')
    code = SqlModule.split_cell('DEFINE QUERY q1\nSELECT 3 AS x', m)
    self.assertEquals('SELECT 3 AS x', m.q1.sql)
    self.assertNotIn(SqlModule._SQL_MODULE_MAIN, m.__dict__)
    self.assertEquals('SELECT 3 AS x', m.__dict__[SqlModule._SQL_MODULE_LAST].sql)
    self.assertEquals('', code)

    m = imp.new_module('m')
    code = SqlModule.split_cell('DEFINE QUERY q1\nSELECT 3 AS x\nSELECT * FROM $q1', m)
    self.assertEquals('SELECT 3 AS x', m.q1.sql)
    self.assertEquals('SELECT * FROM $q1', m.__dict__[SqlModule._SQL_MODULE_MAIN].sql)
    self.assertEquals('SELECT * FROM $q1', m.__dict__[SqlModule._SQL_MODULE_LAST].sql)
    self.assertEquals('', code)

  def test_get_sql_statement_with_environment(self):
    # TODO(gram).
    pass

  def test_get_query_from_module(self):
    # TODO(gram).
    pass

  def test_get_sql_args(self):
    # TODO(gram).
    pass
