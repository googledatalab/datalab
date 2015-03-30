# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import unittest
import gcp
import mock
from oauth2client.client import AccessTokenCredentials


class TestCases(unittest.TestCase):

  @mock.patch('gcp.bigquery._Api.tables_insert')
  @mock.patch('gcp.bigquery._Api.tables_list')
  @mock.patch('gcp.bigquery._Api.datasets_get')
  def test_view_create(self,
                         mock_api_datasets_get,
                         mock_api_tables_list,
                         mock_api_tables_insert):
    mock_api_datasets_get.return_value = None
    mock_api_tables_list.return_value = []
    mock_api_tables_insert.return_value = {'selfLink': 'http://foo'}

    name = 'test:testds.testView0'
    sql = 'select * from test:testds.testTable0'
    view = gcp.bigquery.view(name, sql, self._create_context())
    result = view.create()
    self.assertEqual(name, view.full_name)
    self.assertEqual(sql, view.query)
    self.assertIsNotNone(result, 'Expected a view')


  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)

