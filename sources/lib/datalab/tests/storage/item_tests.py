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

import datalab.context
import datalab.storage
import datalab.utils


class TestCases(unittest.TestCase):

  @mock.patch('datalab.storage._api.Api.objects_get')
  def test_item_existence(self, mock_api_objects):
    mock_api_objects.return_value = TestCases._create_objects_get_result()

    b = TestCases._create_bucket()
    self.assertTrue(b.items().contains('test_item1'))

    mock_api_objects.side_effect = datalab.utils.RequestException(404, 'failed')
    self.assertFalse(b.items().contains('test_item2'))

  @mock.patch('datalab.storage._api.Api.objects_get')
  def test_item_metadata(self, mock_api_objects):
    mock_api_objects.return_value = TestCases._create_objects_get_result()

    b = TestCases._create_bucket()
    i = b.item('test_item1')
    m = i.metadata

    self.assertEqual(m.name, 'test_item1')
    self.assertEqual(m.content_type, 'text/plain')

  @mock.patch('datalab.storage._api.Api.objects_list')
  def test_enumerate_items_empty(self, mock_api_objects):
    mock_api_objects.return_value = TestCases._create_enumeration_empty_result()

    b = self._create_bucket()
    items = list(b.items())

    self.assertEqual(len(items), 0)

  @mock.patch('datalab.storage._api.Api.objects_list')
  def test_enumerate_items_single(self, mock_api_objects):
    mock_api_objects.return_value = TestCases._create_enumeration_single_result()

    b = TestCases._create_bucket()
    items = list(b.items())

    self.assertEqual(len(items), 1)
    self.assertEqual(items[0].key, 'test_item1')

  @mock.patch('datalab.storage._api.Api.objects_list')
  def test_enumerate_items_multi_page(self, mock_api_objects):
    mock_api_objects.side_effect = [
      TestCases._create_enumeration_multipage_result1(),
      TestCases._create_enumeration_multipage_result2()
    ]

    b = TestCases._create_bucket()
    items = list(b.items())

    self.assertEqual(len(items), 2)
    self.assertEqual(items[0].key, 'test_item1')
    self.assertEqual(items[1].key, 'test_item2')

  @staticmethod
  def _create_bucket(name='test_bucket'):
    return datalab.storage.Bucket(name, context=TestCases._create_context())

  @staticmethod
  def _create_context():
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return datalab.context.Context(project_id, creds)

  @staticmethod
  def _create_objects_get_result():
    return {'name': 'test_item1', 'contentType': 'text/plain'}

  @staticmethod
  def _create_enumeration_empty_result():
    return {}

  @staticmethod
  def _create_enumeration_single_result():
    return {
      'items': [
        {'name': 'test_item1'}
      ]
    }

  @staticmethod
  def _create_enumeration_multipage_result1():
    return {
      'items': [
        {'name': 'test_item1'}
      ],
      'nextPageToken': 'test_token'
    }

  @staticmethod
  def _create_enumeration_multipage_result2():
    return {
      'items': [
        {'name': 'test_item2'}
      ]
    }
