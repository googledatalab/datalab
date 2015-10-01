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
import gcp.bigquery
import gcp._util
import mock
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  def _check_name_parts(self, dataset):
    parsed_name = dataset._name_parts
    self.assertEqual('test', parsed_name[0])
    self.assertEqual('requestlogs', parsed_name[1])
    self.assertEqual('test:requestlogs', dataset._full_name)
    self.assertEqual('test:requestlogs', str(dataset))

  def test_parse_full_name(self):
    dataset = self._create_dataset('test:requestlogs')
    self._check_name_parts(dataset)

  def test_parse_local_name(self):
    dataset = self._create_dataset('requestlogs')
    self._check_name_parts(dataset)

  def test_parse_dict_full_name(self):
    dataset = self._create_dataset({'project_id': 'test', 'dataset_id': 'requestlogs'})
    self._check_name_parts(dataset)

  def test_parse_dict_local_name(self):
    dataset = self._create_dataset({'dataset_id': 'requestlogs'})
    self._check_name_parts(dataset)

  def test_parse_named_tuple_name(self):
    dataset = self._create_dataset(gcp.bigquery._utils.DataSetName('test', 'requestlogs'))
    self._check_name_parts(dataset)

  def test_parse_tuple_full_name(self):
    dataset = self._create_dataset(('test', 'requestlogs'))
    self._check_name_parts(dataset)

  def test_parse_tuple_local(self):
    dataset = self._create_dataset(('requestlogs'))
    self._check_name_parts(dataset)

  def test_parse_array_full_name(self):
    dataset = self._create_dataset(['test', 'requestlogs'])
    self._check_name_parts(dataset)

  def test_parse_array_local(self):
    dataset = self._create_dataset(['requestlogs'])
    self._check_name_parts(dataset)

  def test_parse_invalid_name(self):
    with self.assertRaises(Exception):
      _ = self._create_dataset('today@')

  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_dataset_exists(self, mock_api_datasets_get):
    mock_api_datasets_get.return_value = ''
    dataset = self._create_dataset('test:requestlogs')
    self.assertTrue(dataset.exists())
    mock_api_datasets_get.side_effect = gcp._util.RequestException(404, None)
    dataset._info = None
    self.assertFalse(dataset.exists())

  @mock.patch('gcp.bigquery._api.Api.datasets_insert')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_datasets_create_fails(self, mock_api_datasets_get, mock_api_datasets_insert):
    mock_api_datasets_get.side_effect = gcp._util.RequestException(None, 404)
    mock_api_datasets_insert.return_value = {}

    ds = self._create_dataset('requestlogs')
    with self.assertRaises(Exception):
      _ = ds.create()

  @mock.patch('gcp.bigquery._api.Api.datasets_insert')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_datasets_create_succeeds(self, mock_api_datasets_get, mock_api_datasets_insert):
    mock_api_datasets_get.side_effect = gcp._util.RequestException(404, None)
    mock_api_datasets_insert.return_value = {'selfLink': None}
    ds = self._create_dataset('requestlogs')
    self.assertEqual(ds, ds.create())

  @mock.patch('gcp.bigquery._api.Api.datasets_insert')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  def test_datasets_create_redundant(self, mock_api_datasets_get, mock_api_datasets_insert):
    ds = self._create_dataset('requestlogs', {})
    mock_api_datasets_get.return_value = None
    mock_api_datasets_insert.return_value = {}
    self.assertEqual(ds, ds.create())

  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.datasets_delete')
  def test_datasets_delete_succeeds(self, mock_api_datasets_delete, mock_api_datasets_get):
    mock_api_datasets_get.return_value = ''
    mock_api_datasets_delete.return_value = None
    ds = self._create_dataset('requestlogs')
    self.assertIsNone(ds.delete())

  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.datasets_delete')
  def test_datasets_delete_fails(self, mock_api_datasets_delete, mock_api_datasets_get):
    mock_api_datasets_delete.return_value = None
    mock_api_datasets_get.side_effect = gcp._util.RequestException(404, None)
    ds = self._create_dataset('requestlogs')
    with self.assertRaises(Exception):
      _ = ds.delete()

  @mock.patch('gcp.bigquery._api.Api.tables_list')
  def test_tables_list(self, mock_api_tables_list):
    mock_api_tables_list.return_value = {
      'tables': [
          {
            'type': 'TABLE',
            'tableReference': {'projectId': 'p', 'datasetId': 'd', 'tableId': 't1'}
          },
          {
            'type': 'TABLE',
            'tableReference': {'projectId': 'p', 'datasetId': 'd', 'tableId': 't2'}
          },
      ]
    }
    ds = self._create_dataset('requestlogs')
    tables = [table for table in ds]
    self.assertEqual(2, len(tables))
    self.assertEqual('p:d.t1', str(tables[0]))
    self.assertEqual('p:d.t2', str(tables[1]))

  @mock.patch('gcp.bigquery.DataSet._get_info')
  @mock.patch('gcp.bigquery._api.Api.datasets_list')
  def test_datasets_list(self, mock_api_datasets_list, mock_dataset_get_info):
    mock_api_datasets_list.return_value = {
      'datasets': [
        {'datasetReference': {'projectId': 'p', 'datasetId': 'd1'}},
        {'datasetReference': {'projectId': 'p', 'datasetId': 'd2'}},
      ]
    }
    mock_dataset_get_info.return_value = {}
    datasets = [dataset for dataset in gcp.bigquery.DataSets('test', self._create_context())]
    self.assertEqual(2, len(datasets))
    self.assertEqual('p:d1', str(datasets[0]))
    self.assertEqual('p:d2', str(datasets[1]))

  @mock.patch('gcp.bigquery._api.Api.tables_list')
  @mock.patch('gcp.bigquery._api.Api.datasets_get')
  @mock.patch('gcp.bigquery._api.Api.datasets_update')
  def test_datasets_update(self, mock_api_datasets_update, mock_api_datasets_get,
                           mock_api_tables_list):
    mock_api_tables_list.return_value = {
      'tables': [
        {'type': 'TABLE', 'tableReference': {'projectId': 'p', 'datasetId': 'd', 'tableId': 't1'}},
        {'type': 'TABLE', 'tableReference': {'projectId': 'p', 'datasetId': 'd', 'tableId': 't2'}},
      ]
    }
    info = {'friendlyName': 'casper', 'description': 'ghostly logs'}
    mock_api_datasets_get.return_value = info
    ds = self._create_dataset('requestlogs')

    new_friendly_name = 'aziraphale'
    new_description = 'demon duties'
    ds.update(new_friendly_name, new_description)

    name, info = mock_api_datasets_update.call_args[0]
    self.assertEqual(ds.name, name)

    self.assertEqual(new_friendly_name, ds.friendly_name)
    self.assertEqual(new_description, ds.description)

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)

  def _create_dataset(self, name, metadata=None):
    # Patch get_info so we don't have to mock it everywhere else.
    orig = gcp.bigquery.DataSet._get_info
    gcp.bigquery.DataSet._get_info = mock.Mock(return_value=metadata)
    ds =  gcp.bigquery.DataSet(name, context=self._create_context())
    gcp.bigquery.DataSet._get_info = orig
    return ds
