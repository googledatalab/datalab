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

"""Implements HTTP client helper functionality."""

import datetime
import json
import urllib
import httplib2


# TODO(nikhilko): Start using the requests library instead.


class RequestException(Exception):

  def __init__(self, status, content):
    self.status = status
    self.content = content
    self.message = 'HTTP request failed'
    # Try extract a message from the body; swallow possible resulting ValueErrors and KeyErrors.
    try:
      error = json.loads(content)['error']
      if 'errors' in error:
        error = error['errors'][0]
      self.message += ': ' + error['message']
    except Exception:
      lines = content.split('\n') if isinstance(content, basestring) else []
      if lines:
        self.message += ': ' + lines[0]

  def __str__(self):
    return self.message


class Http(object):
  """A helper class for making HTTP requests.
  """

  def __init__(self):
    pass

  @staticmethod
  def request(url, args=None, data=None, headers=None, method=None,
              credentials=None, raw_response=False, stats=None):
    """Issues HTTP requests.

    Args:
      url: the URL to request.
      args: optional query string arguments.
      data: optional data to be sent within the request.
      headers: optional headers to include in the request.
      method: optional HTTP method to use. If unspecified this is inferred
          (GET or POST) based on the existence of request data.
      credentials: optional set of credentials to authorize the request.
      raw_response: whether the raw response content should be returned as-is.
      stats: an optional dictionary that, if provided, will be populated with some
          useful info about the request, like 'duration' in seconds and 'data_size' in
          bytes. These may be useful optimizing the access to rate-limited APIs.
    Returns:
      The parsed response object.
    Raises:
      Exception when the HTTP request fails or the response cannot be processed.
    """
    if headers is None:
      headers = {}

    headers['user-agent'] = 'GoogleCloudDataLab/1.0'
    # Add querystring to the URL if there are any arguments.
    if args is not None:
      qs = urllib.urlencode(args)
      url = url + '?' + qs

    # Setup method to POST if unspecified, and appropriate request headers
    # if there is data to be sent within the request.
    if data is not None:
      if method is None:
        method = 'POST'

      if data != '':
        # If there is a content type specified, use it (and the data) as-is.
        # Otherwise, assume JSON, and serialize the data object.
        if 'Content-Type' not in headers:
          data = json.dumps(data)
          headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = str(len(data))
    else:
      if method == 'POST':
        headers['Content-Length'] = '0'

    # If the method is still unset, i.e. it was unspecified, and there
    # was no data to be POSTed, then default to GET request.
    if method is None:
      method = 'GET'

    # Create an Http object to issue requests. Associate the credentials
    # with it if specified to perform authorization.
    #
    # TODO(nikhilko):
    # SSL cert validation seemingly fails, and workarounds are not amenable
    # to implementing in library code. So configure the Http object to skip
    # doing so, in the interim.
    http = httplib2.Http()
    http.disable_ssl_certificate_validation = True
    if credentials is not None:
      http = credentials.authorize(http)
    if stats is not None:
      stats['duration'] = datetime.datetime.utcnow()

    response = None
    try:
      response, content = http.request(url,
                                       method=method,
                                       body=data,
                                       headers=headers)
      if 200 <= response.status < 300:
        if raw_response:
          return content
        return json.loads(content)
      else:
        raise RequestException(response.status, content)
    except ValueError:
      raise Exception('Failed to process HTTP response.')
    except httplib2.HttpLib2Error:
      raise Exception('Failed to send HTTP request.')
    finally:
      if stats is not None:
        stats['data_size'] = len(data)
        stats['status'] = response.status
        stats['duration'] = (datetime.datetime.utcnow() - stats['duration']).total_seconds()
