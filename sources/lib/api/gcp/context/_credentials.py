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

"""Implements Credentials functionality."""

import httplib2
import json
import oauth2client.client


class Credentials(oauth2client.client.OAuth2Credentials):
  """OAuth credentials using auth tokens.
  """

  def _get_token(self):
    try:
      # This works when running in GCE only.
      if self._creds is None:
        self._creds = oauth2client.client.GoogleCredentials.get_application_default()
      self._creds.refresh(httplib2.Http())
      return self._creds.access_token
    except Exception:
      self._creds = None
      # Load from file created by node server.
      # TODO(gram): record the timestamp on the file so we don't reread the file every time;
      # only when it has changed.
      with open('/root/tokens.json') as f:
        return json.load(f).get('access_token', None)

  def __init__(self):
    """Initializes an instance of Credentials.

    """
    self._creds = None
    access_token = self._get_token()

    super(Credentials, self).__init__(
        access_token=access_token,
        client_id=None,
        client_secret=None,
        refresh_token=None,
        token_expiry=None,
        token_uri=None,
        user_agent=None
    )

  def apply(self, headers):
    """Adds the authorization header into a headers collection.

    Args:
      headers: the dictionary of HTTP headers
    """
    headers['Authorization'] = 'Bearer ' + self._get_token()

  def refresh(self, _):
    """Refreshes the auth token on expiry.
    """
    pass

  def _refresh(self, unused_http):
    """Refreshes the auth token on expiry.
    """
    pass
