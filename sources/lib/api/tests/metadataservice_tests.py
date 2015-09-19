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

# The httplib2 import is implicitly used when mocking its functionality.
# pylint: disable=unused-import
from gcp._util._metadata import httplib2
from gcp._util._metadata import MetadataService

import mock


class TestCases(unittest.TestCase):

  def _setup_mocks(self, mock_request, mock_response, content, status=200):
    response = mock_response()
    response.status = status
    mock_request.return_value = (response, content)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_auth_token_is_returned(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{"access_token":"abc"}')
    ms = MetadataService()

    auth_token = ms.auth_token
    self.assertEqual('abc', auth_token)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_auth_token_is_cached(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{"access_token":"abc"}')
    ms = MetadataService()

    _ = ms.auth_token
    _ = ms.auth_token
    self.assertEqual(1, mock_request.call_count)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_auth_token_can_be_refreshed(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{"access_token":"abc"}')
    ms = MetadataService()

    _ = ms.auth_token
    ms.refresh()
    _ = ms.auth_token

    self.assertEqual(2, mock_request.call_count)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_auth_token_can_be_updated(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{"access_token":"abc"}')
    ms = MetadataService()

    auth_token1 = ms.auth_token

    self._setup_mocks(mock_request, mock_response, '{"access_token":"xyz"}')
    ms.refresh()
    auth_token2 = ms.auth_token

    self.assertEqual('abc', auth_token1)
    self.assertEqual('xyz', auth_token2)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_project_id_is_returned(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, 'project1')
    ms = MetadataService()

    project_id = ms.project_id
    self.assertEqual('project1', project_id)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_project_id_is_cached(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, 'project1')
    ms = MetadataService()

    _ = ms.project_id
    _ = ms.project_id
    self.assertEqual(1, mock_request.call_count)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_raises_error_on_failure(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '', 500)
    ms = MetadataService()

    with self.assertRaises(RuntimeError):
      _ = ms.project_id

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_raises_error_on_bad_json(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, 'abc')
    ms = MetadataService()

    with self.assertRaises(RuntimeError):
      _ = ms.auth_token

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_raises_error_on_missing_data(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{"data":"abc"}')
    ms = MetadataService()

    with self.assertRaises(RuntimeError):
      _ = ms.auth_token
