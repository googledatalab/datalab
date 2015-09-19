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

  @mock.patch('gcp.storage._api.Api.buckets_get')
  def test_bucket_existence(self, mock_api_buckets):
    mock_api_buckets.return_value = self._create_buckets_get_result()

    buckets = gcp.storage.Buckets(context=self._create_context())
    self.assertTrue(buckets.contains('test_bucket'))

    mock_api_buckets.side_effect = gcp._util.RequestException(404, 'failed')
    self.assertFalse(buckets.contains('test_bucket_2'))

  @mock.patch('gcp.storage._api.Api.buckets_get')
  def test_bucket_metadata(self, mock_api_buckets):
    mock_api_buckets.return_value = self._create_buckets_get_result()

    b = self._create_bucket()
    m = b.metadata()

    self.assertEqual(m.name, 'test_bucket')

  def _create_bucket(self, name='test_bucket'):
    return gcp.storage.Bucket(name, context=self._create_context())

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)

  def _create_buckets_get_result(self):
    return {'name': 'test_bucket'}
