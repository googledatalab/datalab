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
import sys

from ._sampling import Sampling as _Sampling


class SqlStatement(object):
  """A helper class for wrapping and manipulating SQL statements.
  """

  def __init__(self, sql):
    if isinstance(sql, SqlStatement):
      sql = sql._sql
    self._sql = sql

  def _repr_sql_(self, args=None):
    """Creates a SQL representation of this object.

    Args:
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      The SQL representation to use when embedding this object into SQL.
    """
    return '(%s)' % self.expand(args)

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

  def _expand(self, sql, ns, complete, in_progress):
    """ Recursive helper method for expanding variables including transitive dependencies. """

    dependencies = SqlStatement.get_dependencies(sql)
    for dependency in dependencies:
      if dependency in complete:
        continue
      if dependency not in ns:
        raise Exception("Unsatisfied dependency $%s" % dependency)
      dep = ns[dependency]
      if isinstance(dep, SqlStatement):
        if dependency in in_progress:
          # Circular dependency
          raise Exception("Circular dependency in $%s" % dependency)
        in_progress.append(dependency)
        expanded = self._expand(dep._sql, ns, complete, in_progress)
        in_progress.pop()
        complete[dependency] = SqlStatement(expanded)
      else:
        complete[dependency] = dep
    return SqlStatement.format(sql, complete)

  def expand(self, args=None):
    """ Resolve variable references in a query within an environment.

    This computes and resolves the transitive dependencies in the query and raises an
    exception if that fails due to either undefined or circular references.

    Args:
      args: a dictionary of values to use in variable expansion.

    Returns:
      The resolved SQL text.

    Raises:
      Exception on failure.
    """
    # If we weren't given an explicit set of args (including empty dict), then resolve
    # against the current execution environment.
    ns = args if args else sys.modules['__main__'].__dict__
    return self._expand(self._sql, ns, complete={}, in_progress=[])

  @staticmethod
  def _get_tokens(sql):
    # Find escaped '$' characters ($$), or "$<name>" variable references, or
    # literal sequences of character without any '$' in them (in that order).
    return re.findall(r'(\$\$)|(\$[a-zA-Z0-9_]+)|([^\$]*)', sql)

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

  @staticmethod
  def format(sql, args):
    """Formats SQL statements by replacing named tokens with actual values.

    Placeholders in SQL are represented as $<name>. If '$' must appear within
    the SQL statement literally, then it can be escaped as '$$'.

    Args:
      sql: the raw SQL statement with named placeholders.
      args: the dictionary of name/value pairs to use for placeholder values.
    Returns:
      The formatted SQL statement with placeholders replaced with their values.
    Raises:
      Exception if a placeholder was found in the SQL statement, but did not
      have a corresponding argument value.
    """

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
          value = args[variable]
        except KeyError as e:
          raise Exception('Invalid sql. Unable to substitute $%s.' % e.args[0],
                          e.args[0])

        if '_repr_sql_' in dir(value):
          # pylint: disable=protected-access
          value = value._repr_sql_(args)
        elif (type(value) == str) or (type(value) == unicode):
          value = '"' + value.replace('"', '\\"') + '"'
        else:
          value = str(value)
        parts.append(value)
      elif literal:
        parts.append(literal)

    return ''.join(parts)

  @staticmethod
  def sampling_query(sql, fields=None, count=5, sampling=None):
    """Returns a sampling Query for the SQL object.

    Args:
      api: the BigQuery API object to use to issue requests.
      sql: the SQL object to sample
      fields: an optional list of field names to retrieve.
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the table.
    Returns:
      A Query object for sampling the table.
    """
    if sampling is None:
      sampling = _Sampling.default(count=count, fields=fields)
    return sampling(sql)
