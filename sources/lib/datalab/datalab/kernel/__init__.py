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

"""Google Cloud Datalab - notebook functionality."""


import httplib2 as _httplib2
import requests as _requests


try:
  import IPython as _IPython
  import IPython.core.magic as _magic
  import IPython.core.interactiveshell as _shell
  from IPython import get_ipython
except ImportError:
  raise Exception('This package requires an IPython notebook installation')

import datalab.context as _context

# Import the modules that do cell magics.
import datalab.bigquery.commands
import datalab.context.commands
import datalab.data.commands
import datalab.storage.commands
import datalab.utils.commands


_orig_request = _httplib2.Http.request
_orig_init = _requests.Session.__init__
_orig_run_cell_magic = _shell.InteractiveShell.run_cell_magic
_orig_run_line_magic = _shell.InteractiveShell.run_line_magic


def load_ipython_extension(shell):
  """
  Called when the extension is loaded.

  Args:
      shell - (NotebookWebApplication): handle to the Notebook interactive shell instance.
  """

  # Inject our user agent on all requests by monkey-patching a wrapper around httplib2.Http.request.

  def _request(self, uri, method="GET", body=None, headers=None,
               redirections=_httplib2.DEFAULT_MAX_REDIRECTS, connection_type=None):
    if headers is None:
      headers = {}
    headers['user-agent'] = 'GoogleCloudDataLab/1.0'
    return _orig_request(self, uri, method=method, body=body, headers=headers,
                         redirections=redirections, connection_type=connection_type)

  _httplib2.Http.request = _request

  # Similarly for the requests library.

  def _init_session(self):
    _orig_init(self)
    self.headers['User-Agent'] = 'GoogleCloudDataLab/1.0'

  _requests.Session.__init__ = _init_session

  # Be more tolerant with magics. If the user specified a cell magic that doesn't
  # exist and an empty cell body but a line magic with that name exists, run that
  # instead. Conversely, if the user specified a line magic that doesn't exist but
  # a cell magic exists with that name, run the cell magic with an empty body.

  def _run_line_magic(self, magic_name, line):
    fn = self.find_line_magic(magic_name)
    if fn is None:
      cm = self.find_cell_magic(magic_name)
      if cm:
        return _run_cell_magic(self, magic_name, line, None)
    return _orig_run_line_magic(self, magic_name, line)

  def _run_cell_magic(self, magic_name, line, cell):
    if len(cell) == 0 or cell.isspace():
      fn = self.find_line_magic(magic_name)
      if fn:
        return _orig_run_line_magic(self, magic_name, line)
      # IPython will complain if cell is empty string but not if it is None
      cell = None
    return _orig_run_cell_magic(self, magic_name, line, cell)

  _shell.InteractiveShell.run_cell_magic = _run_cell_magic
  _shell.InteractiveShell.run_line_magic = _run_line_magic

  # Define global 'project_id' and 'set_project_id' functions to manage the default project ID. We
  # do this conditionally in a try/catch # to avoid the call to Context.default() when running tests
  # which mock IPython.get_ipython().

  def _get_project_id():
    try:
      return _context.Context.default().project_id
    except Exception:
      return None

  def _set_project_id(project_id):
    context = _context.Context.default()
    context.set_project_id(project_id)

  try:
    if 'datalab_project_id' not in _IPython.get_ipython().user_ns:
      _IPython.get_ipython().user_ns['datalab_project_id'] = _get_project_id
      _IPython.get_ipython().user_ns['set_datalab_project_id'] = _set_project_id
  except TypeError:
    pass


def unload_ipython_extension(shell):
  _shell.InteractiveShell.run_cell_magic = _orig_run_cell_magic
  _shell.InteractiveShell.run_line_magic = _orig_run_line_magic
  _requests.Session.__init__ = _orig_init
  _httplib2.Http.request = _orig_request
  try:
    del _IPython.get_ipython().user_ns['project_id']
    del _IPython.get_ipython().user_ns['set_project_id']
  except Exception:
    pass  # We mock IPython for tests so we need this.
  # TODO(gram): unregister imports/magics/etc.
