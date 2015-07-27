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

# Use inline matplotlib
c.IPKernelApp.matplotlib = 'inline'

# Implicitly imported packages.
c.IPKernelApp.extensions = [ 'gcp.interactive' ]

c.InteractiveShellApp.extensions = [
  'gcp.interactive'
]


# Startup code.
c.IPKernelApp.exec_lines = []


# Static files to override the default custom script and stylesheet, as well as include a
# special location created in the docker container to enable the user to add static files.
c.NotebookApp.extra_static_paths = [ os.path.join(os.path.dirname(__file__), 'static') ]


# Allow any origin to connect to sockets
c.NotebookApp.allow_origin = '*'


# Debug mode support
c.NotebookApp.log_level = 'DEBUG'

# Custom notebook manager
c.NotebookApp.notebook_manager_class = 'IPythonExtensions.gcp.DataLabContentsManager'

# Trust all notebooks, i.e. do not bind them to one host.
import IPython.nbformat.sign as _sign
_sign.NotebookNotary.check_signature = lambda self, nb: True
