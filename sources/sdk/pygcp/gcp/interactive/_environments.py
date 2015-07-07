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
    module.__dict__[_pipeline_arg_parser] = _CommandParser.create('bigquery run')
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
  look in pipeline environment and return a resolved query if possible.
  """
  q = _get_notebook_item(name)
  if q is None:
    q = _pipeline_environment()[_pipeline_sql].get(name, None)
    #if isinstance(q, _bq._Query):
    #  complete, partial = _get_notebook_resolution_environment()
    #  q = _resolve(q.sql, complete, partial)
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


def _get_pipeline_resolution_environment(env=None):
  """ Get the key/val dictionary for resolving metavars in the pipeline environment.

  An initial dictionary can be supplied in which case it will be augmented with new
  names but existing names will not be replaced. Any objects in the initial dictionary
  must already be fully resolved wrt variable references.
  """
  partial = {}
  complete = {}
  if env is not None:
    complete.update(env)

  # TODO(gram): we should really report/handle any name collisions between bqmodule UDFs, args
  # and SQL queries/sources. These currently logically exist in three separate
  # namespaces so ambiguity is possible. A simple solution for UDFs vs SQL is to always
  # try do a remove of a name from one when defining the name in the other. For args it
  # should just be an error if we try define a UDF/query/source object with the same name
  # as an arg.

  # Add the default arguments from the pipeline environment if they aren't defined
  complete.update({key: value for key, value in _get_pipeline_args().iteritems()
                   if key not in complete and value is not None})

  # Add any UDFs from the pipeline environment
  complete.update({key: value
                   for key, value in _pipeline_environment()[_pipeline_udfs].iteritems()
                   if key not in complete})

  # Add any sources and queries from the pipeline environment. These need to go through
  # variable resolution so are put in the partial dictionary.
  partial.update({key: value
                  for key, value in _pipeline_environment()[_pipeline_sql].iteritems()
                  if key not in complete})

  return complete, partial


def _get_notebook_resolution_environment():
  """ Get the key/val dictionary For resolving metavars in the pipeline environment.

  This is the IPython user environment augmented with the pipeline environment.
  """
  ipy = _ipython.get_ipython()
  return _get_pipeline_resolution_environment(ipy.user_ns)


def _resolve(sql, complete, partial):
  """ Resolve variable references in a query within an environment.

  This computes and resolves the transitive dependencies in the query and raises an
  exception if that fails due to either undefined or circular references.

  Args:
    sql: the text of the query to resolve
    complete: definitions of objects that can be expanded but which have no
      dependencies themselves (and so must NOT go through expansion to avoid corrupting
      their content)
    partial: definitions of bqmodule sql queries which may need to be expanded themselves.

  Returns:
    A resolved Query object.

  Raises:
    Exception on failure.
  """
  dependencies = _util.Sql.get_dependencies(sql)
  while len(dependencies) > 0:
    changed = False
    for i, dependency in enumerate(dependencies):
      if dependency in complete:
        # Has no further dependencies; remove it from dependencies.
        dependencies[i] = None
        changed = True
      elif dependency in partial:
        # Get the transitive dependencies.
        sql = partial[dependency].sql
        deps = _util.Sql.get_dependencies(sql)
        # If there are none or they are all in turn complete, then this is completable.
        if len(deps) == 0 or all([d in complete for d in deps]):
          # Expand and move to complete, and remove from partial and dependencies.
          complete[dependency] = _bq.query(_bq.sql(sql, **complete))
          partial.pop(dependency)
          dependencies[i] = None
          changed = True
        else:
          # Add all non-complete references to dependencies for next iteration.
          newdeps = [dep for dep in deps if dep not in complete and dep not in dependencies]
          if len(newdeps):
            changed = True
            dependencies.extend(newdeps)
      else:
        raise Exception("Unsatisfied dependency %s" % dependency)

    dependencies = [dependency for dependency in dependencies if dependency is not None]
    if not changed:
      # We just have dependencies left that are in partial but that can't be satisfied so
      # they must be circular.
      raise Exception('Circular dependencies in set %s' % str(dependencies))

  query = _bq.query(_bq.sql(sql, **complete))
  return query

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
