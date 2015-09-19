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

from gcp._util._utils import get_item


class TestCases(unittest.TestCase):

  def _get_data(self):
    m = imp.new_module('baz')
    exec 'x = 99' in m.__dict__
    data = {
      'foo': {
        'bar': {
          'xyz': 0
        },
        'm': m
      }
    }
    return data

  def test_no_entry(self):
    data = self._get_data()
    self.assertIsNone(get_item(data, 'x'))
    self.assertIsNone(get_item(data, 'bar.x'))
    self.assertIsNone(get_item(data, 'foo.bar.x'))
    self.assertIsNone(get_item(globals(), 'datetime.bar.x'))

  def test_entry(self):
    data = self._get_data()
    self.assertEquals(data['foo']['bar']['xyz'], get_item(data, 'foo.bar.xyz'))
    self.assertEquals(data['foo']['bar'], get_item(data, 'foo.bar'))
    self.assertEquals(data['foo'], get_item(data, 'foo'))
    self.assertEquals(data['foo']['m'], get_item(data, 'foo.m'))
    self.assertEquals(99, get_item(data, 'foo.m.x'))
