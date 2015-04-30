# Copyright 2014 Google Inc. All rights reserved.
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

import datetime as dt
import unittest
import gcp
import gcp.bigquery
import mock
import numpy as np
from oauth2client.client import AccessTokenCredentials
import pandas

class TestCases(unittest.TestCase):

  @mock.patch('gcp.bigquery._Api.jobs_get')
  def test_job_complete(self, mock_api_jobs_get):
    mock_api_jobs_get.return_value = {}
    j = gcp.bigquery.job('foo', self._create_context())
    self.assertFalse(j.iscomplete)
    self.assertFalse(j.failed)
    mock_api_jobs_get.return_value = {'status': {'state': 'DONE'}}
    self.assertTrue(j.iscomplete)
    self.assertFalse(j.failed)

  @mock.patch('gcp.bigquery._Api.jobs_get')
  def test_job_fatal_error(self, mock_api_jobs_get):
    mock_api_jobs_get.return_value = {
      'status': {
        'state': 'DONE',
        'errorResult': {
          'location': 'A',
          'message': 'B',
          'reason': 'C'
        }
      }
    }
    j = gcp.bigquery.job('foo', self._create_context())
    self.assertTrue(j.iscomplete)
    self.assertTrue(j.failed)
    e = j.fatal_error
    self.assertIsNotNone(e)
    self.assertEqual('A', e.location)
    self.assertEqual('B', e.message)
    self.assertEqual('C', e.reason)

  @mock.patch('gcp.bigquery._Api.jobs_get')
  def test_job_errors(self, mock_api_jobs_get):
    mock_api_jobs_get.return_value = {
      'status': {
        'state': 'DONE',
        'errors': [
          {
            'location': 'A',
            'message': 'B',
            'reason': 'C'
          },
          {
            'location': 'D',
            'message': 'E',
            'reason': 'F'
          }
        ]
      }
    }
    j = gcp.bigquery.job('foo', self._create_context())
    self.assertTrue(j.iscomplete)
    self.assertFalse(j.failed)
    self.assertEqual(2, len(j.errors))
    self.assertEqual('A', j.errors[0].location)
    self.assertEqual('B', j.errors[0].message)
    self.assertEqual('C', j.errors[0].reason)
    self.assertEqual('D', j.errors[1].location)
    self.assertEqual('E', j.errors[1].message)
    self.assertEqual('F', j.errors[1].reason)

  def _create_context(self):
    project_id = 'test'
    creds = AccessTokenCredentials('test_token', 'test_ua')
    return gcp.Context(project_id, creds)
