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

import datetime as dt
import unittest
import gcp.bigquery
import mock
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  def test_parse_full_name(self):
    table = self._create_table('data-studio-team:requestlogs.today')
    parsed_name = table._name_parts

    self.assertEqual(parsed_name[0], 'data-studio-team')
    self.assertEqual(parsed_name[1], 'requestlogs')
    self.assertEqual(parsed_name[2], 'today')

    self.assertEqual(table._repr_sql_(), '[data-studio-team:requestlogs.today]')

  def test_parse_local_name(self):
    table = self._create_table('requestlogs.today')
    parsed_name = table._name_parts

    self.assertEqual(parsed_name[0], 'test')
    self.assertEqual(parsed_name[1], 'requestlogs')
    self.assertEqual(parsed_name[2], 'today')

    self.assertEqual(table._repr_sql_(), '[test:requestlogs.today]')

  def test_parse_invalid_name(self):
    with self.assertRaises(Exception):
      _ = self._create_table('today')

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_metadata(self, mock_api_tables):
    name = 'data-studio-team:requestlogs.today'
    ts = dt.datetime.utcnow()

    mock_api_tables.return_value = self._create_table_info_result(ts=ts)
    t = self._create_table(name)

    metadata = t.metadata()

    self.assertEqual(metadata.full_name, name)
    self.assertEqual(metadata.friendly_name, 'Logs')
    self.assertEqual(metadata.rows, 2)
    self.assertEqual(metadata.rows, 2)
    self.assertEqual(metadata.created_on, ts)
    self.assertEqual(metadata.expires_on, None)

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_schema(self, mock_api_tables):
    mock_api_tables.return_value = self._create_table_info_result()

    t = self._create_table('data-studio-team:requestlogs.today')
    schema = t.schema()

    self.assertEqual(len(schema), 2)
    self.assertEqual(schema[0]['name'], 'name')

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_malformed_response_raises_exception(self, mock_api_tables_get):
    mock_api_tables_get.return_value = {}

    t = self._create_table('data-studio-team:requestlogs.today')

    with self.assertRaises(Exception) as error:
      _ = t.schema()
    self.assertEqual(error.exception[0], 'Unexpected table response.')

  def _create_table(self, name):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    context = gcp.Context(project_id, creds)

    return gcp.bigquery.table(name, context)

  def _create_table_info_result(self, ts=None):
    if ts is None:
      ts = dt.datetime.utcnow()
    epoch = dt.datetime.utcfromtimestamp(0)
    timestamp = (ts - epoch).total_seconds() * 1000

    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'description': 'Daily Logs Table',
      'friendlyName': 'Logs',
      'numBytes': 1000,
      'numRows': 2,
      'creationTime': timestamp,
      'lastModifiedTime': timestamp,
      'schema': {
        'fields': [
          {'name': 'name', 'type': 'STRING', 'mode': 'NULLABLE'},
          {'value': 'val', 'type': 'INTEGER', 'mode': 'NULLABLE'}
        ]
       }
    }
