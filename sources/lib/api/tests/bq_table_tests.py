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

import calendar
import datetime as dt
import unittest
import gcp
import gcp.bigquery
import gcp._util
import mock
from oauth2client.client import AccessTokenCredentials
import pandas


class TestCases(unittest.TestCase):

  def _check_name_parts(self, table):
    parsed_name = table._name_parts
    self.assertEqual('test', parsed_name[0])
    self.assertEqual('requestlogs', parsed_name[1])
    self.assertEqual('today', parsed_name[2])
    self.assertEqual('', parsed_name[3])
    self.assertEqual('[test:requestlogs.today]', table._repr_sql_())
    self.assertEqual('test:requestlogs.today', str(table))

  def test_api_paths(self):
    name = gcp.bigquery._utils.TableName('a', 'b', 'c', 'd')
    self.assertEqual('/projects/a/datasets/b/tables/cd', gcp.bigquery._api.Api._TABLES_PATH % name)
    self.assertEqual('/projects/a/datasets/b/tables/cd/data',
                     gcp.bigquery._api.Api._TABLEDATA_PATH % name)
    name = gcp.bigquery._utils.DataSetName('a', 'b')
    self.assertEqual('/projects/a/datasets/b', gcp.bigquery._api.Api._DATASETS_PATH % name)

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
    table = self._create_table(gcp.bigquery._utils.TableName('test', 'requestlogs', 'today', ''))
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

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  def test_table_metadata(self, mock_api_tables_get):
    name = 'test:requestlogs.today'
    ts = dt.datetime.utcnow()

    mock_api_tables_get.return_value = self._create_table_info_result(ts=ts)
    t = self._create_table(name)

    metadata = t.metadata

    self.assertEqual('Logs', metadata.friendly_name)
    self.assertEqual(2, metadata.rows)
    self.assertEqual(2, metadata.rows)
    self.assertEqual(ts, metadata.created_on)
    self.assertEqual(None, metadata.expires_on)

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  def test_table_schema(self, mock_api_tables):
    mock_api_tables.return_value = self._create_table_info_result()

    t = self._create_table('test:requestlogs.today')
    schema = t.schema

    self.assertEqual(2, len(schema))
    self.assertEqual('name', schema[0].name)

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  def test_table_schema_nested(self, mock_api_tables):
    mock_api_tables.return_value = self._create_table_info_nested_schema_result()

    t = self._create_table('test:requestlogs.today')
    schema = t.schema

    self.assertEqual(4, len(schema))
    self.assertEqual('name', schema[0].name)
    self.assertEqual('val', schema[1].name)
    self.assertEqual('more', schema[2].name)
    self.assertEqual('more.xyz', schema[3].name)

    self.assertIsNone(schema['value'])
    self.assertIsNotNone(schema['val'])

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  def test_malformed_response_raises_exception(self, mock_api_tables_get):
    mock_api_tables_get.return_value = {}

    t = self._create_table('test:requestlogs.today')

    with self.assertRaises(Exception) as error:
      _ = t.schema
    self.assertEqual(error.exception[0], 'Unexpected table response: missing schema')

  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_dataset_list(self, mock_api_datasets_get, mock_api_tables_list):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = self._create_table_list_result()

    ds = gcp.bigquery.DataSet('testds', context=self._create_context())

    tables = []
    for table in ds:
      tables.append(table)
    self.assertEqual(2, len(tables))
    self.assertEqual('test:testds.testTable1', str(tables[0]))
    self.assertEqual('test:testds.testTable2', str(tables[1]))

  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_table_list(self, mock_api_datasets_get, mock_api_tables_list):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = self._create_table_list_result()

    ds = gcp.bigquery.DataSet('testds', context=self._create_context())

    tables = []
    for table in ds.tables():
      tables.append(table)
    self.assertEqual(2, len(tables))
    self.assertEqual('test:testds.testTable1', str(tables[0]))
    self.assertEqual('test:testds.testTable2', str(tables[1]))

  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_view_list(self, mock_api_datasets_get, mock_api_tables_list):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = self._create_table_list_result()

    ds = gcp.bigquery.DataSet('testds', context=self._create_context())

    views = []
    for view in ds.views():
      views.append(view)
    self.assertEqual(1, len(views))
    self.assertEqual('test:testds.testView1', str(views[0]))

  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_table_list_empty(self, mock_api_datasets_get, mock_api_tables_list):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = self._create_table_list_empty_result()

    ds = gcp.bigquery.DataSet('testds', context=self._create_context())

    tables = []
    for table in ds:
      tables.append(table)

    self.assertEqual(0, len(tables))

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  def test_table_exists(self, mock_api_tables_get):
    mock_api_tables_get.return_value = None
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
    self.assertTrue(tbl.exists())

    mock_api_tables_get.side_effect = gcp._util.RequestException(404, 'failed')
    self.assertFalse(tbl.exists())

  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
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

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tabledata_insertAll')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_insert_data_no_table(self,
                                mock_api_datasets_get,
                                mock_api_tabledata_insert_all,
                                mock_api_tables_get,
                                mock_api_tables_insert,
                                mock_api_tables_list,
                                mock_time_sleep,
                                mock_uuid):
    mock_uuid.return_value = self._create_uuid()
    mock_time_sleep.return_value = None
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}
    mock_api_tables_get.side_effect = gcp._util.RequestException(404, 'failed')
    mock_api_tabledata_insert_all.return_value = {}
    mock_api_datasets_get.return_value = None

    table = self._create_table_with_schema(self._create_inferred_schema())
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insert_data(df)
    self.assertEqual('Table %s does not exist.' % str(table), error.exception[0])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tabledata_insertAll')
  def test_insert_data_missing_field(self,
                                     mock_api_tabledata_insert_all,
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
    mock_api_tabledata_insert_all.return_value = {}

    table = self._create_table_with_schema(schema)
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insert_data(df)
    self.assertEqual('Table does not contain field headers', error.exception[0])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tabledata_insertAll')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_insert_data_mismatched_schema(self,
                                         mock_api_datasets_get,
                                         mock_api_tabledata_insert_all,
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
    mock_api_tabledata_insert_all.return_value = {}
    mock_api_datasets_get.return_value = None

    table = self._create_table_with_schema(schema)
    df = self._create_data_frame()

    with self.assertRaises(Exception) as error:
      table.insert_data(df)
    self.assertEqual('Field headers in data has type FLOAT but in table has type STRING',
                     error.exception[0])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tabledata_insertAll')
  def test_insert_data_dataframe(self,
                                 mock_api_tabledata_insert_all,
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
    mock_api_tabledata_insert_all.return_value = {}

    table = self._create_table_with_schema(schema)
    df = self._create_data_frame()

    result = table.insert_data(df)
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insert_all.assert_called_with(('test', 'testds', 'testTable0', ''), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3}}
    ])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tabledata_insertAll')
  def test_insert_data_dictlist(self,
                                mock_api_tabledata_insert_all,
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
    mock_api_tabledata_insert_all.return_value = {}

    table = self._create_table_with_schema(schema)

    result = table.insert_data([
      {u'column': 'r0', u'headers': 10.0, u'some': 0},
      {u'column': 'r1', u'headers': 10.0, u'some': 1},
      {u'column': 'r2', u'headers': 10.0, u'some': 2},
      {u'column': 'r3', u'headers': 10.0, u'some': 3}
    ])
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insert_all.assert_called_with(('test', 'testds', 'testTable0', ''), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3}}
    ])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tabledata_insertAll')
  def test_insert_data_dictlist_index(self,
                                      mock_api_tabledata_insert_all,
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
    mock_api_tabledata_insert_all.return_value = {}

    table = self._create_table_with_schema(schema)

    result = table.insert_data([
      {u'column': 'r0', u'headers': 10.0, u'some': 0},
      {u'column': 'r1', u'headers': 10.0, u'some': 1},
      {u'column': 'r2', u'headers': 10.0, u'some': 2},
      {u'column': 'r3', u'headers': 10.0, u'some': 3}
    ], include_index=True)
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insert_all.assert_called_with(('test', 'testds', 'testTable0', ''), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0, 'Index': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1, 'Index': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2, 'Index': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3, 'Index': 3}}
    ])

  @mock.patch('uuid.uuid4')
  @mock.patch('time.sleep')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tabledata_insertAll')
  def test_insert_data_dictlist_named_index(self,
                                            mock_api_tabledata_insert_all,
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
    mock_api_tabledata_insert_all.return_value = {}

    table = self._create_table_with_schema(schema)

    result = table.insert_data([
        {u'column': 'r0', u'headers': 10.0, u'some': 0},
        {u'column': 'r1', u'headers': 10.0, u'some': 1},
        {u'column': 'r2', u'headers': 10.0, u'some': 2},
        {u'column': 'r3', u'headers': 10.0, u'some': 3}
    ], include_index=True, index_name='Row')
    self.assertIsNotNone(result, "insertAll should return the table object")
    mock_api_tabledata_insert_all.assert_called_with(('test', 'testds', 'testTable0', ''), [
      {'insertId': '#0', 'json': {u'column': 'r0', u'headers': 10.0, u'some': 0, 'Row': 0}},
      {'insertId': '#1', 'json': {u'column': 'r1', u'headers': 10.0, u'some': 1, 'Row': 1}},
      {'insertId': '#2', 'json': {u'column': 'r2', u'headers': 10.0, u'some': 2, 'Row': 2}},
      {'insertId': '#3', 'json': {u'column': 'r3', u'headers': 10.0, u'some': 3, 'Row': 3}}
    ])

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.jobs_insert_load')
  @mock.patch('gcp.bigquery._api.Api.jobs_get')
  def test_table_load(self, mock_api_jobs_get, mock_api_jobs_insert_load, mock_api_tables_get):
    schema = self._create_inferred_schema('Row')
    mock_api_jobs_get.return_value = {'status': {'state': 'DONE'}}
    mock_api_jobs_insert_load.return_value = None
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
    job = tbl.load('gs://foo')
    self.assertIsNone(job)
    mock_api_jobs_insert_load.return_value = {'jobReference': {'jobId': 'bar'}}
    job = tbl.load('gs://foo')
    self.assertEquals('bar', job.id)

  @mock.patch('gcp.bigquery._api.Api.table_extract')
  @mock.patch('gcp.bigquery._api.Api.jobs_get')
  def test_table_extract(self, mock_api_jobs_get, mock_api_table_extract):
    mock_api_jobs_get.return_value = {'status': {'state': 'DONE'}}
    mock_api_table_extract.return_value = None
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
    job = tbl.extract('gs://foo')
    self.assertIsNone(job)
    mock_api_table_extract.return_value = {'jobReference': {'jobId': 'bar'}}
    job = tbl.extract('gs://foo')
    self.assertEquals('bar', job.id)

  @mock.patch('gcp.bigquery._api.Api.tabledata_list')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  def test_table_to_dataframe(self, mock_api_tables_get, mock_api_tabledata_list):
    schema = self._create_inferred_schema()
    mock_api_tables_get.return_value = {'schema': {'fields': schema}}
    mock_api_tabledata_list.return_value = {
      'rows': [
          {'f': [{'v': 1}, {'v': 'foo'}, {'v': 3.1415}]},
          {'f': [{'v': 2}, {'v': 'bar'}, {'v': 0.5}]},
      ]
    }
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
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
    row = gcp.bigquery.Table._encode_dict_as_row({'fo@o': 'b@r', 'b+ar': when}, {})
    self.assertEqual({'foo': 'b@r', 'bar': '2001-02-03T04:05:06.000007'}, row)

  def test_decorators(self):
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
    tbl2 = tbl.snapshot(dt.timedelta(hours=-1))
    self.assertEquals('test:testds.testTable0@-3600000', str(tbl2))

    with self.assertRaises(Exception) as error:
      tbl2 = tbl2.snapshot(dt.timedelta(hours=-2))
    self.assertEqual('Cannot use snapshot() on an already decorated table',
                     error.exception[0])

    with self.assertRaises(Exception) as error:
      _ = tbl2.window(dt.timedelta(hours=-2), 0)
    self.assertEqual('Cannot use window() on an already decorated table',
                     error.exception[0])

    with self.assertRaises(Exception) as error:
      _ = tbl.snapshot(dt.timedelta(days=-8))
    self.assertEqual(
        'Invalid snapshot relative when argument: must be within 7 days: -8 days, 0:00:00',
        error.exception[0])

    with self.assertRaises(Exception) as error:
      _ = tbl.snapshot(dt.timedelta(days=-8))
    self.assertEqual(
        'Invalid snapshot relative when argument: must be within 7 days: -8 days, 0:00:00',
        error.exception[0])

    tbl2 = tbl.snapshot(dt.timedelta(days=-1))
    self.assertEquals('test:testds.testTable0@-86400000', str(tbl2))

    with self.assertRaises(Exception) as error:
      _ = tbl.snapshot(dt.timedelta(days=1))
    self.assertEqual('Invalid snapshot relative when argument: 1 day, 0:00:00',
                     error.exception[0])

    with self.assertRaises(Exception) as error:
      tbl2 = tbl.snapshot(1000)
    self.assertEqual('Invalid snapshot when argument type: 1000',
                     error.exception[0])

    _ = dt.datetime.utcnow() - dt.timedelta(1)
    self.assertEquals('test:testds.testTable0@-86400000', str(tbl2))

    when = dt.datetime.utcnow() + dt.timedelta(1)
    with self.assertRaises(Exception) as error:
      _ = tbl.snapshot(when)
    self.assertEqual('Invalid snapshot absolute when argument: %s' % when,
                     error.exception[0])

    when = dt.datetime.utcnow() - dt.timedelta(8)
    with self.assertRaises(Exception) as error:
      _ = tbl.snapshot(when)
    self.assertEqual('Invalid snapshot absolute when argument: %s' % when,
                     error.exception[0])

  def test_window_decorators(self):
    # The at test above already tests many of the conversion cases. The extra things we
    # have to test are that we can use two values, we get a meaningful default for the second
    # if we pass None, and that the first time comes before the second.
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())

    tbl2 = tbl.window(dt.timedelta(hours=-1))
    self.assertEquals('test:testds.testTable0@-3600000-0', str(tbl2))

    with self.assertRaises(Exception) as error:
      tbl2 = tbl2.window(-400000, 0)
    self.assertEqual('Cannot use window() on an already decorated table',
                     error.exception[0])

    with self.assertRaises(Exception) as error:
      _ = tbl2.snapshot(-400000)
    self.assertEqual('Cannot use snapshot() on an already decorated table',
                     error.exception[0])

    with self.assertRaises(Exception) as error:
      _ = tbl.window(dt.timedelta(0), dt.timedelta(hours=-1))
    self.assertEqual(
        'window: Between arguments: begin must be before end: 0:00:00, -1 day, 23:00:00',
        error.exception[0])

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.table_update')
  def test_table_update(self, mock_api_table_update, mock_api_tables_get):
    schema = self._create_inferred_schema()
    info = {'schema': {'fields': schema}, 'friendlyName': 'casper',
            'description': 'ghostly logs',
            'expirationTime': calendar.timegm(dt.datetime(2020, 1, 1).utctimetuple()) * 1000}
    mock_api_tables_get.return_value = info
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
    new_name = 'aziraphale'
    new_description = 'demon duties'
    new_schema = [{'name': 'injected', 'type': 'FLOAT'}]
    new_schema.extend(schema)
    new_expiry = dt.datetime(2030, 1, 1)
    tbl.update(new_name, new_description, new_expiry, new_schema)
    name, info = mock_api_table_update.call_args[0]
    self.assertEqual(tbl.name, name)
    self.assertEqual(new_name, tbl.metadata.friendly_name)
    self.assertEqual(new_description, tbl.metadata.description)
    self.assertEqual(new_expiry, tbl.metadata.expires_on)
    self.assertEqual(len(new_schema), len(tbl.schema))

  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.table_update')
  def test_table_update(self, mock_api_table_update, mock_api_tables_get):
    schema = self._create_inferred_schema()
    info = {'schema': {'fields': schema}, 'friendlyName': 'casper',
            'description': 'ghostly logs',
            'expirationTime': calendar.timegm(dt.datetime(2020, 1, 1).utctimetuple()) * 1000}
    mock_api_tables_get.return_value = info
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
    new_name = 'aziraphale'
    new_description = 'demon duties'
    new_schema = [{'name': 'injected', 'type': 'FLOAT'}]
    new_schema.extend(schema)
    new_expiry = dt.datetime(2030, 1, 1)
    tbl.update(new_name, new_description, new_expiry, new_schema)
    name, info = mock_api_table_update.call_args[0]
    self.assertEqual(tbl.name, name)
    self.assertEqual(new_name, tbl.metadata.friendly_name)
    self.assertEqual(new_description, tbl.metadata.description)
    self.assertEqual(new_expiry, tbl.metadata.expires_on)
    self.assertEqual(len(new_schema), len(tbl.schema))

  def test_table_to_query(self):
    tbl = gcp.bigquery.Table('testds.testTable0', context=self._create_context())
    q = tbl.to_query()
    self.assertEqual('SELECT * FROM [test:testds.testTable0]', q.sql)
    q = tbl.to_query('foo, bar')
    self.assertEqual('SELECT foo, bar FROM [test:testds.testTable0]', q.sql)
    q = tbl.to_query(['bar', 'foo'])
    self.assertEqual('SELECT bar,foo FROM [test:testds.testTable0]', q.sql)

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)

  def _create_table(self, name):
    return gcp.bigquery.Table(name, self._create_context())

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
              {'name': 'xyz', 'type': 'INTEGER', 'mode': 'NULLABLE'}
            ]
           }
        ]
      }
    }

  def _create_dataset(self, dataset_id):
    return gcp.bigquery.DataSet(dataset_id, context=self._create_context())

  def _create_table_list_result(self):
    return {
      'tables': [
        {
          'type': 'TABLE',
          'tableReference': {'projectId': 'test', 'datasetId': 'testds', 'tableId': 'testTable1'}
        },
        {
          'type': 'VIEW',
          'tableReference': {'projectId': 'test', 'datasetId': 'testds', 'tableId': 'testView1'}
        },
        {
          'type': 'TABLE',
          'tableReference': {'projectId': 'test', 'datasetId': 'testds', 'tableId': 'testTable2'}
        }
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
    schema = [
      {'name': 'some', 'type': 'INTEGER'},
      {'name': 'column', 'type': 'STRING'},
      {'name': 'headers', 'type': 'FLOAT'},
    ]
    if extra_field:
      schema.append({'name': extra_field, 'type': 'INTEGER'})
    return schema

  def _create_table_with_schema(self, schema, name='test:testds.testTable0'):
    return gcp.bigquery.Table(name, self._create_context()).create(schema)

  class _uuid(object):
    @property
    def hex(self):
      return '#'

  def _create_uuid(self):
    return self._uuid()
