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

"""Google Cloud Platform library - IPython Functionality."""

import httplib2 as _httplib2
import requests as _requests

try:
  import IPython as _IPython
  import IPython.core.magic as _magic
  import IPython.core.interactiveshell as _shell
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

# Import the modules that do cell magics
import _bigquery
import _chart
import _extension
import _modules
import _sql
import _storage


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

# Be more tolerant with magics. If the user specified a cell magic that doesn't
# exist and an empty cell body but a line magic with that name exists, run that
# instead. Conversely, if the user specified a line magic that doesn't exist but
# a cell magic exists with that name, run the cell magic with an empty body.

_orig_run_cell_magic = _shell.InteractiveShell.run_cell_magic
_orig_run_line_magic = _shell.InteractiveShell.run_line_magic

def _run_line_magic(self, magic_name, line):
  fn = self.find_line_magic(magic_name)
  if fn is None:
    cm = self.find_cell_magic(magic_name)
    if cm:
      return _run_cell_magic(self, magic_name, line, None)
  return _orig_run_line_magic(self, magic_name, line)


def _run_cell_magic(self, magic_name, line, cell):
  if cell == '':
    fn = self.find_line_magic(magic_name)
    if fn:
      return _orig_run_line_magic(self, magic_name, line)
    # IPython will complain if cell is empty string but not if it is None
    cell = None
  return _orig_run_cell_magic(self, magic_name, line, cell)

_shell.InteractiveShell.run_cell_magic = _run_cell_magic
_shell.InteractiveShell.run_line_magic = _run_line_magic

