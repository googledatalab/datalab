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

"""Implementation of various module magics"""

import sys as _sys
import types as _types
import IPython as _ipython
import IPython.core.magic as _magic
from ._commands import CommandParser as _CommandParser

@_magic.register_line_cell_magic
def pymodule(line, cell=None):
  """Creates and subsequently auto-imports a python module.
  """
  parser = _CommandParser.create('pymodule')
  parser.add_argument('-n', '--name',
                      help='the name of the python module to create and import')

  args = parser.parse(line)
  if args is not None:
    if cell is None:
      print 'The code for the module must be included'
      return

    name = str(args['name'])
    module = _create_python_module(name, cell)

    # Automatically import the newly created module by assigning it to a variable
    # named the same name as the module name.
    ipy = _ipython.get_ipython()
    ipy.push({ name: module })

def _create_python_module(name, code):
  # By convention the module is associated with a file name matching the module name
  module = _types.ModuleType(name)
  module.__file__ = name
  module.__name__ = name

  exec code in module.__dict__

  # Hold on to the module if the code executed successfully
  _sys.modules[name] = module
  return module
