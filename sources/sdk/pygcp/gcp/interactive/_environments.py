# Copyright 2015 Google Inc. All rights reserved.
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

"""Google Cloud Platform library - multi-environment handling. """


import shlex as _shlex
import sys as _sys
import types as _types
import IPython as _ipython
import gcp.bigquery as _bq
import gcp._util as _util
from ._commands import CommandParser as _CommandParser

# Some string literals used for binding names in the environment.
_pipeline_module = '_gcp_pipeline'
_pipeline_arg_parser = '_arg_parser'
_pipeline_sql = '_sql'
_pipeline_udfs = '_udfs'


def _notebook_environment():
  ipy = _ipython.get_ipython()
  return ipy.user_ns


def _pipeline_environment():
  """ Get the environment dictionary for bqmodule magics, creating it if needed. """
  if _pipeline_module not in _sys.modules:
    # Create the pipeline module.
    module = _types.ModuleType(_pipeline_module)
    module.__file__ = _pipeline_module
    module.__name__ = _pipeline_module
    _sys.modules[_pipeline_module] = module
    # Automatically import the newly created module by assigning it to a variable
    # named the same name as the module name.
    _notebook_environment()[_pipeline_module] = module
    # Initialize the bqmodule arg parser and source, udf and query dictionaries
    module.__dict__[_pipeline_arg_parser] = _CommandParser.create('query')
    module.__dict__[_pipeline_udfs] = {}
    module.__dict__[_pipeline_sql] = {}
  else:
    module = _sys.modules[_pipeline_module]
  return module.__dict__


def _exec_in_pipeline_module(code):
  """ Execute code contained in a string within the pipeline module. """
  exec code in _pipeline_environment()


def _bind_name_in_notebook_environment(name, value):
  """ Bind a name to a value in the IPython notebook environment. """
  ipy = _ipython.get_ipython()
  ipy.push({name: value})


def _get_pipeline_item(name):
  """ Get an item from the pipeline environment. """
  return _pipeline_environment().get(name, None)


def _get_notebook_item(name):
  """ Get an item from the IPython environment. """
  return _notebook_environment().get(name, None)

def _get_query(name):
  """ Get a query bound to variable name.

  This will look in IPython environment first. If name is not defined there it will
  look in pipeline environment.
  """
  q = _get_notebook_item(name)
  if q is None:
    q = _pipeline_environment()[_pipeline_sql].get(name, None)
  return q


def _get_pipeline_args(cell=None, explicit_only=False):
  """ Parse a set of pipeline arguments or get the default value of the arguments.

  Args:
    cell: the cell containing the argument flags. If omitted the empty string is used so
        we can get the default values for the arguments.
    default_to_none: if True, we ignore the defaults and only return args that were
        explicitly specified.
  """
  if cell is None:
    cell = ''
  parser = _get_pipeline_item(_pipeline_arg_parser)
  command_line = ' '.join(cell.split('\n'))
  tokens = _shlex.split(command_line)
  args = vars(parser.parse_args(tokens))

  if explicit_only:
    allowed = []
    for token in tokens:
      if token[:2] == '--':
        allowed.append(token[2:])
    # Don't return any args that are None as we don't want to expand to 'None'
    return {arg: value for arg, value in args.iteritems() if value is not None and arg in allowed}
  else:
    # Don't return any args that are None as we don't want to expand to 'None'
    return {arg: value for arg, value in args.iteritems() if value is not None}


# An LRU cache for Tables. This is mostly useful so that when we cross page boundaries
# when paging through a table we don't have to re-fetch the schema.
_table_cache = _util.LRUCache(10)


def _get_table(name):
  """ Given a variable or table name, get a Table if it exists.

  Args:
    name: the name of the Table or a variable referencing the Table.
  Returns:
    The Table, if found.
  """
  # If name is a variable referencing a table, use that.
  item = _get_notebook_item(name)
  if item is None:
    item = _get_pipeline_item(name)

  if isinstance(item, _bq._Table):
    return item
  # Else treat this as a BQ table name and return the (cached) table if it exists.
  try:
    return _table_cache[name]
  except KeyError:
    table = _bq.table(name)
    if table.exists():
      _table_cache[name] = table
      return table
  return None


def _get_schema(name):
  """ Given a variable or table name, get the Schema if it exists. """
  item = _get_notebook_item(name)
  if not item:
    item = _get_table(name)

  if isinstance(item, _bq._Schema):
    return item
  try:
    if isinstance(item.schema, _bq._Schema):
      return item.schema
  except AttributeError:
    return None
