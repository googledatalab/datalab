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

"""Implementation of various module magics"""

import sys
import types
import IPython
import IPython.core.magic
import _commands
import _utils


@IPython.core.magic.register_line_cell_magic
def pymodule(line, cell=None):
  """Creates and subsequently auto-imports a python module.

  Args:
    line: the magic line.
    cell: the cell body.
  """
  parser = _commands.CommandParser.create('pymodule')
  parser.add_argument('-n', '--name',
                      help='the name of the python module to create and import')
  parser.set_defaults(func=_pymodule_cell)
  return _utils.handle_magic_line(line, cell, parser)


def _pymodule_cell(args, cell):
  if cell is None:
      raise Exception('The code for the module must be included')

  name = args['name']
  module = _create_python_module(name, cell)

  # Automatically import the newly created module by assigning it to a variable
  # named the same name as the module name.
  ipy = IPython.get_ipython()
  ipy.push({name: module})


def _create_python_module(name, code):
  # By convention the module is associated with a file name matching the module name
  module = types.ModuleType(name)
  module.__file__ = name
  module.__name__ = name

  exec code in module.__dict__

  # Hold on to the module if the code executed successfully
  sys.modules[name] = module
  return module
