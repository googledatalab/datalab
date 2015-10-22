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

import unittest
import gcp
import gcp._util
import gcp.bigquery
import mock
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  # The main thing we need to test is a query that references an external table and how
  # that translates into a REST call.

  def _request_result(self):
    return {
      'jobReference': {
        'jobId': 'job1234'
      },
      'configuration': {
        'query': {
          'destinationTable': {
            'projectId': 'test',
            'datasetId': 'dataset',
            'tableId': 'table'
          }
        }
      },
      'jobComplete': True
    }

  def _get_data(self):
    return [
      {'day': 1, 'weight': 220},
      {'day': 2, 'weight': 221},
      {'day': 3, 'weight': 220},
      {'day': 4, 'weight': 219},
      {'day': 5, 'weight': 218},
    ]

  def _get_table_definition(self, uris, skip_rows=0):
    if not isinstance(uris, list):
      uris = [uris]
    return {
      'compression': 'NONE',
      'csvOptions': {
        'allowJaggedRows': False,
        'quote': '"',
        'encoding': 'UTF-8',
        'skipLeadingRows': skip_rows,
        'fieldDelimiter': ',',
        'allowQuotedNewlines': False
      },
      'sourceFormat': 'CSV',
      'maxBadRecords': 0,
      'ignoreUnknownValues': False,
      'sourceUris': uris,
      'schema': {
        'fields': [
          {'type': 'INTEGER', 'name': 'day'},
          {'type': 'INTEGER', 'name': 'weight'}
        ]
      }
    }

  def _get_expected_request_data(self, sql, table_definitions):
    return {
      'kind': 'bigquery#job',
      'configuration': {
        'priority': 'INTERACTIVE',
        'query': {
          'query': sql,
          'allowLargeResults': False,
          'tableDefinitions': table_definitions,
          'useQueryCache': True,
          'userDefinedFunctionResources': []
        },
        'dryRun': False
      }
    }

  @mock.patch('gcp._util.Http.request')
  def test_external_table_query(self, mock_http_request):
    mock_http_request.return_value = self._request_result()

    data = self._get_data()
    schema = gcp.bigquery.Schema.from_data(data)

    table_uri = 'gs://datalab/weight.csv'
    options = gcp.bigquery.CSVOptions(skip_leading_rows=1)
    sql = 'SELECT * FROM weight'

    weight = gcp.bigquery.FederatedTable.from_storage(table_uri, schema=schema, csv_options=options)
    q = gcp.bigquery.Query(sql, data_sources={'weight': weight}, context=self._create_context())
    q.execute_async()

    table_definition = self._get_table_definition(table_uri, skip_rows=1)
    expected_data = self._get_expected_request_data(sql, {'weight': table_definition})
    request_url = 'https://www.googleapis.com/bigquery/v2/projects/test/jobs/'

    mock_http_request.assert_called_with(request_url, credentials=mock.ANY, data=expected_data)

  # Test with multiple URLs and no non-default options
  @mock.patch('gcp._util.Http.request')
  def test_external_table_query2(self, mock_http_request):
    mock_http_request.return_value = self._request_result()

    data = self._get_data()
    schema = gcp.bigquery.Schema.from_data(data)

    table_uris = ['gs://datalab/weight1.csv', 'gs://datalab/weight2.csv']
    sql = 'SELECT * FROM weight'

    weight = gcp.bigquery.FederatedTable.from_storage(table_uris, schema=schema)
    q = gcp.bigquery.Query(sql, data_sources={'weight': weight}, context=self._create_context())
    q.execute_async()

    table_definition = self._get_table_definition(table_uris)
    expected_data = self._get_expected_request_data(sql, {'weight': table_definition})
    request_url = 'https://www.googleapis.com/bigquery/v2/projects/test/jobs/'

    mock_http_request.assert_called_with(request_url, credentials=mock.ANY, data=expected_data)

  # Test with multiple tables and using keyword args
  @mock.patch('gcp._util.Http.request')
  def test_external_tables_query(self, mock_http_request):
    mock_http_request.return_value = self._request_result()

    data = self._get_data()
    schema = gcp.bigquery.Schema.from_data(data)

    table_uri1 = 'gs://datalab/weight1.csv'
    table_uri2 = 'gs://datalab/weight2.csv'
    sql = 'SELECT * FROM weight1 JOIN weight2 ON day'

    options = gcp.bigquery.CSVOptions(skip_leading_rows=1)
    weight1 = gcp.bigquery.FederatedTable.from_storage(table_uri1, schema=schema,
                                                       csv_options=options)
    weight2 = gcp.bigquery.FederatedTable.from_storage(table_uri2, schema=schema)
    q = gcp.bigquery.Query(sql, weight1=weight1, weight2=weight2, context=self._create_context())
    q.execute_async()

    table_definition1 = self._get_table_definition(table_uri1, skip_rows=1)
    table_definition2 = self._get_table_definition(table_uri2)
    table_definitions = {'weight1': table_definition1, 'weight2': table_definition2}
    expected_data = self._get_expected_request_data(sql, table_definitions)
    request_url = 'https://www.googleapis.com/bigquery/v2/projects/test/jobs/'

    mock_http_request.assert_called_with(request_url, credentials=mock.ANY, data=expected_data)

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
