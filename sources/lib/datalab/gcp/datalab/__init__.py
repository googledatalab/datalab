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

"""Google Cloud Platform library - IPython Functionality."""

import httplib2 as _httplib2
import requests as _requests

try:
  import IPython as _ipython
  import IPython.core.magic as _magic
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

import gcp.datalab._bigquery
import gcp.datalab._chart
import gcp.datalab._modules
import gcp.datalab._sql
import gcp.datalab._storage


# Inject our user agent on all requests by monkey-patching a wrapper around httplib2.Http.request.
_orig_request = _httplib2.Http.request


def _request(self, uri, method="GET", body=None, headers=None,
             redirections=_httplib2.DEFAULT_MAX_REDIRECTS, connection_type=None):
  if headers is None:
    headers = {}
  headers['user-agent'] = 'GoogleCloudDataLab/1.0'
  return _orig_request(self, uri, method=method, body=body, headers=headers,
                       redirections=redirections, connection_type=connection_type)


_httplib2.Http.request = _request

# Similarly for the requests library.
_orig_init = _requests.Session.__init__


def _init_session(self):
  _orig_init(self)
  self.headers['User-Agent'] = 'GoogleCloudDataLab/1.0'


_requests.Session.__init__ = _init_session
