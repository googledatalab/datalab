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

"""Helper functions for %%sql modules."""

import shlex
import types


# It would be nice to be able to inherit from Python module but AFAICT that is not possible.
# So this just wraps a bunch of static helpers.

class SqlModule(object):
  """ A container for SqlStatements defined together and able to reference each other. """

  # Names used for the arg parser, unnamed (main) query and last query in the module.
  # Note that every module has a last query, but not every module has a main query.

  _SQL_MODULE_ARGPARSE = '_sql_module_arg_parser'
  _SQL_MODULE_MAIN = '_sql_module_main'
  _SQL_MODULE_LAST = '_sql_module_last'

  @staticmethod
  def _get_sql_args(parser, args=None):
    """ Parse a set of %%sql arguments or get the default value of the arguments.

    Args:
      parser: the argument parser to use.
      args: the argument flags. May be a string or a list. If omitted the empty string is used so
          we can get the default values for the arguments. These are all used to override the
          arg parser. Alternatively args may be a dictionary, in which case it overrides the
          default values from the arg parser.
    Returns:
      A dictionary of argument names and values.
    """
    overrides = None
    if args is None:
      tokens = []
    elif isinstance(args, basestring):
      command_line = ' '.join(args.split('\n'))
      tokens = shlex.split(command_line)
    elif isinstance(args, dict):
      overrides = args
      tokens = []
    else:
      tokens = args

    args = vars(parser.parse_args(tokens)) if parser else {}
    if overrides:
      args.update(overrides)

    # Don't return any args that are None as we don't want to expand to 'None'
    return {arg: value for arg, value in args.iteritems() if value is not None}

  @staticmethod
  def get_default_query_from_module(module):
    """ Given a %%sql module return the default (last) query for the module.

    Args:
      module: the %%sql module.

    Returns:
      The default query associated with this module.
    """
    if isinstance(module, types.ModuleType):
      return module.__dict__.get(SqlModule._SQL_MODULE_LAST, None)
    return None

  @staticmethod
  def get_sql_statement_with_environment(item, args=None):
    """ Given a SQLStatement, string or module plus command line args or a dictionary,
     return a SqlStatement and final dictionary for variable resolution.

    Args:
      item: a SqlStatement, %%sql module, or string containing a query.
      args: a string of command line arguments or a dictionary of values.

    Returns:
      A SqlStatement for the query or module, plus a dictionary of variable values to use.
    """
    if isinstance(item, basestring):
      item = _sql_statement.SqlStatement(item)
    elif not isinstance(item, _sql_statement.SqlStatement):
      item = SqlModule.get_default_query_from_module(item)
      if not item:
        raise Exception('Expected a SQL statement or module but got %s' % str(item))

    env = {}
    if item.module:
      env.update(item.module.__dict__)
      parser = env.get(SqlModule._SQL_MODULE_ARGPARSE, None)
      if parser:
        args = SqlModule._get_sql_args(parser, args=args)
      else:
        args = None

    if isinstance(args, dict):
      env.update(args)

    return item, env

  @staticmethod
  def expand(sql, args=None, udfs=None):
    """ Expand a SqlStatement, query string or SqlModule with a set of arguments.

    Args:
      sql: a SqlStatement, %%sql module, or string containing a query.
      args: a string of command line arguments or a dictionary of values. If a string, it is
          passed to the argument parser for the SqlModule associated with the SqlStatement or
          SqlModule. If a dictionary, it is used to override any default arguments from the
          argument parser. If the sql argument is a string then args must be None or a dictionary
          as in this case there is no associated argument parser.
      udfs: a list of UDFs referenced in the query. This supplements args but does not replace
          args, as we want to support passing in UDFs via cell config in magics (which happens
          with args).
    Returns:
      The expanded SQL, list of referenced scripts, and list of referenced external tables.
    """
    sql, args = SqlModule.get_sql_statement_with_environment(sql, args)
    return _sql_statement.SqlStatement.format(sql._sql, args, udfs)


import _sql_statement
