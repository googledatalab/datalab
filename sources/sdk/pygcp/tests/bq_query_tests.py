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

import unittest
import gcp.bigquery
import mock
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  @mock.patch('gcp.bigquery._Api.jobs_query')
  def test_single_result_query(self, mock_api_query):
    mock_api_query.return_value = self._create_single_row_result()

    sql = 'SELECT field1 FROM [table] LIMIT 1'
    q = self._create_query(sql)
    results = q.results()

    self.assertEqual(results.sql, sql)
    self.assertEqual(len(results), 1)
    self.assertEqual(results[0]['field1'], 'value1')

  @mock.patch('gcp.bigquery._Api.jobs_query')
  def test_empty_result_query(self, mock_api_query):
    mock_api_query.return_value = self._create_empty_result()

    q = self._create_query()
    results = q.results()

    self.assertEqual(len(results), 0)

  @mock.patch('gcp.bigquery._Api.jobs_query_results')
  @mock.patch('gcp.bigquery._Api.jobs_query')
  def test_incomplete_result_query(self,
                                   mock_api_query,
                                   mock_api_query_results):
    mock_api_query.return_value = self._create_incomplete_result()
    mock_api_query_results.return_value = self._create_single_row_result()

    q = self._create_query()
    results = q.results()

    self.assertEqual(len(results), 1)
    self.assertEqual(results.job_id, 'test_job')
    self.assertEqual(mock_api_query_results.call_count, 1)

  @mock.patch('gcp.bigquery._Api.jobs_query_results')
  @mock.patch('gcp.bigquery._Api.jobs_query')
  def test_multi_page_results_query(self,
                                    mock_api_query,
                                    mock_api_query_results):
    mock_api_query.return_value = self._create_page1_result()
    mock_api_query_results.return_value = self._create_page2_result()

    q = self._create_query()
    results = q.results()

    self.assertEqual(len(results), 2)
    self.assertEqual(mock_api_query_results.call_count, 1)
    self.assertEqual(mock_api_query_results.call_args[0][0], 'test_job')
    self.assertEqual(mock_api_query_results.call_args[1]['page_token'],
                     'page2')

  @mock.patch('gcp.bigquery._Api.jobs_query')
  def test_malformed_response_raises_exception(self, mock_api_query):
    mock_api_query.return_value = {}

    q = self._create_query()

    with self.assertRaises(Exception) as error:
      _ = q.results()
    self.assertEqual(error.exception[0], 'Unexpected query response.')


  def _create_query(self, sql=None):
    if sql is None: sql = 'SELECT * ...'

    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    context = gcp.Context(project_id, creds)

    return gcp.bigquery.query(sql, context)

  def _create_single_row_result(self):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'jobReference': {
        'jobId': 'test_job'
       },
      'jobComplete': True,
      'schema': {
        'fields': [
          {'name': 'field1', 'type': 'string'}
        ]
      },
      'totalRows': 1,
      'rows': [
        {'f': [{'v': 'value1'}]}
      ]
    }

  def _create_empty_result(self):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'jobReference': {
        'jobId': 'test_job'
      },
      'jobComplete': True,
      'totalRows': 0
    }

  def _create_incomplete_result(self):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'jobReference': {
        'jobId': 'test_job'
      },
      'jobComplete': False
    }

  def _create_page1_result(self):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'jobReference': {
        'jobId': 'test_job'
      },
      'jobComplete': True,
      'schema': {
        'fields': [
          {'name': 'field1', 'type': 'string'}
        ]
      },
      'totalRows': 2,
      'rows': [
        {'f': [{'v': 'value1'}]}
      ],
      'pageToken': 'page2'
    }

  def _create_page2_result(self):
    # pylint: disable=g-continuation-in-parens-misaligned
    return {
      'jobReference': {
        'jobId': 'test_job'
      },
      'jobComplete': True,
      'schema': {
        'fields': [
          {'name': 'field1', 'type': 'string'}
        ]
      },
      'totalRows': 2,
      'rows': [
        {'f': [{'v': 'value2'}]}
      ]
    }
