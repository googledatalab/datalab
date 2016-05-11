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
from oauth2client.client import AccessTokenCredentials
import unittest

import datalab.bigquery
import datalab.context


class TestCases(unittest.TestCase):

  @mock.patch('datalab.bigquery._api.Api.tabledata_list')
  @mock.patch('datalab.bigquery._api.Api.jobs_insert_query')
  @mock.patch('datalab.bigquery._api.Api.jobs_query_results')
  @mock.patch('datalab.bigquery._api.Api.jobs_get')
  @mock.patch('datalab.bigquery._api.Api.tables_get')
  def test_single_result_query(self, mock_api_tables_get, mock_api_jobs_get,
                               mock_api_jobs_query_results, mock_api_insert_query,
                               mock_api_tabledata_list):
    mock_api_tables_get.return_value = TestCases._create_tables_get_result()
    mock_api_jobs_get.return_value = {'status': {'state': 'DONE'}}
    mock_api_jobs_query_results.return_value = {'jobComplete': True}
    mock_api_insert_query.return_value = TestCases._create_insert_done_result()
    mock_api_tabledata_list.return_value = TestCases._create_single_row_result()

    sql = 'SELECT field1 FROM [table] LIMIT 1'
    q = TestCases._create_query(sql)
    results = q.results()

    self.assertEqual(sql, results.sql)
    self.assertEqual('(%s)' % sql, q._repr_sql_())
    self.assertEqual(sql, str(q))
    self.assertEqual(1, results.length)
    first_result = results[0]
    self.assertEqual('value1', first_result['field1'])

  @mock.patch('datalab.bigquery._api.Api.jobs_insert_query')
  @mock.patch('datalab.bigquery._api.Api.jobs_query_results')
  @mock.patch('datalab.bigquery._api.Api.jobs_get')
  @mock.patch('datalab.bigquery._api.Api.tables_get')
  def test_empty_result_query(self, mock_api_tables_get, mock_api_jobs_get,
                              mock_api_jobs_query_results, mock_api_insert_query):
    mock_api_tables_get.return_value = TestCases._create_tables_get_result(0)
    mock_api_jobs_get.return_value = {'status': {'state': 'DONE'}}
    mock_api_jobs_query_results.return_value = {'jobComplete': True}
    mock_api_insert_query.return_value = TestCases._create_insert_done_result()

    q = TestCases._create_query()
    results = q.results()

    self.assertEqual(0, results.length)

  @mock.patch('datalab.bigquery._api.Api.jobs_insert_query')
  @mock.patch('datalab.bigquery._api.Api.jobs_query_results')
  @mock.patch('datalab.bigquery._api.Api.jobs_get')
  @mock.patch('datalab.bigquery._api.Api.tables_get')
  def test_incomplete_result_query(self,
                                   mock_api_tables_get,
                                   mock_api_jobs_get,
                                   mock_api_jobs_query_results,
                                   mock_api_insert_query):
    mock_api_tables_get.return_value = TestCases._create_tables_get_result()
    mock_api_jobs_get.return_value = {'status': {'state': 'DONE'}}
    mock_api_jobs_query_results.return_value = {'jobComplete': True}
    mock_api_insert_query.return_value = TestCases._create_incomplete_result()

    q = TestCases._create_query()
    results = q.results()

    self.assertEqual(1, results.length)
    self.assertEqual('test_job', results.job_id)

  @mock.patch('datalab.bigquery._api.Api.jobs_insert_query')
  def test_malformed_response_raises_exception(self, mock_api_insert_query):
    mock_api_insert_query.return_value = {}

    q = TestCases._create_query()

    with self.assertRaises(Exception) as error:
      _ = q.results()
    self.assertEqual('Unexpected response from server', error.exception[0])

  def test_udf_expansion(self):
    sql = 'SELECT * FROM udf(source)'
    udf = datalab.bigquery.UDF('inputs', [('foo', 'string'), ('bar', 'integer')], 'udf', 'code')
    context = TestCases._create_context()
    query = datalab.bigquery.Query(sql, udf=udf, context=context)
    self.assertEquals('SELECT * FROM (SELECT foo, bar FROM udf(source))', query.sql)

    # Alternate form
    query = datalab.bigquery.Query(sql, udfs=[udf], context=context)
    self.assertEquals('SELECT * FROM (SELECT foo, bar FROM udf(source))', query.sql)

  @staticmethod
  def _create_query(sql=None):
    if sql is None:
      sql = 'SELECT * ...'
    return datalab.bigquery.Query(sql, context=TestCases._create_context())

  @staticmethod
  def _create_context():
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return datalab.context.Context(project_id, creds)

  @staticmethod
  def _create_insert_done_result():
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

  @staticmethod
  def _create_single_row_result():
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'totalRows': 1,
      'rows': [
        {'f': [{'v': 'value1'}]}
      ]
    }

  @staticmethod
  def _create_empty_result():
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'totalRows': 0
    }

  @staticmethod
  def _create_incomplete_result():
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
      'jobComplete': False
    }

  @staticmethod
  def _create_page_result(page_token=None):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'totalRows': 2,
      'rows': [
        {'f': [{'v': 'value1'}]}
      ],
      'pageToken': page_token
    }

  @staticmethod
  def _create_tables_get_result(num_rows=1, schema=None):
    if schema is None:
      schema = [{'name': 'field1', 'type': 'string'}]
    return {
      'numRows': num_rows,
      'schema': {
        'fields': schema
      },
    }
