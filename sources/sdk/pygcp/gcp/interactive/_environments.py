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
    # Initialize the bqmodule arg parser.
    module.__dict__[_pipeline_arg_parser] = _CommandParser.create('query')
  else:
    module = _sys.modules[_pipeline_module]
  return module.__dict__


def _exec_in_pipeline_module(code):
  """ Execute code contained in a string within the pipeline module. """
  exec code in _pipeline_environment()


def _get_notebook_item(name):
  """ Get an item from the IPython environment. """
  return _notebook_environment().get(name, None)


def _get_pipeline_args(args=None, explicit_only=False):
  """ Parse a set of pipeline arguments or get the default value of the arguments.

  Args:
    args: the argument flags. May be a string or a list. If omitted the empty string is used so
        we can get the default values for the arguments.
    default_to_none: if True, we ignore the defaults and only return args that were
        explicitly specified.
  """
  if args is None:
    tokens = []
  elif isinstance(args, basestring):
    command_line = ' '.join(args.split('\n'))
    tokens = _shlex.split(command_line)
  else:
    tokens = args

  parser = _pipeline_environment()[_pipeline_arg_parser]
  args = vars(parser.parse_args(tokens))

  if explicit_only:
    # Figure out which args were explicitly specified.
    allowed = []
    for token in tokens:
      if token[:2] == '--':
        # Get the name without leading '--' and optional trailing '=<value>'
        arg_name = token[2:].split('=')[0]
        allowed.append(arg_name)
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


def _get_resolution_environment(args, is_pipeline):
  env = {}
  # TODO(gram): For is_pipeline case, we may want to restrict the update below to be only
  # things defined in magics.
  # It depends on how we will be generating the JSON pipeline representation for DataMatic.
  env.update(_notebook_environment())
  # Update using arguments including default values
  # The args must be of the form of a list of strings each being of the form 'name=value' or
  # 'name', 'value'.
  # argparse.REMAINDER is broken when using subcommands if the extra arguments are
  # optional; they must be positional. So we enforce that form and then add '--' back.
  if args:
    new_args = []
    next_is_value = False
    for arg in args:
      if next_is_value:
        new_args.append(arg)
        next_is_value = False
      else:
        new_args.append('--%s' % arg)
        if arg.find('=') > 0:
          next_is_value = True
    args = new_args

  pargs = _get_pipeline_args(args, explicit_only=not is_pipeline)
  env.update(pargs)
  return env

def _get_notebook_resolution_environment(args=None):
  return _get_resolution_environment(args, is_pipeline=False)


def _get_pipeline_resolution_environment(args=None):
  return _get_resolution_environment(args, is_pipeline=True)

