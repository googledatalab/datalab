# Copyright 2016 Google Inc. All rights reserved.
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

"""Implements HTTP API wrapper."""

import datalab.utils


class Api(object):
  """A helper class to issue API HTTP requests to resource manager API."""

  _ENDPOINT = 'https://cloudresourcemanager.googleapis.com/v1'
  _PROJECT_PATH = '/projects/%s'
  _PROJECTS_PATH = '/projects'

  def __init__(self, credentials):
    self._credentials = credentials

  def projects_list(self, max_results=0, page_token=None):
    url = Api._ENDPOINT + Api._PROJECTS_PATH
    args = {}
    if max_results != 0:
      args['pageSize'] = max_results
    if page_token is not None:
      args['pageToken'] = page_token

    return datalab.utils.Http.request(url, args=args, credentials=self._credentials)

  def project_get(self, projectId):
    url = Api._ENDPOINT + (Api._PROJECT_PATH % projectId)
    return datalab.utils.Http.request(url, credentials=self._credentials)

