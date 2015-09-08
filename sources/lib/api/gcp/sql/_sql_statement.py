# Copyright 2014 Google Inc. All rights reserved.
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

"""Implements SQL statement helper functionality."""

import re
import types
import gcp._util


class SqlStatement(object):
  """A helper class for wrapping and manipulating SQL statements.
  """

  def __init__(self, sql, module=None):
    self._sql = sql
    self._module = module

  def _repr_sql_(self, args=None):
    """Creates a SQL representation of this object.

    Args:
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      The SQL representation to use when embedding this object into SQL.
    """
    return '(%s)' % SqlStatement.format(self._sql, args)

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
    return self._sql

  @property
  def module(self):
    return self._module

  @staticmethod
  def _expand(sql, ns, complete, in_progress):
    """ Recursive helper method for expanding variables including transitive dependencies.

    Placeholders in SQL are represented as $<name>. If '$' must appear within
    the SQL statement literally, then it can be escaped as '$$'.

    Args:
      sql: the raw SQL statement with named placeholders.
      ns: the dictionary of name/value pairs to use for placeholder values.
      complete: a ref parameter for the references expanded so far
      in_progress: a ref parameter for the references that still need expansion.
    Returns:
      The formatted SQL statement with placeholders replaced with their values.
    Raises:
      Exception if a placeholder was found in the SQL statement, but did not
      have a corresponding argument value.
    """

    # Get the set of $var references in this SQL.
    dependencies = SqlStatement.get_dependencies(sql)
    for dependency in dependencies:
      # Now we check each dependency. If it is in complete - i.e., we have an expansion
      # for it already - we just continue.
      if dependency in complete:
        continue
      # Look it up in our resolution namespace dictionary.
      dep = gcp._util.get_item(ns, dependency)
      # If it is a SQL module, get the main/last query from the module, so users can refer
      # to $module. Useful especially if final query in module has no DEFINE QUERY <name> part.
      if isinstance(dep, types.ModuleType):
        dep = _sql_module.SqlModule.get_query_from_module(dep)
      # If we can't resolve the $name, give up.
      if dep is None:
        raise Exception("Unsatisfied dependency $%s" % dependency)
      # If it is a SqlStatement, it may have its own $ references in turn; check to make
      # sure we don't have circular references, and if not, recursively expand it and add
      # it to the set of complete dependencies.
      if isinstance(dep, SqlStatement):
        if dependency in in_progress:
          # Circular dependency
          raise Exception("Circular dependency in $%s" % dependency)
        in_progress.append(dependency)
        expanded = SqlStatement._expand(dep._sql, ns, complete, in_progress)
        in_progress.pop()
        complete[dependency] = SqlStatement(expanded)
      else:
        complete[dependency] = dep

    # Rebuild the SQL string, substituting just '$' for escaped $ occurrences,
    # variable references substituted with their values, or literal text copied
    # over as-is.
    parts = []
    for (escape, placeholder, literal) in SqlStatement._get_tokens(sql):
      if escape:
        parts.append('$')
      elif placeholder:
        variable = placeholder[1:]
        try:
          value = complete[variable]
        except KeyError as e:
          raise Exception('Invalid sql. Unable to substitute $%s.' % e.args[0],
                          e.args[0])

        if isinstance(value, types.ModuleType):
          value = _sql_module.SqlModule.get_query_from_module(value)

        if '_repr_sql_' in dir(value):
          # pylint: disable=protected-access
          value = value._repr_sql_(complete)
        elif (type(value) == str) or (type(value) == unicode):
          value = '"' + value.replace('"', '\\"') + '"'
        else:
          value = str(value)
        parts.append(value)
      elif literal:
        parts.append(literal)

    return ''.join(parts)

  @staticmethod
  def format(sql, args=None):
    """ Resolve variable references in a query within an environment.

    This computes and resolves the transitive dependencies in the query and raises an
    exception if that fails due to either undefined or circular references.

    Args:
      sql: query to format.
      args: a dictionary of values to use in variable expansion.

    Returns:
      The resolved SQL text.

    Raises:
      Exception on failure.
    """
    return SqlStatement._expand(sql, args, complete={}, in_progress=[])

  @staticmethod
  def _get_tokens(sql):
    # Find escaped '$' characters ($$), or "$<name>" variable references, or
    # literal sequences of character without any '$' in them (in that order).
    return re.findall(r'(\$\$)|(\$[a-zA-Z0-9_\.]+)|([^\$]*)', sql)

  @staticmethod
  def get_dependencies(sql):
    """ Return the list of tokens referenced in this SQL. """
    dependencies = []
    for (_, placeholder, _) in SqlStatement._get_tokens(sql):
      if placeholder:
        variable = placeholder[1:]
        if variable not in dependencies:
          dependencies.append(variable)
    return dependencies

import _sql_module
