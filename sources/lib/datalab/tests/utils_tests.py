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

import datetime as dt
import collections
import mock
from oauth2client.client import AccessTokenCredentials
import pandas
import unittest

# import Python so we can mock the parts we need to here.
import IPython
import IPython.core


IPython.core.magic.register_line_cell_magic = mock.Mock()
IPython.core.magic.register_line_magic = mock.Mock()
IPython.core.magic.register_cell_magic = mock.Mock()
IPython.get_ipython = mock.Mock()

import gcp.bigquery
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

  def _timestamp(self, d):
    return (d - dt.datetime(1970, 1, 1)).total_seconds()

  def _get_raw_rows(self):
    rows = [
      {'f': [
        {'v': 1}, {'v': 2}, {'v': '3'}, {'v': 'true'}, {'v': 0.0},
        {'v': self._timestamp(dt.datetime(2000, 1, 1))}
      ]},
      {'f': [
        {'v': 11}, {'v': 12}, {'v': '13'}, {'v': 'false'}, {'v': 0.2},
        {'v': self._timestamp(dt.datetime(2000, 1, 2))}
      ]},
      {'f': [
        {'v': 21}, {'v': 22}, {'v': '23'}, {'v': 'true'}, {'v': 0.3},
        {'v': self._timestamp(dt.datetime(2000, 1, 3))}
      ]},
      {'f': [
        {'v': 31}, {'v': 32}, {'v': '33'}, {'v': 'false'}, {'v': 0.4},
        {'v': self._timestamp(dt.datetime(2000, 1, 4))}
      ]},
      {'f': [
        {'v': 41}, {'v': 42}, {'v': '43'}, {'v': 'true'}, {'v': 0.5},
        {'v': self._timestamp(dt.datetime(2000, 1, 5))}
      ]},
      {'f': [
        {'v': 51}, {'v': 52}, {'v': '53'}, {'v': 'true'}, {'v': 0.6},
        {'v': self._timestamp(dt.datetime(2000, 1, 6))}
      ]}
    ]
    return rows

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
         self._get_expected_cols(), self._get_expected_rows(), 6,
         gcp.datalab._utils._get_data_from_list_of_dicts)
    self._test_get_data(self._get_test_data_as_list_of_dicts(),
         self._get_expected_cols(), self._get_expected_rows(), 6,
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

    self._test_get_data(test_data, self._get_expected_cols(), self._get_expected_rows(), 6,
         gcp.datalab._utils._get_data_from_list_of_lists)
    self._test_get_data(test_data, self._get_expected_cols(), self._get_expected_rows(), 6,
         gcp.datalab._utils.get_data)

  def test_get_data_from_dataframe(self):
    df = pandas.DataFrame(self._get_test_data_as_list_of_dicts())
    self._test_get_data(df, self._get_expected_cols(), self._get_expected_rows(), 6,
         gcp.datalab._utils._get_data_from_dataframe)
    self._test_get_data(df, self._get_expected_cols(), self._get_expected_rows(), 6,
         gcp.datalab._utils.get_data)

  @mock.patch('gcp.bigquery._api.Api.tabledata_list')
  @mock.patch('gcp.bigquery._table.Table.exists')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp._context.Context.default')
  def test_get_data_from_table(self, mock_context_default, mock_api_tables_get,
                               mock_table_exists, mock_api_tabledata_list):
    data = self._get_expected_rows()
    mock_context_default.return_value = self._create_context()
    mock_api_tables_get.return_value = {
      'numRows': len(data),
      'schema': {
        'fields': [
          {'name': 'Column1', 'type': 'INTEGER'},
          {'name': 'Column2', 'type': 'INTEGER'},
          {'name': 'Column3', 'type': 'STRING'},
          {'name': 'Column4', 'type': 'BOOLEAN'},
          {'name': 'Column5', 'type': 'FLOAT'},
          {'name': 'Column6', 'type': 'TIMESTAMP'}
        ]
      }
    }
    mock_table_exists.return_value = True
    raw_data = self._get_raw_rows()

    def tabledata_list(*args, **kwargs):
      start_index = kwargs['start_index']
      max_results = kwargs['max_results']
      if max_results < 0:
        max_results = len(data)
      return {'rows': raw_data[start_index:start_index + max_results]}

    mock_api_tabledata_list.side_effect = tabledata_list
    t = gcp.bigquery.Table('foo.bar')
    self._test_get_data(t, self._get_expected_cols(), self._get_expected_rows(), 6,
                        gcp.datalab._utils._get_data_from_table)
    self._test_get_data(t, self._get_expected_cols(), self._get_expected_rows(), 6,
                        gcp.datalab._utils.get_data)

  def test_get_data_from_empty_list(self):
    self._test_get_data([], [], [], 0, gcp.datalab._utils.get_data)

  def test_get_data_from_malformed_list(self):
    with self.assertRaises(Exception) as error:
      self._test_get_data(['foo', 'bar'], [], [], 0, gcp.datalab._utils.get_data)
    self.assertEquals('To get tabular data from a list it must contain dictionaries or lists.',
                      error.exception.message)

  def _test_get_data(self, test_data, cols, rows, expected_count, fn):
    self.maxDiff = None
    data, count = fn(test_data)
    self.assertEquals(expected_count, count)
    self.assertEquals({'cols': cols, 'rows': rows}, data)

    # Test first_row. Note that count must be set in this case so we use a value greater than the
    # data set size.
    for first in range(0, 6):
      data, count = fn(test_data, first_row=first, count=10)
      self.assertEquals(expected_count, count)
      self.assertEquals({'cols': cols, 'rows': rows[first:]}, data)

    # Test first_row + count
    for first in range(0, 6):
      data, count = fn(test_data, first_row=first, count=2)
      self.assertEquals(expected_count, count)
      self.assertEquals({'cols': cols, 'rows': rows[first:first + 2]}, data)

    # Test subsets of columns

    # No columns
    data, count = fn(test_data, fields=[])
    self.assertEquals({'cols': [], 'rows': [{'c': []}] * expected_count}, data)

    # Single column
    data, count = fn(test_data, fields=['Column3'])

    if expected_count == 0:
      return

    self.assertEquals({'cols': [cols[2]],
      'rows': [{'c': [row['c'][2]]} for row in rows]}, data)

    # Multi-columns
    data, count = fn(test_data, fields=['Column1', 'Column3', 'Column6'])
    self.assertEquals({'cols': [cols[0], cols[2], cols[5]],
      'rows': [{'c': [row['c'][0], row['c'][2], row['c'][5]]} for row in rows]}, data)

    # Switch order
    data, count = fn(test_data, fields=['Column3', 'Column1'])
    self.assertEquals({'cols': [cols[2], cols[0]],
      'rows': [{'c': [row['c'][2], row['c'][0]]} for row in rows]}, data)

    # Select all
    data, count = fn(test_data,
                     fields=['Column1', 'Column2', 'Column3', 'Column4', 'Column5', 'Column6'])
    self.assertEquals({'cols': cols, 'rows': rows}, data)

  def _create_api(self):
    context = self._create_context()
    return gcp.bigquery._api.Api(context.credentials, context.project_id)

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
