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

"""Implements Context functionality."""

import _credentials


class Context(object):
  """Maintains contextual state for connecting to Cloud APIs.
  """

  _global_context = None

  def __init__(self, project_id, credentials):
    """Initializes an instance of a Context object.

    Args:
      project_id: the current cloud project.
      credentials: the credentials to use to authorize requests.
    """
    if project_id is None:
      if Context._global_context:
        project_id = Context._global_context._project_id
      else:
        raise Exception('Cannot create Context with no project_id. ' +
                        'Please use set_project_id to set a default project.')
    self._project_id = project_id
    self._credentials = credentials

  @property
  def credentials(self):
    """Retrieves the value of the credentials property.

    Returns:
      The current credentials used in authorizing API requests.
    """
    return self._credentials

  @property
  def project_id(self):
    """Retrieves the value of the project_id property.

    Returns:
      The current project id to associate with API requests.
    """
    return self._project_id

  @staticmethod
  def default(project_id=None):
    """Creates a default Context object.

    The default Context is based on project id and credentials inferred from
    metadata returned by the cloud metadata service. It is also managed as a
    global shared instance used every time the default context is retrieved.

    Args:
      The project ID to use for global context. If this has been set previously, it can be omitted.
      Attempting to use a Context with no project_id will raise an exception.

    Returns:
      An initialized and shared instance of a Context object.
    """

    if Context._global_context is None:
      credentials = _credentials.Credentials()
      Context._global_context = Context(project_id, credentials)
    elif project_id is not None:
      Context._global_context._project_id = project_id

    return Context._global_context
