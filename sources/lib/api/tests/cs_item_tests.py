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
import gcp.storage
import mock
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  @mock.patch('gcp.storage._api.Api.objects_get')
  def test_item_existence(self, mock_api_objects):
    mock_api_objects.return_value = self._create_objects_get_result()

    b = self._create_bucket()
    self.assertTrue(b.items().contains('test_item1'))

    mock_api_objects.side_effect = gcp._util.RequestException(404, 'failed')
    self.assertFalse(b.items().contains('test_item2'))

  @mock.patch('gcp.storage._api.Api.objects_get')
  def test_item_metadata(self, mock_api_objects):
    mock_api_objects.return_value = self._create_objects_get_result()

    b = self._create_bucket()
    i = b.item('test_item1')
    m = i.metadata()

    self.assertEqual(m.name, 'test_item1')
    self.assertEqual(m.content_type, 'text/plain')

  @mock.patch('gcp.storage._api.Api.objects_list')
  def test_enumerate_items_empty(self, mock_api_objects):
    mock_api_objects.return_value = self._create_enumeration_empty_result()

    b = self._create_bucket()
    items = list(b.items())

    self.assertEqual(len(items), 0)

  @mock.patch('gcp.storage._api.Api.objects_list')
  def test_enumerate_items_single(self, mock_api_objects):
    mock_api_objects.return_value = self._create_enumeration_single_result()

    b = self._create_bucket()
    items = list(b.items())

    self.assertEqual(len(items), 1)
    self.assertEqual(items[0].key, 'test_item1')

  @mock.patch('gcp.storage._api.Api.objects_list')
  def test_enumerate_items_multi_page(self, mock_api_objects):
    mock_api_objects.side_effect = [
      self._create_enumeration_multipage_result1(),
      self._create_enumeration_multipage_result2()
    ]

    b = self._create_bucket()
    items = list(b.items())

    self.assertEqual(len(items), 2)
    self.assertEqual(items[0].key, 'test_item1')
    self.assertEqual(items[1].key, 'test_item2')

  def _create_bucket(self, name='test_bucket'):
    return gcp.storage.Bucket(name, context=self._create_context())

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)

  def _create_objects_get_result(self):
    return {'name': 'test_item1', 'contentType': 'text/plain'}

  def _create_enumeration_empty_result(self):
    return {}

  def _create_enumeration_single_result(self):
    return {
      'items': [
        {'name': 'test_item1'}
      ]
    }

  def _create_enumeration_multipage_result1(self):
    return {
      'items': [
        {'name': 'test_item1'}
      ],
      'nextPageToken': 'test_token'
    }

  def _create_enumeration_multipage_result2(self):
    return {
      'items': [
        {'name': 'test_item2'}
      ]
    }
