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

# Some string literals used for binding names in the environment.
_pipeline_module = '_gcp_pipeline'
_pipeline_arg_parser = '_arg_parser'


def _notebook_environment():
  ipy = _ipython.get_ipython()
  return ipy.user_ns


def _get_module(name):
  """ Create or retrieve a named module and return its environment. """
  if name not in _sys.modules:
    # Create the pipeline module.
    module = _types.ModuleType(name)
    module.__file__ = name
    module.__name__ = name
    _sys.modules[name] = module
    # Automatically import the newly created module by assigning it to a variable
    # named the same name as the module name.
    _notebook_environment()[name] = module
  else:
    module = _sys.modules[name]
  return module.__dict__


def _get_notebook_item(name):
  """ Get an item from the IPython environment. """
  return _notebook_environment().get(name, None)


def _get_sql_args(parser, args=None):
  """ Parse a set of %%sql arguments or get the default value of the arguments.

  Args:
    parser: the argument parser to use.
    args: the argument flags. May be a string or a list. If omitted the empty string is used so
        we can get the default values for the arguments.
  """
  if args is None:
    tokens = []
  elif isinstance(args, basestring):
    command_line = ' '.join(args.split('\n'))
    tokens = _shlex.split(command_line)
  else:
    tokens = args

  args = vars(parser.parse_args(tokens))

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


def _get_resolution_environment(unit, code=None):
  # Update using arguments including default values, overridden by code.
  # Only named queries have argument parsers etc.
  env = {}
  if unit:
    env.update(unit.definitions)
    env.update(_get_sql_args(unit.arg_parser))
  if code:
    env.update(_notebook_environment())
    exec code in env
  return env

