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

"""A collection of SQL statements and parameters."""

import collections
import shlex

from ._sql_statement import SqlStatement


QueryDefinition = collections.namedtuple('QueryDefinition', ['name', 'sql'])

class SqlUnit(object):

  def __init__(self, arg_parser, definitions):
    self.arg_parser = arg_parser
    self.definitions = {}
    if not definitions:
      definitions = []
    for query_definition in definitions:
      name = query_definition.name
      sql = SqlStatement(query_definition.sql, unit=self)
      self.last_name = name
      self.last_sql = self.__dict__[name] = self.definitions[name] = sql

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

    args = vars(parser.parse_args(tokens))
    if overrides:
      args.update(overrides)

    # Don't return any args that are None as we don't want to expand to 'None'
    return {arg: value for arg, value in args.iteritems() if value is not None}

  def _get_resolution_environment(self, args=None):
    # Update using arguments including default values, overridden by code.
    # Only named queries have argument parsers etc.
    env = {}
    env.update(self.definitions)
    env.update(SqlUnit._get_sql_args(self.arg_parser, args=args))
    return env
