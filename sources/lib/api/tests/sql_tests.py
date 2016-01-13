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
import unittest

from gcp.data import SqlModule, SqlStatement, tokenize


class TestCases(unittest.TestCase):

  def test_sql_tokenizer(self):
    query = "SELECT * FROM function(SELECT * FROM [table])  -- a comment\nWHERE x>0 AND y == 'cat'/*\nmulti-line comment */LIMIT 10"
    tokens = tokenize(query)
    # Make sure we get all the content
    self.assertEquals(''.join(tokens), query)

    # Then check the tokens
    expected = [
      'SELECT',
      ' ',
      '*',
      ' ',
      'FROM',
      ' ',
      'function',
      '(',
      'SELECT',
      ' ',
      '*',
      ' ',
      'FROM',
      ' ',
      '[',
      'table',
      ']',
      ')',
      '  ',
      '-- a comment\n',
      'WHERE',
      ' ',
      'x',
      '>',
      '0',
      ' ',
      'AND',
      ' ',
      'y',
      ' ',
      '=',
      '=',
      ' ',
      '\'cat\'',
      '/*\nmulti-line comment */',
      'LIMIT',
      ' ',
      '10'
    ]
    self.assertEquals(expected, tokens)

  def test_zero_placeholders(self):
    queries = ['SELECT * FROM [logs.today]',
               ' SELECT time FROM [logs.today] ']

    for query in queries:
      formatted_query = SqlStatement.format(query, None)
      self.assertEqual(query, formatted_query)

  def test_single_placeholder(self):
    query = 'SELECT time FROM [logs.today] WHERE status == $param'
    args = {'param': 200}

    formatted_query = SqlStatement.format(query, args)
    self.assertEqual(formatted_query,
                     'SELECT time FROM [logs.today] WHERE status == 200')

  def test_multiple_placeholders(self):
    query = ('SELECT time FROM [logs.today] '
             'WHERE status == $status AND path == $path')
    args = {'status': 200, 'path': '/home'}

    formatted_query = SqlStatement.format(query, args)
    self.assertEqual(formatted_query,
                     ('SELECT time FROM [logs.today] '
                      'WHERE status == 200 AND path == "/home"'))

  def test_escaped_placeholder(self):
    query = 'SELECT time FROM [logs.today] WHERE path == "/foo$$bar"'
    args = {'status': 200}

    formatted_query = SqlStatement.format(query, args)
    self.assertEqual(formatted_query,
                     'SELECT time FROM [logs.today] WHERE path == "/foo$bar"')

  def test_string_escaping(self):
    query = 'SELECT time FROM [logs.today] WHERE path == $path'
    args = {'path': 'xyz"xyz'}

    formatted_query = SqlStatement.format(query, args)
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

    formatted_query = SqlStatement.format(query, args)

    self.assertEqual(formatted_query, expected_query)

  def test_missing_args(self):
    query = 'SELECT time FROM [logs.today] WHERE status == $status'
    args = {'s': 200}

    with self.assertRaises(Exception) as error:
      _ = SqlStatement.format(query, args)

    e = error.exception
    self.assertEqual(e.message, 'Unsatisfied dependency $status')

  def test_invalid_args(self):
    query = 'SELECT time FROM [logs.today] WHERE status == $0'

    with self.assertRaises(Exception) as error:
      _ = SqlStatement.format(query, {})

    e = error.exception
    self.assertEqual(e.message,
        'Invalid sql; $ with no following $ or identifier: ' + query + '.')

  def test_nested_queries(self):
    query1 = SqlStatement('SELECT 3 as x')
    query2 = SqlStatement('SELECT x FROM $query1')
    query3 = 'SELECT * FROM $query2 WHERE x == $count'

    self.assertEquals('SELECT 3 as x', query1.sql)

    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format(query3)[0]
    self.assertEquals('Unsatisfied dependency $query2', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format(query3, {'query1': query1})
    self.assertEquals('Unsatisfied dependency $query2', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format(query3, {'query2': query2})
    self.assertEquals('Unsatisfied dependency $query1', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format(query3, {'query1': query1, 'query2': query2})
    self.assertEquals('Unsatisfied dependency $count', e.exception.message)

    formatted_query =\
        SqlStatement.format(query3, {'query1': query1, 'query2': query2, 'count': 5})
    self.assertEqual('SELECT * FROM (SELECT x FROM (SELECT 3 as x)) WHERE x == 5', formatted_query)

  def test_shared_nested_queries(self):
    query1 = SqlStatement('SELECT 3 as x')
    query2 = SqlStatement('SELECT x FROM $query1')
    query3 = 'SELECT x AS y FROM $query1, x FROM $query2'
    formatted_query = SqlStatement.format(query3, {'query1': query1, 'query2': query2})
    self.assertEqual('SELECT x AS y FROM (SELECT 3 as x), x FROM (SELECT x FROM (SELECT 3 as x))',
                     formatted_query)

  def test_circular_references(self):
    query1 = SqlStatement('SELECT * FROM $query3')
    query2 = SqlStatement('SELECT x FROM $query1')
    query3 = SqlStatement('SELECT * FROM $query2 WHERE x == $count')
    args = {'query1': query1, 'query2': query2, 'query3': query3}

    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format('SELECT * FROM $query1', args)
    self.assertEquals('Circular dependency in $query1', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format('SELECT * FROM $query2', args)
    self.assertEquals('Circular dependency in $query2', e.exception.message)

    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format('SELECT * FROM $query3', args)
    self.assertEquals('Circular dependency in $query3', e.exception.message)

  def test_module_reference(self):
    m = imp.new_module('m')
    m.__dict__['q1'] = SqlStatement('SELECT 3 AS x')
    m.__dict__[SqlModule._SQL_MODULE_LAST] =\
        m.__dict__[SqlModule._SQL_MODULE_LAST] = SqlStatement('SELECT * FROM $q1 LIMIT 10')
    with self.assertRaises(Exception) as e:
      _ = SqlStatement.format('SELECT * FROM $s', {'s': m})
    self.assertEquals('Unsatisfied dependency $q1', e.exception.message)

    formatted_query = SqlStatement.format('SELECT * FROM $s', {'s': m, 'q1': m.q1})
    self.assertEqual('SELECT * FROM (SELECT * FROM (SELECT 3 AS x) LIMIT 10)', formatted_query)

    formatted_query = SqlStatement.format('SELECT * FROM $s', {'s': m.q1})
    self.assertEqual('SELECT * FROM (SELECT 3 AS x)', formatted_query)

  def test_get_sql_statement_with_environment(self):
    # TODO(gram).
    pass

  def test_get_query_from_module(self):
    # TODO(gram).
    pass

  def test_get_sql_args(self):
    # TODO(gram).
    pass
