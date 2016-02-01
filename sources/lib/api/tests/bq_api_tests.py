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
import mock
from oauth2client.client import AccessTokenCredentials

import gcp
from gcp.bigquery._api import Api


class TestCases(unittest.TestCase):

  def validate(self, mock_http_request, expected_url, expected_args=None, expected_data=None,
               expected_headers=None, expected_method=None):
    url = mock_http_request.call_args[0][0]
    kwargs = mock_http_request.call_args[1]
    self.assertEquals(expected_url, url)
    if expected_args is not None:
      self.assertEquals(expected_args, kwargs['args'])
    else:
      self.assertNotIn('args', kwargs)
    if expected_data is not None:
      self.assertEquals(expected_data, kwargs['data'])
    else:
      self.assertNotIn('data', kwargs)
    if expected_headers is not None:
      self.assertEquals(expected_headers, kwargs['headers'])
    else:
      self.assertNotIn('headers', kwargs)
    if expected_method is not None:
      self.assertEquals(expected_method, kwargs['method'])
    else:
      self.assertNotIn('method', kwargs)

  @mock.patch('gcp._util.Http.request')
  def test_jobs_insert_load(self, mock_http_request):
    api = self._create_api()
    api.jobs_insert_load('SOURCE', gcp.bigquery._utils.TableName('p', 'd', 't', ''))
    self.maxDiff = None
    expected_data = {
      'kind': 'bigquery#job',
      'configuration': {
        'load': {
          'sourceUris': ['SOURCE'],
          'destinationTable': {
            'projectId': 'p',
            'datasetId': 'd',
            'tableId': 't'
          },
          'createDisposition': 'CREATE_NEVER',
          'writeDisposition': 'WRITE_EMPTY',
          'sourceFormat': 'CSV',
          'fieldDelimiter': ',',
          'allowJaggedRows': False,
          'allowQuotedNewlines': False,
          'encoding': 'UTF-8',
          'ignoreUnknownValues': False,
          'maxBadRecords': 0,
          'quote': '"',
          'skipLeadingRows': 0
        }
      }
    }
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/jobs/',
                  expected_data=expected_data)

    api.jobs_insert_load('SOURCE2', gcp.bigquery._utils.TableName('p2', 'd2', 't2', ''),
                         append=True, create=True, allow_jagged_rows=True,
                         allow_quoted_newlines=True, ignore_unknown_values=True,
                         source_format='JSON', max_bad_records=1)
    expected_data = {
      'kind': 'bigquery#job',
      'configuration': {
        'load': {
          'sourceUris': ['SOURCE2'],
          'destinationTable': {
            'projectId': 'p2',
            'datasetId': 'd2',
            'tableId': 't2'
          },
          'createDisposition': 'CREATE_IF_NEEDED',
          'writeDisposition': 'WRITE_APPEND',
          'sourceFormat': 'JSON',
          'ignoreUnknownValues': True,
          'maxBadRecords': 1
        }
      }
    }
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p2/jobs/',
                  expected_data=expected_data)

  @mock.patch('gcp._util.Http.request')
  def test_jobs_insert_query(self, mock_http_request):
    api = self._create_api()
    api.jobs_insert_query('SQL')
    expected_data = {
      'kind': 'bigquery#job',
      'configuration': {
        'query': {
          'query': 'SQL',
          'useQueryCache': True,
          'userDefinedFunctionResources': [],
          'allowLargeResults': False
        },
        'dryRun': False,
        'priority': 'BATCH',
      },
    }
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/test/jobs/',
                  expected_data=expected_data)
    api.jobs_insert_query('SQL2', ['CODE'],
                          table_name=gcp.bigquery._utils.TableName('p', 'd', 't', ''),
                          append=True, dry_run=True, use_cache=False, batch=False,
                          allow_large_results=True)
    expected_data = {
      'kind': 'bigquery#job',
      'configuration': {
        'query': {
          'query': 'SQL2',
          'useQueryCache': False,
          'allowLargeResults': True,
          'destinationTable': {
            'projectId': 'p',
            'datasetId': 'd',
            'tableId': 't'
          },
          'writeDisposition': 'WRITE_APPEND',
          'userDefinedFunctionResources': [
            {
              'inlineCode': 'CODE'
            }
          ]
        },
        'dryRun': True,
        'priority': 'INTERACTIVE',
      },
    }
    self.maxDiff = None
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/test/jobs/',
                  expected_data=expected_data)

  @mock.patch('gcp._util.Http.request')
  def test_jobs_query_results(self, mock_http_request):
    api = self._create_api()
    api.jobs_query_results('JOB', 'PROJECT', 10, 20, 30)
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/PROJECT/queries/JOB',
                  expected_args={'maxResults': 10, 'timeoutMs': 20, 'startIndex': 30})

  @mock.patch('gcp._util.Http.request')
  def test_jobs_get(self, mock_http_request):
    api = self._create_api()
    api.jobs_get('JOB', 'PROJECT')
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/PROJECT/jobs/JOB')

  @mock.patch('gcp._util.Http.request')
  def test_datasets_insert(self, mock_http_request):
    api = self._create_api()
    api.datasets_insert(gcp.bigquery._utils.DataSetName('p', 'd'))
    expected_data = {
      'kind': 'bigquery#dataset',
      'datasetReference': {
        'projectId': 'p',
        'datasetId': 'd',
      }
    }
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/datasets/',
                  expected_data=expected_data)
    api.datasets_insert(gcp.bigquery._utils.DataSetName('p', 'd'), 'FRIENDLY', 'DESCRIPTION')
    expected_data = {
      'kind': 'bigquery#dataset',
      'datasetReference': {
        'projectId': 'p',
        'datasetId': 'd'
      },
      'friendlyName': 'FRIENDLY',
      'description': 'DESCRIPTION'
    }
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/datasets/',
                  expected_data=expected_data)

  @mock.patch('gcp._util.Http.request')
  def test_datasets_delete(self, mock_http_request):
    api = self._create_api()
    api.datasets_delete(gcp.bigquery._utils.DataSetName('p', 'd'), False)
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d',
                  expected_args={},
                  expected_method='DELETE')
    api.datasets_delete(gcp.bigquery._utils.DataSetName('p', 'd'), True)
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d',
                  expected_args={'deleteContents': True},
                  expected_method='DELETE')

  @mock.patch('gcp._util.Http.request')
  def test_datasets_update(self, mock_http_request):
    api = self._create_api()
    api.datasets_update(gcp.bigquery._utils.DataSetName('p', 'd'), 'INFO')
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d',
                  expected_method='PUT', expected_data='INFO')

  @mock.patch('gcp._util.Http.request')
  def test_datasets_get(self, mock_http_request):
    api = self._create_api()
    api.datasets_get(gcp.bigquery._utils.DataSetName('p', 'd'))
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d')

  @mock.patch('gcp._util.Http.request')
  def test_datasets_list(self, mock_http_request):
    api = self._create_api()
    api.datasets_list()
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/test/datasets/',
                  expected_args={})

    api.datasets_list('PROJECT', 10, 'TOKEN')
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/PROJECT/datasets/',
                  expected_args={'maxResults': 10, 'pageToken': 'TOKEN'})

  @mock.patch('gcp._util.Http.request')
  def test_tables_get(self, mock_http_request):
    api = self._create_api()
    api.tables_get(gcp.bigquery._utils.TableName('p', 'd', 't', ''))
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/t')

  @mock.patch('gcp._util.Http.request')
  def test_tables_list(self, mock_http_request):
    api = self._create_api()
    api.tables_list(gcp.bigquery._utils.DataSetName('p', 'd'))
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/',
                  expected_args={})

    api.tables_list(gcp.bigquery._utils.DataSetName('p', 'd'), 10, 'TOKEN')
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/',
                  expected_args={'maxResults': 10, 'pageToken': 'TOKEN'})

  @mock.patch('gcp._util.Http.request')
  def test_tables_insert(self, mock_http_request):
    api = self._create_api()
    api.tables_insert(gcp.bigquery._utils.TableName('p', 'd', 't', ''))
    expected_data = {
      'kind': 'bigquery#table',
      'tableReference': {
        'projectId': 'p',
        'datasetId': 'd',
        'tableId': 't'
      }
    }
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/',
                  expected_data=expected_data)

    api.tables_insert(gcp.bigquery._utils.TableName('p', 'd', 't', ''),
                      'SCHEMA', 'QUERY', 'FRIENDLY', 'DESCRIPTION')
    expected_data = {
      'kind': 'bigquery#table',
      'tableReference': {
        'projectId': 'p',
        'datasetId': 'd',
        'tableId': 't'
      },
      'schema': {
        'fields': 'SCHEMA'
      },
      'view': {'query': 'QUERY'},
      'friendlyName': 'FRIENDLY',
      'description': 'DESCRIPTION'
    }
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/',
                  expected_data=expected_data)

  @mock.patch('gcp._util.Http.request')
  def test_tabledata_insertAll(self, mock_http_request):
    api = self._create_api()
    api.tabledata_insertAll(gcp.bigquery._utils.TableName('p', 'd', 't', ''), 'ROWS')
    expected_data = {
      'kind': 'bigquery#tableDataInsertAllRequest',
      'rows': 'ROWS'
    }
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/t/insertAll',
                  expected_data=expected_data)

  @mock.patch('gcp._util.Http.request')
  def test_tabledata_list(self, mock_http_request):
    api = self._create_api()
    api.tabledata_list(gcp.bigquery._utils.TableName('p', 'd', 't', ''))
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/t/data',
                  expected_args={})

    api.tabledata_list(gcp.bigquery._utils.TableName('p', 'd', 't', ''), 10, 20, 'TOKEN')
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/t/data',
                  expected_args={
                    'startIndex': 10,
                    'maxResults': 20,
                    'pageToken': 'TOKEN'
                  })

  @mock.patch('gcp._util.Http.request')
  def test_table_delete(self, mock_http_request):
    api = self._create_api()
    api.table_delete(gcp.bigquery._utils.TableName('p', 'd', 't', ''))
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/t',
                  expected_method='DELETE')

  @mock.patch('gcp._util.Http.request')
  def test_table_extract(self, mock_http_request):
    api = self._create_api()
    api.table_extract(gcp.bigquery._utils.TableName('p', 'd', 't', ''), 'DEST')
    expected_data = {
      'kind': 'bigquery#job',
      'configuration': {
        'extract': {
          'sourceTable': {
            'projectId': 'p',
            'datasetId': 'd',
            'tableId': 't'
          },
          'compression': 'GZIP',
          'fieldDelimiter': ',',
          'printHeader': True,
          'destinationUris': ['DEST'],
          'destinationFormat': 'CSV',
        }
      }
    }
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/jobs/',
                  expected_data=expected_data)

    api.table_extract(gcp.bigquery._utils.TableName('p', 'd', 't', ''),
                      ['DEST'], format='JSON', compressed=False, field_delimiter=':',
                      print_header=False)
    expected_data = {
      'kind': 'bigquery#job',
      'configuration': {
        'extract': {
          'sourceTable': {
            'projectId': 'p',
            'datasetId': 'd',
            'tableId': 't'
          },
          'compression': 'NONE',
          'fieldDelimiter': ':',
          'printHeader': False,
          'destinationUris': ['DEST'],
          'destinationFormat': 'JSON',
        }
      }
    }
    self.validate(mock_http_request, 'https://www.googleapis.com/bigquery/v2/projects/p/jobs/',
                  expected_data=expected_data)

  @mock.patch('gcp._util.Http.request')
  def test_table_update(self, mock_http_request):
    api = self._create_api()
    api.table_update(gcp.bigquery._utils.TableName('p', 'd', 't', ''), 'INFO')
    self.validate(mock_http_request,
                  'https://www.googleapis.com/bigquery/v2/projects/p/datasets/d/tables/t',
                  expected_method='PUT', expected_data='INFO')

  def _create_api(self):
    context = self._create_context()
    return Api(context)

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
