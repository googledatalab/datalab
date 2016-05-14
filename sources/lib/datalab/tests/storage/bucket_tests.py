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

  @mock.patch('datalab.storage._api.Api.buckets_get')
  def test_bucket_existence(self, mock_api_buckets):
    mock_api_buckets.return_value = TestCases._create_buckets_get_result()

    buckets = datalab.storage.Buckets(context=TestCases._create_context())
    self.assertTrue(buckets.contains('test_bucket'))

    mock_api_buckets.side_effect = datalab.utils.RequestException(404, 'failed')
    self.assertFalse(buckets.contains('test_bucket_2'))

  @mock.patch('datalab.storage._api.Api.buckets_get')
  def test_bucket_metadata(self, mock_api_buckets):
    mock_api_buckets.return_value = TestCases._create_buckets_get_result()

    b = TestCases._create_bucket()
    m = b.metadata

    self.assertEqual(m.name, 'test_bucket')

  @staticmethod
  def _create_bucket(name='test_bucket'):
    return datalab.storage.Bucket(name, context=TestCases._create_context())

  @staticmethod
  def _create_context():
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return datalab.context.Context(project_id, creds)

  @staticmethod
  def _create_buckets_get_result():
    return {'name': 'test_bucket'}
