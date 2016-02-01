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

"""Implements SQL statement helper functionality."""

import re
import types
import gcp._util


class SqlStatement(object):
  """A helper class for wrapping and manipulating SQL statements.
  """

  def __init__(self, sql, module=None):
    """ Initializes the SqlStatement.

    Args:
      sql: a string containing a SQL query with optional variable references.
      module: if defined in a %%sql cell, the parent SqlModule object for the SqlStatement.
    """
    self._sql = sql
    self._module = module

  def __str__(self):
    """Creates a string representation of this object.

    Returns:
      The string representation of this object.
    """
    return self._sql

  def __repr__(self):
    """Creates a friendly representation of this object.

    Returns:
      The friendly representation of this object.
    """
    return self._sql

  @property
  def sql(self):
    """ The (unexpanded) SQL for the SqlStatement. """
    return self._sql

  @property
  def module(self):
    """ The parent SqlModule for the SqlStatement, if any. """
    return self._module

  @staticmethod
  def _find_recursive_dependencies(sql, values, code, resolved_vars, resolving_vars=None):
    """ Recursive helper method for expanding variables including transitive dependencies.

    Placeholders in SQL are represented as $<name>. If '$' must appear within
    the SQL statement literally, then it can be escaped as '$$'.

    Args:
      sql: the raw SQL statement with named placeholders.
      values: the user-supplied dictionary of name/value pairs to use for placeholder values.
      code: an array of referenced UDFs found during expansion.
      resolved_vars: a ref parameter for the variable references completely resolved so far.
      resolving_vars: a ref parameter for the variable(s) we are currently resolving; if we see
          a dependency again that is in this set we know we have a circular reference.
    Returns:
      The formatted SQL statement with placeholders replaced with their values.
    Raises:
      Exception if a placeholder was found in the SQL statement, but did not
      have a corresponding argument value.
    """

    # Get the set of $var references in this SQL.
    dependencies = SqlStatement._get_dependencies(sql)
    for dependency in dependencies:
      # Now we check each dependency. If it is in complete - i.e., we have an expansion
      # for it already - we just continue.
      if dependency in resolved_vars:
        continue
      # Look it up in our resolution namespace dictionary.
      dep = gcp._util.get_item(values, dependency)
      # If it is a SQL module, get the main/last query from the module, so users can refer
      # to $module. Useful especially if final query in module has no DEFINE QUERY <name> part.
      if isinstance(dep, types.ModuleType):
        dep = _sql_module.SqlModule.get_default_query_from_module(dep)
      # If we can't resolve the $name, give up.
      if dep is None:
        raise Exception("Unsatisfied dependency $%s" % dependency)
      # If it is a SqlStatement, it may have its own $ references in turn; check to make
      # sure we don't have circular references, and if not, recursively expand it and add
      # it to the set of complete dependencies.
      if isinstance(dep, SqlStatement):
        if resolving_vars is None:
          resolving_vars = []
        elif dependency in resolving_vars:
          # Circular dependency
          raise Exception("Circular dependency in $%s" % dependency)
        resolving_vars.append(dependency)
        SqlStatement._find_recursive_dependencies(dep._sql, values, code, resolved_vars,
                                                  resolving_vars)
        resolving_vars.pop()
        resolved_vars[dependency] = SqlStatement(dep._sql)
      else:
        resolved_vars[dependency] = dep

  @staticmethod
  def _escape_string(s):
    return '"' + s.replace('"', '\\"') + '"'

  @staticmethod
  def format(sql, args=None, udfs=None):
    """ Resolve variable references in a query within an environment.

    This computes and resolves the transitive dependencies in the query and raises an
    exception if that fails due to either undefined or circular references.

    Args:
      sql: query to format.
      args: a dictionary of values to use in variable expansion.
      udfs: a list of UDFs referenced in the query.

    Returns:
      The resolved SQL text, and an array of any referenced UDFs.

    Raises:
      Exception on failure.
    """
    resolved_vars = {}
    code = []
    SqlStatement._find_recursive_dependencies(sql, args, code=code,
                                              resolved_vars=resolved_vars)

    # Rebuild the SQL string, substituting just '$' for escaped $ occurrences,
    # variable references substituted with their values, or literal text copied
    # over as-is.
    parts = []
    for (escape, placeholder, _, literal) in SqlStatement._get_tokens(sql):
      if escape:
        parts.append('$')
      elif placeholder:
        variable = placeholder[1:]
        try:
          value = resolved_vars[variable]
        except KeyError as e:
          raise Exception('Invalid sql. Unable to substitute $%s.' % e.args[0])

        if isinstance(value, types.ModuleType):
          value = _sql_module.SqlModule.get_default_query_from_module(value)

        if isinstance(value, SqlStatement):
          sql = value.format(value._sql, resolved_vars)
          value = '(%s)' % sql
        elif '_repr_sql_' in dir(value):
          # pylint: disable=protected-access
          value = value._repr_sql_()
        elif type(value) == str or type(value) == unicode:
          value = SqlStatement._escape_string(value)
        elif isinstance(value, list) or isinstance(value, tuple):
          if isinstance(value, tuple):
            value = list(value)
          expansion = '('
          for v in value:
            if len(expansion) > 1:
              expansion += ', '
            if type(v) == str or type(v) == unicode:
              expansion += SqlStatement._escape_string(v)
            else:
              expansion += str(v)
          expansion += ')'
          value = expansion
        else:
          value = str(value)
        parts.append(value)
      elif literal:
        parts.append(literal)

    expanded = ''.join(parts)
    return expanded

  @staticmethod
  def _get_tokens(sql):
    # Find escaped '$' characters ($$), "$<name>" variable references, lone '$' characters, or
    # literal sequences of character without any '$' in them (in that order).
    return re.findall(r'(\$\$)|(\$[a-zA-Z_][a-zA-Z0-9_\.]*)|(\$)|([^\$]*)', sql)

  @staticmethod
  def _get_dependencies(sql):
    """ Return the list of variables referenced in this SQL. """
    dependencies = []
    for (_, placeholder, dollar, _) in SqlStatement._get_tokens(sql):
      if placeholder:
        variable = placeholder[1:]
        if variable not in dependencies:
          dependencies.append(variable)
      elif dollar:
        raise Exception('Invalid sql; $ with no following $ or identifier: %s.' % sql)
    return dependencies

import _sql_module
