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
from gcp._util._http import Http
from gcp._util._http import httplib2

import mock


class TestCases(unittest.TestCase):

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_get_request_is_invoked(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{}')

    Http.request('http://www.example.org')
    self.assertEqual(mock_request.call_count, 1)
    self.assertEqual(mock_request.call_args[1]['method'], 'GET')

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_post_request_is_invoked(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{}')

    Http.request('http://www.example.org', data={})
    self.assertEqual(mock_request.call_args[1]['method'], 'POST')

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_explicit_post_request_is_invoked(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{}')

    Http.request('http://www.example.org', method='POST')
    self.assertEqual(mock_request.call_args[1]['method'], 'POST')

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_query_string_format(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{}')

    Http.request('http://www.example.org', args={'a': 1, 'b': 'a b c'})
    self.assertEqual(mock_request.call_args[0][0],
                     'http://www.example.org?a=1&b=a+b+c')

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_formats_json_request(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{}')

    data = {'abc': 123}
    _ = Http.request('http://www.example.org', data=data)

    self.assertEqual(mock_request.call_args[1]['body'], '{"abc": 123}')
    self.assertEqual(mock_request.call_args[1]['headers']['Content-Type'],
                     'application/json')

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_supports_custom_content(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{}')

    headers = {'Content-Type': 'text/plain'}
    data = 'custom text'
    _ = Http.request('http://www.example.org', data=data, headers=headers)

    self.assertEqual(mock_request.call_args[1]['body'], 'custom text')
    self.assertEqual(mock_request.call_args[1]['headers']['Content-Type'], 'text/plain')

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_parses_json_response(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, '{"abc":123}')

    data = Http.request('http://www.example.org')
    self.assertEqual(data['abc'], 123)

  @mock.patch('httplib2.Response')
  @mock.patch('httplib2.Http.request')
  def test_raises_http_error(self, mock_request, mock_response):
    self._setup_mocks(mock_request, mock_response, 'Not Found', 404)

    with self.assertRaises(Exception) as error:
      Http.request('http://www.example.org')

    e = error.exception
    self.assertEqual(e.status, 404)
    self.assertEqual(e.content, 'Not Found')

  def _setup_mocks(self, mock_request, mock_response, content, status=200):
    response = mock_response()
    response.status = status
    mock_request.return_value = (response, content)
