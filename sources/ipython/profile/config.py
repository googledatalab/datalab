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

"""IPython configuration customization."""

import os

# Get a reference to the configuration object.
c = get_config()

# Implicitly imported packages.
c.InteractiveShellApp.extensions = [
  'gcp.interactive'
]


# Startup code.
c.InteractiveShellApp.exec_lines = [
]


# Static files to override the default custom script and stylesheet, as well as include a
# special location created in the docker container to enable the user to add static files.
c.NotebookApp.extra_static_paths = [
  os.path.join(os.path.dirname(__file__), 'static'),
  '/env/static'
]


# Custom notebook manager
env = os.environ.get('IPYTHON_ENV', '')
if env == 'cloud':
  c.NotebookApp.notebook_manager_class = 'IPythonExtensions.gcp.StorageNotebookManager'
elif env == 'memory':
  c.NotebookApp.notebook_manager_class = 'IPythonExtensions.gcp.MemoryNotebookManager'


# Allow any origin to connect to sockets
c.NotebookApp.allow_origin = '*'


# Development mode support
if os.environ.get('IPYTHON_DEBUG', '') != '':
  c.NotebookApp.log_level = 'DEBUG'

# Trust all our notebooks for now.
# TODO(gram): Remove before GA (see issue 314)
import IPython.nbformat.sign as _sign
_sign.NotebookNotary.check_signature = lambda self, nb: True
