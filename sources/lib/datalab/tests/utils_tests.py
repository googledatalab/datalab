# Copyright 2015 Google Inc. All rights reserved.
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

import datetime as dt
import collections
import mock
import pandas
import unittest

# import Python so we can mock the parts we need to here.
import IPython
IPython.core.magic.register_line_cell_magic = mock.Mock()
IPython.core.magic.register_line_magic = mock.Mock()
IPython.core.magic.register_cell_magic = mock.Mock()
IPython.get_ipython = mock.Mock()

import gcp.datalab

class TestCases(unittest.TestCase):

  def _get_expected_cols(self):
    cols = [
      {'type': 'number', 'id': 'Column1', 'label': 'Column1'},
      {'type': 'number', 'id': 'Column2', 'label': 'Column2'},
      {'type': 'string', 'id': 'Column3', 'label': 'Column3'},
      {'type': 'boolean', 'id': 'Column4', 'label': 'Column4'},
      {'type': 'number', 'id': 'Column5', 'label': 'Column5'},
      {'type': 'datetime', 'id': 'Column6', 'label': 'Column6'}
    ]
    return cols

  def _get_expected_rows(self):
    rows = [
      {'c': [
        {'v': 1}, {'v': 2}, {'v': '3'}, {'v': True}, {'v': 0.0}, {'v': dt.datetime(2000, 1, 1)}
      ]},
      {'c': [
        {'v': 11}, {'v': 12}, {'v': '13'}, {'v': False}, {'v': 0.2}, {'v': dt.datetime(2000, 1, 2)}
      ]},
      {'c': [
        {'v': 21}, {'v': 22}, {'v': '23'}, {'v': True}, {'v': 0.3}, {'v': dt.datetime(2000, 1, 3)}
      ]},
      {'c': [
        {'v': 31}, {'v': 32}, {'v': '33'}, {'v': False}, {'v': 0.4}, {'v': dt.datetime(2000, 1, 4)}
      ]},
      {'c': [
        {'v': 41}, {'v': 42}, {'v': '43'}, {'v': True}, {'v': 0.5}, {'v': dt.datetime(2000, 1, 5)}
      ]},
      {'c': [
        {'v': 51}, {'v': 52}, {'v': '53'}, {'v': True}, {'v': 0.6}, {'v': dt.datetime(2000, 1, 6)}
      ]}
    ]
    return rows

  def _get_test_data_as_list_of_dicts(self):
    test_data = [
      {'Column1': 1, 'Column2': 2, 'Column3': '3',
       'Column4': True, 'Column5': 0.0, 'Column6': dt.datetime(2000, 1, 1)},
      {'Column1': 11, 'Column2': 12, 'Column3': '13',
       'Column4': False, 'Column5': 0.2, 'Column6': dt.datetime(2000, 1, 2)},
      {'Column1': 21, 'Column2': 22, 'Column3': '23',
       'Column4': True, 'Column5': 0.3, 'Column6': dt.datetime(2000, 1, 3)},
      {'Column1': 31, 'Column2': 32, 'Column3': '33',
       'Column4': False, 'Column5': 0.4, 'Column6': dt.datetime(2000, 1, 4)},
      {'Column1': 41, 'Column2': 42, 'Column3': '43',
       'Column4': True, 'Column5': 0.5, 'Column6': dt.datetime(2000, 1, 5)},
      {'Column1': 51, 'Column2': 52, 'Column3': '53',
       'Column4': True, 'Column5': 0.6, 'Column6': dt.datetime(2000, 1, 6)}
    ]
    # Use OrderedDicts to make testing the result easier.
    for i in range(0, len(test_data)):
      test_data[i] = collections.OrderedDict(sorted(test_data[i].items(), key=lambda t: t[0]))

    return test_data

  def test_get_data_from_list_of_dicts(self):
    self._test_get_data(self._get_test_data_as_list_of_dicts(),
         self._get_expected_cols(), self._get_expected_rows(),
         gcp.datalab._utils._get_data_from_list_of_dicts)
    self._test_get_data(self._get_test_data_as_list_of_dicts(),
         self._get_expected_cols(), self._get_expected_rows(),
         gcp.datalab._utils.get_data)

  def test_get_data_from_list_of_lists(self):
    test_data = [
      [1, 2, '3', True, 0.0, dt.datetime(2000, 1, 1)],
      [11, 12, '13', False, 0.2, dt.datetime(2000, 1, 2)],
      [21, 22, '23', True, 0.3, dt.datetime(2000, 1, 3)],
      [31, 32, '33', False, 0.4, dt.datetime(2000, 1, 4)],
      [41, 42, '43', True, 0.5, dt.datetime(2000, 1, 5)],
      [51, 52, '53', True, 0.6, dt.datetime(2000, 1, 6)],
    ]

    self._test_get_data(test_data, self._get_expected_cols(), self._get_expected_rows(),
         gcp.datalab._utils._get_data_from_list_of_lists)
    self._test_get_data(test_data, self._get_expected_cols(), self._get_expected_rows(),
         gcp.datalab._utils.get_data)

  def test_get_data_from_dataframe(self):
    df = pandas.DataFrame(self._get_test_data_as_list_of_dicts())
    self._test_get_data(df, self._get_expected_cols(), self._get_expected_rows(),
         gcp.datalab._utils._get_data_from_dataframe)
    self._test_get_data(df, self._get_expected_cols(), self._get_expected_rows(),
         gcp.datalab._utils.get_data)

  def test_get_data_from_table(self):
    # TODO(gram): Figure out a reasonable way to test _get_data_from_table.
    pass

  def _test_get_data(self, test_data, cols, rows, fn):
    self.maxDiff = None
    data, count = fn(test_data)
    self.assertEquals(6, count)
    self.assertEquals({'cols': cols, 'rows': rows}, data)

    # Test first_row. Note that count must be set in this case so we use a value greater than the
    # data set size.
    for first in range(0, 6):
      data, count = fn(test_data, first_row=first, count=10)
      self.assertEquals(6, count)
      self.assertEquals({'cols': cols, 'rows': rows[first:]}, data)

    # Test first_row + count
    for first in range(0, 6):
      data, count = fn(test_data, first_row=first, count=2)
      self.assertEquals(6, count)
      self.assertEquals({'cols': cols, 'rows': rows[first:first+2]}, data)

    # Test subsets of columns

    # No columns
    data, count = fn(test_data, fields=[])
    self.assertEquals({'cols': [],
                       'rows': [{'c': []}, {'c': []}, {'c': []}, {'c': []}, {'c': []}, {'c': []}]},
                      data)

    # Single column
    data, count = fn(test_data, fields=['Column3'])
    self.assertEquals({'cols': [cols[2]],
      'rows': [{'c': [row['c'][2] ]} for row in rows]}, data)

    # Multi-columns
    data, count = fn(test_data, fields=['Column1', 'Column3', 'Column6'])
    self.assertEquals({'cols': [cols[0], cols[2], cols[5]],
      'rows': [{'c': [row['c'][0], row['c'][2], row['c'][5] ]} for row in rows]}, data)

    # Switch order
    data, count = fn(test_data, fields=['Column3', 'Column1'])
    self.assertEquals({'cols': [cols[2], cols[0]],
      'rows': [{'c': [row['c'][2], row['c'][0] ]} for row in rows]}, data)

    # Select all
    data, count = fn(test_data,
                     fields=['Column1', 'Column2', 'Column3', 'Column4', 'Column5', 'Column6'])
    self.assertEquals({'cols': cols, 'rows': rows}, data)


