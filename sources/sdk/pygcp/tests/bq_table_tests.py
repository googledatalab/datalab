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

  def _check_name_parts(self, table):
    parsed_name = table._name_parts
    self.assertEqual('test', parsed_name[0])
    self.assertEqual('requestlogs', parsed_name[1])
    self.assertEqual('today', parsed_name[2])
    self.assertEqual('[test:requestlogs.today]', table._repr_sql_())

  def test_parse_full_name(self):
    table = self._create_table('test:requestlogs.today')
    self._check_name_parts(table)

  def test_parse_local_name(self):
    table = self._create_table('requestlogs.today')
    self._check_name_parts(table)

  def test_parse_dict_full_name(self):
    table = self._create_table({'project_id': 'test', 'dataset_id': 'requestlogs',
                                'table_id': 'today'})
    self._check_name_parts(table)

  def test_parse_dict_local_name(self):
    table = self._create_table({'dataset_id': 'requestlogs', 'table_id': 'today'})
    self._check_name_parts(table)

  def test_parse_named_tuple_name(self):
    table = self._create_table(gcp.bigquery.tablename('test', 'requestlogs', 'today'))
    self._check_name_parts(table)

  def test_parse_tuple_full_name(self):
    table = self._create_table(('test', 'requestlogs', 'today'))
    self._check_name_parts(table)

  def test_parse_tuple_local(self):
    table = self._create_table(('requestlogs', 'today'))
    self._check_name_parts(table)

  def test_parse_array_full_name(self):
    table = self._create_table(['test', 'requestlogs', 'today'])
    self._check_name_parts(table)

  def test_parse_array_local(self):
    table = self._create_table(['requestlogs', 'today'])
    self._check_name_parts(table)

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

    self.assertEqual(name, metadata.full_name)
    self.assertEqual('Logs', metadata.friendly_name)
    self.assertEqual(2, metadata.rows)
    self.assertEqual(2, metadata.rows)
    self.assertEqual(ts, metadata.created_on)
    self.assertEqual(None, metadata.expires_on)

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_schema(self, mock_api_tables):
    mock_api_tables.return_value = self._create_table_info_result()

    t = self._create_table('test:requestlogs.today')
    schema = t.schema()

    self.assertEqual(2, len(schema))
    self.assertEqual('name', schema[0].name)

  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_schema_nested(self, mock_api_tables):
    mock_api_tables.return_value = self._create_table_info_nested_schema_result()

    t = self._create_table('test:requestlogs.today')
    schema = t.schema()

    self.assertEqual(4, len(schema))
    self.assertEqual('name', schema[0].name)
    self.assertEqual('val', schema[1].name)
    self.assertEqual('more', schema[2].name)
    self.assertEqual('more.xyz', schema[3].name)

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
    self.assertEqual(2, len(tables))
    self.assertEqual('test:testds.testTable1', tables[0].full_name)
    self.assertEqual('test:testds.testTable2', tables[1].full_name)

  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_table_list_empty(self, mock_api_datasets_get, mock_api_tables_list):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = self._create_table_list_empty_result()

    ds = gcp.bigquery.dataset('testds', context=self._create_context())

    tables = []
    for table in ds:
      tables.append(table)

    self.assertEqual(0, len(tables))

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

    mock_api_tables_insert.return_value = {}
    with self.assertRaises(Exception) as error:
      _ = self._create_table_with_schema(schema)
    self.assertEqual('Table test:testds.testTable0 could not be created as it already exists',
                     error.exception[0])

    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    self.assertIsNotNone(self._create_table_with_schema(schema), 'Expected a table')

  @mock.patch('gcp.bigquery._Api.tables_list')
  def test_tables_schema_from_dataframe(self, mock_api_tables_list):
    mock_api_tables_list.return_value = []
    df = self._create_data_frame()
    result = gcp.bigquery.schema(data=df)
    self.assertEqual(gcp.bigquery.schema(definition=self._create_inferred_schema()), result)

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tabledata_insertAll')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_insertAll_no_table(self,
                              mock_api_datasets_get,
                              mock_api_tabledata_insertAll,
                              mock_api_tables_get,
                              mock_api_tables_insert,
                              mock_api_tables_list,
                              mock_time_sleep,
                              mock_uuid):
    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_get.side_effect = Exception([None, 404])
    mock_api_tabledata_insertAll.return_value = {}
    mock_api_datasets_get.return_value = None


    table = self._create_table_with_schema(self._create_inferred_schema())
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insertAll(df)
    self.assertEqual('Table %s does not exist.' % table.full_name, error.exception[0])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tabledata_insertAll')
  def test_insertAll_missing_field(self,
                                   mock_api_tabledata_insertAll,
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
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_list.return_value = []
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_insertAll.return_value = {}

    table = self._create_table_with_schema(schema)
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insertAll(df)
    self.assertEqual('Table does not contain field headers', error.exception[0])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tabledata_insertAll')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_insertAll_mismatched_schema(self,
                                       mock_api_datasets_get,
                                       mock_api_tabledata_insertAll,
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
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_insertAll.return_value = {}
    mock_api_datasets_get.return_value = None

    table = self._create_table_with_schema(schema)
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insertAll(df)
    self.assertEqual('Field headers in data has type FLOAT but in table has type STRING',
                     error.exception[0])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tabledata_insertAll')
  def test_insertAll_dataframe(self,
                               mock_api_tabledata_insertAll,
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
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_insertAll.return_value = {}

    table = self._create_table_with_schema(schema)
    df = self._create_data_frame()

    result = table.insertAll(df)
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insertAll.assert_called_with(('test', 'testds', 'testTable0'), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3}}
    ])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tabledata_insertAll')
  def test_insertAll_dictlist(self,
                              mock_api_tabledata_insertAll,
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
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_insertAll.return_value = {}

    table = self._create_table_with_schema(schema)

    result = table.insertAll([
      {u'column': 'r0', u'headers': 10.0, u'some': 0},
      {u'column': 'r1', u'headers': 10.0, u'some': 1},
      {u'column': 'r2', u'headers': 10.0, u'some': 2},
      {u'column': 'r3', u'headers': 10.0, u'some': 3}
    ])
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insertAll.assert_called_with(('test', 'testds', 'testTable0'), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3}}
    ])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tabledata_insertAll')
  def test_insertAll_dictlist_index(self,
                                    mock_api_tabledata_insertAll,
                                    mock_api_tables_get,
                                    mock_api_tables_insert,
                                    mock_api_tables_list,
                                    mock_api_datasets_get,
                                    mock_time_sleep, mock_uuid):
    schema = self._create_inferred_schema('Index')

    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_datasets_get.return_value = True
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_insertAll.return_value = {}

    table = self._create_table_with_schema(schema)

    result = table.insertAll([
      {u'column': 'r0', u'headers': 10.0, u'some': 0},
      {u'column': 'r1', u'headers': 10.0, u'some': 1},
      {u'column': 'r2', u'headers': 10.0, u'some': 2},
      {u'column': 'r3', u'headers': 10.0, u'some': 3}
    ], include_index=True)
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insertAll.assert_called_with(('test', 'testds', 'testTable0'), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0, 'Index': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1, 'Index': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2, 'Index': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3, 'Index': 3}}
    ])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tabledata_insertAll')
  def test_insertAll_dictlist_named_index(self,
                                          mock_api_tabledata_insertAll,
                                          mock_api_tables_get,
                                          mock_api_tables_insert,
                                          mock_api_tables_list,
                                          mock_api_datasets_get,
                                          mock_time_sleep, mock_uuid):
    schema = self._create_inferred_schema('Row')

    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_datasets_get.return_value = True
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_insertAll.return_value = {}

    table = self._create_table_with_schema(schema)

    result = table.insertAll([
                               {u'column': 'r0', u'headers': 10.0, u'some': 0},
                               {u'column': 'r1', u'headers': 10.0, u'some': 1},
                               {u'column': 'r2', u'headers': 10.0, u'some': 2},
                               {u'column': 'r3', u'headers': 10.0, u'some': 3}
                             ], include_index=True, index_name='Row')
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insertAll.assert_called_with(('test', 'testds', 'testTable0'), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0, 'Row': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1, 'Row': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2, 'Row': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3, 'Row': 3}}
    ])

  @mock.patch('gcp.bigquery._Api.jobs_insert_load')
  def test_table_load(self, mock_api_jobs_insert_load):
    mock_api_jobs_insert_load.return_value = None
    tbl = gcp.bigquery.table('testds.testTable0', context=self._create_context())
    job = tbl.load('gs://foo')
    self.assertIsNone(job)
    mock_api_jobs_insert_load.return_value = {'jobReference': {'jobId': 'bar'}}
    job = tbl.load('gs://foo')
    self.assertEquals('bar', job.id)

  @mock.patch('gcp.bigquery._Api.table_extract')
  def test_table_extract(self, mock_api_table_extract):
    mock_api_table_extract.return_value = None
    tbl = gcp.bigquery.table('testds.testTable0', context=self._create_context())
    job = tbl.extract('gs://foo')
    self.assertIsNone(job)
    mock_api_table_extract.return_value = {'jobReference': {'jobId': 'bar'}}
    job = tbl.extract('gs://foo')
    self.assertEquals('bar', job.id)

  @mock.patch('gcp.bigquery._Api.tabledata_list')
  @mock.patch('gcp.bigquery._Api.tables_get')
  def test_table_to_dataframe(self, mock_api_tables_get, mock_api_tabledata_list):
    schema = self._create_inferred_schema()
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_list.return_value = {
      'rows': [
          {'f': [{'v': 1}, {'v': 'foo'}, {'v': 3.1415}]},
          {'f': [{'v': 2}, {'v': 'bar'}, {'v': 0.5}]},
      ]
    }
    tbl = gcp.bigquery.table('testds.testTable0', context=self._create_context())
    df = tbl.to_dataframe()
    self.assertEquals(2, len(df))
    self.assertEquals(1, df['some'][0])
    self.assertEquals(2, df['some'][1])
    self.assertEquals('foo', df['column'][0])
    self.assertEquals('bar', df['column'][1])
    self.assertEquals(3.1415, df['headers'][0])
    self.assertEquals(0.5, df['headers'][1])

  def test_encode_dict_as_row(self):
    when = dt.datetime(2001, 2, 3, 4, 5, 6, 7)
    row = gcp.bigquery._Table._encode_dict_as_row({'fo@o': 'b@r', 'b+ar': when}, {})
    self.assertEqual({'foo': 'b@r', 'bar': '2001-02-03T04:05:06.000007'}, row)

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
    data = {
      'some': [
        0, 1, 2, 3
      ],
      'column': [
        'r0', 'r1', 'r2', 'r3'
      ],
      'headers': [
        10.0, 10.0, 10.0, 10.0
      ]
    }
    return pandas.DataFrame(data)

  def _create_inferred_schema(self, extra_field=None):
    schema= [
      {'name': 'some', 'type': 'INTEGER'},
      {'name': 'column', 'type': 'STRING'},
      {'name': 'headers', 'type': 'FLOAT'},
    ]
    if extra_field:
      schema.append({'name': extra_field, 'type': 'INTEGER'})
    return schema

  def _create_table_with_schema(self, schema, name='test:testds.testTable0'):
    return gcp.bigquery.table(name, self._create_context()).create(schema)

  class _uuid(object):
    @property
    def hex(self):
      return '#'

  def _create_uuid(self):
    return self._uuid()
