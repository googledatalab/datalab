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

import unittest
import gcp
import mock
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  def test_view_repr_sql(self):
    name = 'test:testds.testView0'
    view = gcp.bigquery.view(name, self._create_context())
    self.assertEqual('[%s]' % name, view._repr_sql_())

  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_get')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.datasets_get')
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
    view = gcp.bigquery.view(name, self._create_context())
    result = view.create(sql)
    self.assertTrue(view.exists())
    self.assertEqual(name, view.full_name)
    self.assertIsNotNone(result, 'Expected a view')

  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tabledata_list')
  @mock.patch('gcp.bigquery._Api.jobs_insert_query')
  @mock.patch('gcp.bigquery._Api.jobs_query_results')
  @mock.patch('gcp.bigquery._Api.jobs_get')
  @mock.patch('gcp.bigquery._Api.tables_get')
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
    view = gcp.bigquery.view(name, self._create_context())
    view.create(sql)
    results = view.results()

    self.assertEqual(1, results.length)
    first_result = results[0]
    self.assertEqual('value1', first_result['field1'])

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

  def _create_tables_get_result(self, numRows=1, schema=[{'name': 'field1', 'type': 'string'}]):
    return {
      'numRows': numRows,
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

