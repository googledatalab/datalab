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
from gcp.bigquery._sampling import Sampling


class TestCases(unittest.TestCase):

  BASE_SQL = '[<q>]'

  def test_default(self):
    expected_sql = 'SELECT * FROM (%s) LIMIT 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.default(), expected_sql)

  def test_default_custom_count(self):
    expected_sql = 'SELECT * FROM (%s) LIMIT 20' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.default(count=20), expected_sql)

  def test_default_custom_fields(self):
    expected_sql = 'SELECT f1,f2 FROM (%s) LIMIT 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.default(fields=['f1', 'f2']), expected_sql)

  def test_default_all_fields(self):
    expected_sql = 'SELECT * FROM (%s) LIMIT 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.default(fields=[]), expected_sql)

  def test_hashed(self):
    expected_sql = 'SELECT * FROM (%s) WHERE ABS(HASH(f1)) %% 100 < 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.hashed('f1', 5), expected_sql)

  def test_hashed_and_limited(self):
    expected_sql = 'SELECT * FROM (%s) WHERE ABS(HASH(f1)) %% 100 < 5 LIMIT 100' \
                   % TestCases.BASE_SQL
    self._apply_sampling(Sampling.hashed('f1', 5, count=100), expected_sql)

  def test_hashed_with_fields(self):
    expected_sql = 'SELECT f1 FROM (%s) WHERE ABS(HASH(f1)) %% 100 < 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.hashed('f1', 5, fields=['f1']), expected_sql)

  def test_sorted_ascending(self):
    expected_sql = 'SELECT * FROM (%s) ORDER BY f1 LIMIT 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.sorted('f1'), expected_sql)

  def test_sorted_descending(self):
    expected_sql = 'SELECT * FROM (%s) ORDER BY f1 DESC LIMIT 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.sorted('f1', ascending=False), expected_sql)

  def test_sorted_with_fields(self):
    expected_sql = 'SELECT f1,f2 FROM (%s) ORDER BY f1 LIMIT 5' % TestCases.BASE_SQL
    self._apply_sampling(Sampling.sorted('f1', fields=['f1', 'f2']), expected_sql)

  def _apply_sampling(self, sampling, expected_query):
    sampled_query = sampling(TestCases.BASE_SQL)
    self.assertEqual(sampled_query, expected_query)
