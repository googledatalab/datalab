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

"""Helper functions for %%sql modules."""

import re
import shlex
import types


# It would be nice to be able to inherit from Python module but AFAICT that is not possible.
# So this just wraps a bunch of static helpers.

class SqlModule(object):

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
  def get_query_from_module(module):
    if isinstance(module, types.ModuleType):
      if SqlModule._SQL_MODULE_MAIN in module.__dict__:
        return module.__dict__[SqlModule._SQL_MODULE_MAIN]
      else:
        return module.__dict__.get(SqlModule._SQL_MODULE_LAST, None)
    return None

  @staticmethod
  def get_sql_statement_with_environment(item, args=None):
    """ Given a SQLStatement, string or module plus command line args or a dictionary,
     return a SqlStatement and final dictionary for variable resolution.

    Args:
      item: a SqlStatement, %%sql module, or string containing a query
      args: a string of command line arguments or a dictionary of values

    Returns:
      A SqlStatement for the query or module, plus a dictionary of variable values to use.
    """
    if isinstance(item, basestring):
      item = SqlStatement(item)
    elif not isinstance(item, SqlStatement):
      item = SqlModule.get_query_from_module(item)
      if not item:
        raise Exception('Expected a SQL statement or module')

    env = {}
    if item.module:
      env.update(item.module.__dict__)
      args = SqlModule._get_sql_args(
        env.get(SqlModule._SQL_MODULE_ARGPARSE, None), args=args)

    if isinstance(args, dict):
      env.update(args)

    return item, env

  @staticmethod
  def expand(sql, args=None):
    sql, args = SqlModule.get_sql_statement_with_environment(sql, args)
    return SqlStatement._format(sql._sql, args)

  @staticmethod
  def split_cell(cell, module):
    """ Split a %%sql cell into the Python code and the queries.

    Populate the module with the queries and return the Python code.
    """
    lines = cell.split('\n')
    code = None
    last_def = -1
    name = None
    define_re = \
      re.compile('^DEFINE\s+QUERY\s+([A-Z]\w*)\s*?(.*)$', re.IGNORECASE)
    select_re = re.compile('^SELECT\s*.*$', re.IGNORECASE)
    for i, line in enumerate(lines):
      # Strip comment lines; doing this here means we can allow comments in SQL QUERY sections too.
      if len(line) and line[0] == '#':
        continue
      define_match = define_re.match(line)
      select_match = select_re.match(line)
      if define_match or select_match:
        # If this is the first query, get the preceding Python code.
        if code is None:
          code = ('\n'.join(lines[:i])).strip()
          if len(code):
            code += '\n'
        elif last_def >= 0:

          # This is not the first query, so gather the previous query text.
          query = '\n'.join([line for line in lines[last_def:i] if len(line) and line[0] != '#']) \
            .strip()
          if select_match and name != SqlModule._SQL_MODULE_MAIN and len(query) == 0:
            # Avoid DEFINE query name\nSELECT ... being seen as an empty DEFINE followed by SELECT
            continue

          # Save the query
          statement = SqlStatement(query, module)
          module.__dict__[name] = statement
          # And set the 'last' query to be this too
          module.__dict__[SqlModule._SQL_MODULE_LAST] = statement

        # Get the query name and strip off our syntactic sugar if appropriate.
        if define_match:
          name = define_match.group(1)
          lines[i] = define_match.group(2)
        else:
          name = SqlModule._SQL_MODULE_MAIN

        # Save the starting line index of the new query
        last_def = i

    if last_def >= 0:
      # We were in a query so save this tail query.
      query = '\n'.join([line for line in lines[last_def:] if len(line) and line[0] != '#']).strip()
      statement = SqlStatement(query, module)
      module.__dict__[name] = statement
      module.__dict__[SqlModule._SQL_MODULE_LAST] = statement

    if code is None:
      code = ''
    return code

  @staticmethod
  def set_arg_parser(module, parser):
    module.__dict__[SqlModule._SQL_MODULE_ARGPARSE] = parser

from ._sql_statement import SqlStatement
