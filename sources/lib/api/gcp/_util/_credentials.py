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

"""Implements Metadata-based Credentials functionality."""

import oauth2client.client


class MetadataCredentials(oauth2client.client.OAuth2Credentials):
  """OAuth credentials using auth tokens retrieved from the metadata service.
  """

  def __init__(self, metadata_service):
    """Initializes an instance of MetadataCredentials.

    Args:
      metadata_service: the metadata service to use to retrieve auth tokens.
    """

    super(MetadataCredentials, self).__init__(
        access_token=metadata_service.auth_token,
        client_id=None,
        client_secret=None,
        refresh_token=None,
        token_expiry=None,
        token_uri=None,
        user_agent=None
    )
    self._metadata_service = metadata_service

  def apply(self, headers):
    """Adds the authorization header into a headers collection.

    Args:
      headers: the dictionary of HTTP headers
    """
    headers['Authorization'] = 'Bearer ' + self._metadata_service.auth_token

  def refresh(self, unused_http):
    """Refreshes the auth token on expiry.
    """
    self._metadata_service.refresh()

  def _refresh(self, unused_http):
    """Refreshes the auth token on expiry.
    """
    # Refreshing can also be done by directly calling this method, instead of just through
    # refresh() above!
    self._metadata_service.refresh()
