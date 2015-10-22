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

import mock
import unittest

import gcp
import gcp.bigquery
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  def test_view_repr_sql(self):
    name = 'test:testds.testView0'
    view = gcp.bigquery.View(name, self._create_context())
    self.assertEqual('[%s]' % name, view._repr_sql_())

  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_view_create(self,
                       mock_api_datasets_get,
                       mock_api_tables_list,
                       mock_api_tables_get,
                       mock_api_tables_insert):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = []
    mock_api_tables_get.return_value = None
    mock_api_tables_insert.return_value = self._create_tables_insert_success_result()

    name = 'test:testds.testView0'
    sql = 'select * from test:testds.testTable0'
    view = gcp.bigquery.View(name, self._create_context())
    result = view.create(sql)
    self.assertTrue(view.exists())
    self.assertEqual(name, str(view))
    self.assertEqual('[%s]' % name, view._repr_sql_())
    self.assertIsNotNone(result, 'Expected a view')

  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tabledata_list')
  @mock.patch('gcp.bigquery._api.Api.jobs_insert_query')
  @mock.patch('gcp.bigquery._api.Api.jobs_query_results')
  @mock.patch('gcp.bigquery._api.Api.jobs_get')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  def test_view_result(self, mock_api_tables_get, mock_api_jobs_get, mock_api_jobs_query_results,
                       mock_api_insert_query, mock_api_tabledata_list, mock_api_tables_insert):

    mock_api_insert_query.return_value = self._create_insert_done_result()
    mock_api_tables_insert.return_value = self._create_tables_insert_success_result()
    mock_api_jobs_query_results.return_value = {'jobComplete': True}
    mock_api_tables_get.return_value = self._create_tables_get_result()
    mock_api_jobs_get.return_value = {'status': {'state': 'DONE'}}
    mock_api_tabledata_list.return_value = self._create_single_row_result()

    name = 'test:testds.testView0'
    sql = 'select * from test:testds.testTable0'
    view = gcp.bigquery.View(name, self._create_context())
    view.create(sql)
    results = view.results()

    self.assertEqual(1, results.length)
    first_result = results[0]
    self.assertEqual('value1', first_result['field1'])

  @mock.patch('gcp.bigquery._api.Api.tables_insert')
  @mock.patch('gcp.bigquery._api.Api.tables_get')
  @mock.patch('gcp.bigquery._api.Api.table_update')
  @mock.patch('gcp._context.Context.default')
  def test_view_update(self, mock_context_default, mock_api_table_update,
                       mock_api_tables_get, mock_api_tables_insert):
    mock_api_tables_insert.return_value = self._create_tables_insert_success_result()
    mock_context_default.return_value = self._create_context()
    mock_api_table_update.return_value = None
    friendly_name = 'casper'
    description = 'ghostly logs'
    sql = 'select * from [test:testds.testTable0]'
    info = {'friendlyName': friendly_name,
            'description': description,
            'view': {'query': sql}}
    mock_api_tables_get.return_value = info
    name = 'test:testds.testView0'
    view = gcp.bigquery.View(name, self._create_context())
    view.create(sql)
    self.assertEqual(friendly_name, view.friendly_name)
    self.assertEqual(description, view.description)
    self.assertEqual(sql, view.query.sql)

    new_friendly_name = 'aziraphale'
    new_description = 'demon duties'
    new_query = 'SELECT 3 AS x'
    view.update(new_friendly_name, new_description, new_query)

    self.assertEqual(new_friendly_name, view.friendly_name)
    self.assertEqual(new_description, view.description)
    self.assertEqual(new_query, view.query.sql)

  def _create_tables_insert_success_result(self):
    return {'selfLink': 'http://foo'}

  def _create_insert_done_result(self):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'jobReference': {
        'jobId': 'test_job'
      },
      'configuration': {
        'query': {
          'destinationTable': {
            'projectId': 'project',
            'datasetId': 'dataset',
            'tableId': 'table'
          }
        }
      },
      'jobComplete': True,
    }

  def _create_tables_get_result(self, num_rows=1, schema=None):
    if not schema:
      schema = [{'name': 'field1', 'type': 'string'}]
    return {
      'numRows': num_rows,
      'schema': {
        'fields': schema
      },
    }

  def _create_single_row_result(self):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'totalRows': 1,
      'rows': [
        {'f': [{'v': 'value1'}]}
      ]
    }

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
