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

from _credentials import MetadataCredentials
from _metadata import MetadataService


class Context(object):
  """Maintains global contextual state.
  """

  def __init__(self):
    """Initializes an instance of a _Context object.
    """
    ms = MetadataService()
    self._project_id = ms.project_id
    self._credentials = MetadataCredentials(ms)

  @property
  def credentials(self):
    """Retrieves the value of the credentials property.

    Returns:
      The current credentials used in authorizing API requests.
    """
    return self._credentials

  @credentials.setter
  def credentials(self, value):
    """Sets the value of the credentials property.

    Args:
      value: the credentials to use to authorize API requests.
    """
    self._credentials = value

  @property
  def project_id(self):
    """Retrieves the value of the project_id property.

    Returns:
      The current project id to associate with API requests.
    """
    return self._project_id

  @project_id.setter
  def project_id(self, value):
    """Sets the value of the project_id property.

    Args:
      value: the project id to associate with API requests.
    """
    self._project_id = value
