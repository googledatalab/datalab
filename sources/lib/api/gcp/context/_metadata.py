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

"""Implements service wrapper for the compute metadata service."""

import httplib2
import json
import os


class MetadataService(object):
  """Metadata service wrapper to retrieve metadata values.

  This allows retrieving project metadata (such as id) as well as
  instance metadata (such as auth token for the service account).

  By default this wrapper works against the service endpoint available
  within GCE VMs, but it can be controlled via METADATA_HOST and
  METADATA_PORT environment variables to request an alternate endpoint.
  """

  _DEFAULT_HOST = 'metadata.google.internal'
  _DEFAULT_PORT = '80'
  _SERVICE_URL = 'http://%s:%s/computeMetadata/v1/%s'
  _PROJECTID_PATH = 'project/project-id'
  _AUTHTOKEN_PATH = 'instance/service-accounts/default/token'

  def __init__(self):
    self._project_id = None
    self._auth_token = None

  @property
  def auth_token(self):
    """Auth token authorized for the default service account on the VM.

    Returns:
      A string containing the auth token.
    """

    if self._auth_token is None:
      self._auth_token = MetadataService._lookup(MetadataService._AUTHTOKEN_PATH,
                                                 field='access_token')
    return self._auth_token

  @property
  def project_id(self):
    """The named project id of the cloud project containing this VM.

    Returns:
      A string containing the alpha-numeric cloud project name.
    """

    if self._project_id is None:
      self._project_id = MetadataService._lookup(MetadataService._PROJECTID_PATH)
    return self._project_id

  def refresh(self):
    """Refreshes metadata values that can change.
    """

    self._auth_token = None

  @staticmethod
  def _lookup(path, field=None):
    """Issues requests to the metadata service to lookup metadata.

    Args:
      path: the metadata path.
      field: the field containing the metadata value in a JSON response.
    Returns:
      The metadata value returned from the metadata service.
    Raises:
      RuntimeError: An error occurred in the metadata service request.
    """

    host = os.environ.get('METADATA_HOST', MetadataService._DEFAULT_HOST)
    port = MetadataService._DEFAULT_PORT

    url = MetadataService._SERVICE_URL % (host, port, path)
    headers = {'X-Google-Metadata-Request': 'True'}

    http = httplib2.Http()
    resp, content = http.request(url, headers=headers)

    if resp.status == 200:
      if field is None:
        return content
      else:
        try:
          data = json.loads(content)
          return data[field]
        except (ValueError, KeyError):
          raise RuntimeError('Unexpected response from metadata service.')
    else:
      raise RuntimeError('Unable to load metadata from metadata service.')
