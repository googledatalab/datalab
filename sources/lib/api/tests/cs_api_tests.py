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
from gcp.storage._api import Api


class TestCases(unittest.TestCase):

  def validate(self, mock_http_request, expected_url, expected_args=None, expected_data=None,
               expected_headers=None, expected_method=None):
    url = mock_http_request.call_args[0][0]
    kwargs = mock_http_request.call_args[1]
    self.assertEquals(expected_url, url)
    if expected_args is not None:
      self.assertEquals(expected_args, kwargs['args'])
    if expected_data is not None:
      self.assertEquals(expected_data, kwargs['data'])
    if expected_headers is not None:
      self.assertEquals(expected_headers, kwargs['headers'])
    if expected_method is not None:
      self.assertEquals(expected_method, kwargs['method'])

  @mock.patch('gcp._util.Http.request')
  def test_buckets_insert(self, mock_http_request):
    api = self._create_api()

    api.buckets_insert('foo')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/',
                  expected_args={'project': 'test'}, expected_data={'name': 'foo'})

    api.buckets_insert('foo', 'bar')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/',
                  expected_args={'project': 'bar'}, expected_data={'name': 'foo'})

  @mock.patch('gcp._util.Http.request')
  def test_buckets_delete(self, mock_http_request):
    api = self._create_api()
    api.buckets_delete('foo')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/foo',
                  expected_method='DELETE')

  @mock.patch('gcp._util.Http.request')
  def test_buckets_get(self, mock_http_request):
    api = self._create_api()
    api.buckets_get('foo')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/foo',
                  expected_args={'projection': 'noAcl'})
    api.buckets_get('foo', 'bar')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/foo',
                  expected_args={'projection': 'bar'})

  @mock.patch('gcp._util.Http.request')
  def test_buckets_list(self, mock_http_request):
    api = self._create_api()
    api.buckets_list()
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/',
                  expected_args={'project': 'test', 'projection': 'noAcl', 'maxResults': 100})

    api.buckets_list(projection='foo', max_results=99, page_token='xyz', project_id='bar')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/',
                  expected_args={'project': 'bar', 'maxResults': 99,
                                 'projection': 'foo', 'pageToken': 'xyz'})

  @mock.patch('gcp._util.Http.request')
  def test_object_download(self, mock_http_request):
    api = self._create_api()
    api.object_download('foo', 'bar')
    self.validate(mock_http_request, 'https://www.googleapis.com/download/storage/v1/b/foo/o/bar',
                  expected_args={'alt': 'media'})

  @mock.patch('gcp._util.Http.request')
  def test_object_upload(self, mock_http_request):
    api = self._create_api()
    api.object_upload('b', 'k', 'c', 't')
    self.validate(mock_http_request, 'https://www.googleapis.com/upload/storage/v1/b/b/o/',
                  expected_args={'uploadType': 'media', 'name': 'k'},
                  expected_data='c', expected_headers={'Content-Type': 't'})

  @mock.patch('gcp._util.Http.request')
  def test_objects_copy(self, mock_http_request):
    api = self._create_api()
    api.objects_copy('sb', 'sk', 'tb', 'tk')
    self.validate(mock_http_request,
                  'https://www.googleapis.com/storage/v1/b/sb/o/sk/copyTo/b/tb/o/tk',
                  expected_method='POST')

  @mock.patch('gcp._util.Http.request')
  def test_objects_delete(self, mock_http_request):
    api = self._create_api()
    api.objects_delete('b', 'k')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/b/o/k',
                  expected_method='DELETE')

  @mock.patch('gcp._util.Http.request')
  def test_objects_get(self, mock_http_request):
    api = self._create_api()
    api.objects_get('b', 'k')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/b/o/k',
                  expected_args={'projection': 'noAcl'})

    api.objects_get('b', 'k', 'p')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/b/o/k',
                  expected_args={'projection': 'p'})

  @mock.patch('gcp._util.Http.request')
  def test_objects_list(self, mock_http_request):
    api = self._create_api()
    api.objects_list('b')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/b/o/',
                  expected_args={'projection': 'noAcl', 'maxResults': 100})

    api.objects_list('b', 'p', 'd', 'pr', True, 99, 'foo')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/b/o/',
                  expected_args={'projection': 'pr', 'maxResults': 99,
                                 'prefix': 'p', 'delimiter': 'd', 'versions': 'true',
                                 'pageToken': 'foo'})

  @mock.patch('gcp._util.Http.request')
  def test_objects_patch(self, mock_http_request):
    api = self._create_api()
    api.objects_patch('b', 'k', 'i')
    self.validate(mock_http_request, 'https://www.googleapis.com/storage/v1/b/b/o/k',
                  expected_method='PATCH', expected_data='i')

  def _create_api(self):
    context = self._create_context()
    return Api(context)

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
