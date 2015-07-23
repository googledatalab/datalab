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

import unittest

from gcp._util._sql_statement import SqlStatement as Sql


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
    self.assertEqual(e.args[1], 'status')
