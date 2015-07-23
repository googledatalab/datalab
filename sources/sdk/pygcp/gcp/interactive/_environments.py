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


import json as _json
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


def _resolve(arg):
  # Given an argument value, resolve it. This basically means check if it is a value
  # (and then just return it) or a reference to a variable (in which case look up the
  # value and return it).
  if len(arg) == 0:
    return ''
  # If quoted, its a string
  if arg[0] == "'" or arg[0] == '"':
    return arg
  # If it starts with underscore or a letter, treat it as a variable
  if arg[0] == '_' or arg[0].isalpha():
    if arg in _notebook_environment():
      val = _notebook_environment()[arg]
      if isinstance(val, basestring):
        return _json.dumps(val)
      elif isinstance(val, _bq._Table):
        return val.full_name
      else:
        return val
  # else treat it as a literal (should be a number)
  return arg


def _get_resolution_environment(unit, query, args=None):
  # Update using arguments including default values
  # The args must be of the form of a list of strings each being of the form 'name=value' or
  # 'name', 'value'.
  # argparse.REMAINDER is broken when using subcommands if the extra arguments are
  # optional; they must be positional. So we enforce that form and then add '--' back.

  # Only named queries have argument parsers etc.
  env = {}
  if unit is None:
    return env

  if args:
    new_args = []
    next_is_value = False
    for arg in args:
      if next_is_value:
        new_args.append(_resolve(arg))
        next_is_value = False
      else:
        split = arg.find('=')
        if split < 0:
          next_is_value = True
          new_args.append('--%s' % arg)
        else:
          new_args.append('--%s' % arg[:split])
          new_args.append(_resolve(arg[split + 1:]))
    args = new_args

  env.update(unit.definitions)
  env.update(_get_sql_args(unit.arg_parser, args))
  return env

