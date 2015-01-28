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
import gcp
import gcp.bigquery
import mock
import numpy as np
from oauth2client.client import AccessTokenCredentials
import pandas

class TestCases(unittest.TestCase):

  def test_parse_full_name(self):
    table = self._create_table('test:requestlogs.today')
    parsed_name = table._name_parts

    self.assertEqual(parsed_name[0], 'test')
    self.assertEqual(parsed_name[1], 'requestlogs')
    self.assertEqual(parsed_name[2], 'today')

    self.assertEqual(table._repr_sql_(), '[test:requestlogs.today]')

  def test_parse_local_name(self):
    table = self._create_table('requestlogs.today')
    parsed_name = table._name_parts

    self.assertEqual(parsed_name[0], 'test')
    self.assertEqual(parsed_name[1], 'requestlogs')
    self.assertEqual(parsed_name[2], 'today')

    self.assertEqual(table._repr_sql_(), '[test:requestlogs.today]')

  def test_parse_invalid_name(self):
    with self.assertRaises(Exception):
      _ = self._create_table('today@')

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_metadata(self, mock_api_tables):
    name = 'test:requestlogs.today'
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

    t = self._create_table('test:requestlogs.today')
    schema = t.schema()

    self.assertEqual(len(schema), 2)
    self.assertEqual(schema[0].name, 'name')

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_schema_nested(self, mock_api_tables):
    mock_api_tables.return_value = self._create_table_info_nested_schema_result()

    t = self._create_table('test:requestlogs.today')
    schema = t.schema()

    self.assertEqual(len(schema), 4)
    self.assertEqual(schema[0].name, 'name')
    self.assertEqual(schema[1].name, 'val')
    self.assertEqual(schema[2].name, 'more')
    self.assertEqual(schema[3].name, 'more.xyz')

    self.assertIsNone(schema['value'])
    self.assertIsNotNone(schema['val'])

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_malformed_response_raises_exception(self, mock_api_tables_get):
    mock_api_tables_get.return_value = {}

    t = self._create_table('test:requestlogs.today')

    with self.assertRaises(Exception) as error:
      _ = t.schema()
    self.assertEqual(error.exception[0], 'Unexpected table response.')

  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_table_list(self, mock_api_datasets_get, mock_api_tables_list):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = self._create_table_list_result()

    ds = gcp.bigquery.dataset('testds', context=self._create_context())

    tables = []
    for table in ds:
      tables.append(table)
    self.assertEqual(len(tables), 2)
    self.assertEqual(tables[0].name, 'test:testds.testTable1')
    self.assertEqual(tables[1].name, 'test:testds.testTable2')

  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_table_list_empty(self, mock_api_datasets_get, mock_api_tables_list):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = self._create_table_list_empty_result()

    ds = gcp.bigquery.dataset('testds', context=self._create_context())

    tables = []
    for table in ds:
      tables.append(table)

    self.assertEqual(len(tables), 0)

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_exists(self, mock_api_tables_get):
    mock_api_tables_get.return_value = None
    tbl = gcp.bigquery.table('testds.testTable0', context=self._create_context())
    self.assertTrue(tbl.exists())

    mock_api_tables_get.side_effect = Exception([None, 404])
    self.assertFalse(tbl.exists())

  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_tables_create(self,
                         mock_api_datasets_get,
                         mock_api_tables_list,
                         mock_api_tables_insert):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = []
    schema = self._create_inferred_schema()

    mock_api_tables_insert.return_value = None
    with self.assertRaises(Exception) as error:
      _ = self._create_table_for_dataframe(schema)
    self.assertEqual(error.exception[0],
                     'Table test:testds.testTable0 could not be created as it already exists')

    mock_api_tables_insert.return_value = 'http://foo'
    self.assertIsNotNone(self._create_table_for_dataframe(schema), 'Expected a table')

  @mock.patch('gcp.bigquery._Api.tables_list')
  def test_tables_schema_from_dataframe(self, mock_api_tables_list):
    mock_api_tables_list.return_value = []
    df = self._create_data_frame()
    result = gcp.bigquery.schema(df)
    self.assertEqual(result, gcp.bigquery.schema(self._create_inferred_schema()))

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tables_insertAll')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_insertAll_no_table(self,
                              mock_api_datasets_get,
                              mock_api_tables_insertAll,
                              mock_api_tables_get,
                              mock_api_tables_insert,
                              mock_api_tables_list,
                              mock_time_sleep,
                              mock_uuid):
    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = 'http://foo'
    mock_api_tables_get.side_effect = Exception([None, 404])
    mock_api_tables_insertAll.return_value = {}
    mock_api_datasets_get.return_value = None


    table = self._create_table_for_dataframe(self._create_inferred_schema())
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insertAll(df, chunk_size=2)
    self.assertEqual(error.exception[0], 'Table %s does not exist.' % table.full_name)

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tables_insertAll')
  def test_insertAll_missing_field(self,
                                   mock_api_tables_insertAll,
                                   mock_api_tables_get,
                                   mock_api_tables_insert,
                                   mock_api_tables_list,
                                   mock_api_datasets_get,
                                   mock_time_sleep,
                                   mock_uuid,):
    # Truncate the schema used when creating the table so we have an unmatched column in insert.
    schema = self._create_inferred_schema()[:2]

    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_datasets_get.return_value = None
    mock_api_tables_insert.return_value = 'http://foo'
    mock_api_tables_list.return_value = []
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tables_insertAll.return_value = {}

    table = self._create_table_for_dataframe(schema)
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insertAll(df, chunk_size=2)
    self.assertEqual(error.exception[0], 'Table does not contain field headers')

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tables_insertAll')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_insertAll_mismatched_schema(self,
                                       mock_api_datasets_get,
                                       mock_api_tables_insertAll,
                                       mock_api_tables_get,
                                       mock_api_tables_insert,
                                       mock_api_tables_list,
                                       mock_time_sleep,
                                       mock_uuid):
    # Change the schema used when creating the table so we get a mismatch when inserting.
    schema = self._create_inferred_schema()
    schema[2]['type'] = 'STRING'

    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = 'http://foo'
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tables_insertAll.return_value = {}
    mock_api_datasets_get.return_value = None

    table = self._create_table_for_dataframe(schema)
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insertAll(df, chunk_size=2)
    self.assertEqual(error.exception[0], 'Field headers in data has type FLOAT but in table has type STRING')

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tables_insertAll')
  def test_insertAll(self,
                     mock_api_tables_insertAll,
                     mock_api_tables_get,
                     mock_api_tables_insert,
                     mock_api_tables_list,
                     mock_api_datasets_get,
                     mock_time_sleep, mock_uuid):
    schema = self._create_inferred_schema()

    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_datasets_get.return_value = True
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = 'http://foo'
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tables_insertAll.return_value = {}

    table = self._create_table_for_dataframe(schema)
    df = self._create_data_frame()

    result = table.insertAll(df, chunk_size=2)
    self.assertIsNotNone(result, "insertAll should return the table object")
    # Because of chunking there will be two calls for the four rows; we test the second.
    mock_api_tables_insertAll.assert_called_with('testds', 'testTable0', [
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3}}
    ])

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)

  def _create_table(self, name):
    return gcp.bigquery.table(name, self._create_context())

  def _create_table_info_result(self, ts=None):
    if ts is None:
      ts = dt.datetime.utcnow()
    epoch = dt.datetime.utcfromtimestamp(0)
    timestamp = (ts - epoch).total_seconds() * 1000

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
          {'name': 'val', 'type': 'INTEGER', 'mode': 'NULLABLE'}
        ]
       }
    }

  def _create_table_info_nested_schema_result(self, ts=None):
    if ts is None:
      ts = dt.datetime.utcnow()
    epoch = dt.datetime.utcfromtimestamp(0)
    timestamp = (ts - epoch).total_seconds() * 1000

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
          {'name': 'val', 'type': 'INTEGER', 'mode': 'NULLABLE'},
          {'name': 'more', 'type': 'RECORD', 'mode': 'REPEATED',
           'fields': [
              {'name': 'xyz', 'type': 'INTEGER','mode': 'NULLABLE'}
            ]
           }
        ]
      }
    }

  def _create_dataset(self, dataset_id):
    return gcp.bigquery.dataset(dataset_id, self._create_context())

  def _create_table_list_result(self):
    return {
      'tables': [
        {'tableReference': {'projectId': 'test', 'datasetId': 'testds', 'tableId': 'testTable1'}},
        {'tableReference': {'projectId': 'test', 'datasetId': 'testds', 'tableId': 'testTable2'}}
       ]
    }

  def _create_table_list_empty_result(self):
    return {
      'tables': []
    }

  def _create_data_frame(self):
    columns = ['some', 'column', 'headers']
    df = pandas.DataFrame(columns=columns)

    for i in range(0, 4):
      df.loc[i] = [len(df), 'r' + str(len(df)), 10.0]

    df = df.convert_objects(convert_numeric=True)
    return df

  def _create_inferred_schema(self):
    return [
      {'name': 'some', 'type': 'INTEGER'},
      {'name': 'column', 'type': 'STRING'},
      {'name': 'headers', 'type': 'FLOAT'},
    ]

  def _create_table_for_dataframe(self, schema):
    return gcp.bigquery.table('test:testds.testTable0', self._create_context()).create(schema)

  class _uuid(object):
    @property
    def hex(self):
      return '#'

  def _create_uuid(self):
    return self._uuid()
