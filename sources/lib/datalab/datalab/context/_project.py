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

"""Implements Projects functionality."""

import os

import datalab.utils

import _api
import _utils


# We could do this with the gcloud SDK. However, installing that while locked on oauth2.5
# introduces some ugliness; in particular we are stuck with v0.9 and need to work around:
#
#   https://github.com/GoogleCloudPlatform/gcloud-python/issues/1412
#
# and would have to put up with:
#
#    https://github.com/GoogleCloudPlatform/gcloud-python/issues/1570
#
# So we use the REST API instead.

class Project(object):
  """ Simple wrapper class for Cloud projects. """

  def __init__(self, api, id, number, name):
    self._api = api
    self._id = id
    self._number = number
    self._name = name

  @property
  def id(self):
    return self._id

  @property
  def name(self):
    return self._name

  @property
  def number(self):
    return self._number

  def __str__(self):
    return self._id


class Projects(object):
  """ Iterator class for enumerating the active projects accessible to the account. """

  def __init__(self, credentials=None):
    """ Initialize the Projects object.

    Args:
      credentials: the credentials for the account.
    """
    if credentials is None:
      credentials = _utils.get_credentials()
    self._api = _api.Api(credentials)

  def _retrieve_projects(self, page_token, count):
    try:
      list_info = self._api.projects_list(max_results=count,
                                          page_token=page_token)
    except Exception as e:
      raise e

    projects = list_info.get('projects', [])
    if len(projects):
      try:
        projects = [Project(self._api,
                             info['projectId'],
                             info['projectNumber'],
                             info['name'])
                    for info in projects if info['lifecycleState'] == 'ACTIVE']
      except KeyError:
        raise Exception('Unexpected response from server.')

    page_token = list_info.get('nextPageToken', None)
    return projects, page_token

  def __iter__(self):
    """ Returns an iterator for iterating through the Datasets in the project.
    """
    return iter(datalab.utils.Iterator(self._retrieve_projects))

  @staticmethod
  def get_default_id(credentials=None):
    project_id = os.getenv('PROJECT_ID')
    if project_id is None:
      projects, _ = Projects(credentials)._retrieve_projects(None, 2)
      if len(projects) == 1:
        project_id = projects[0].id
    return project_id
