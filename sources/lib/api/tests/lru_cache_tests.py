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

from gcp._util._lru_cache import LRUCache


class TestCases(unittest.TestCase):

  def test_cache_no_entry(self):
    cache = LRUCache(3)
    with self.assertRaises(KeyError):
      _ = cache['a']

  def test_cache_lookup(self):
    cache = LRUCache(4)
    for x in ['a', 'b', 'c', 'd']:
      cache[x] = x

    for x in ['a', 'b', 'c', 'd']:
      self.assertEqual(x, cache[x])

  def test_cache_overflow(self):
    cache = LRUCache(3)
    for x in ['a', 'b', 'c', 'd']:
      cache[x] = x

    for x in ['b', 'c', 'd']:
      self.assertEqual(x, cache[x])

    with self.assertRaises(KeyError):
      _ = cache['a']

    _ = cache['b']
    _ = cache['d']
    # 'c' should be LRU now
    cache['e'] = 'e'

    with self.assertRaises(KeyError):
      _ = cache['c']

    for x in ['b', 'd', 'e']:
      self.assertEqual(x, cache[x])
