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


class Sql(object):
  """A helper class for wrapping and manipulating SQL statements.
  """

  def __init__(self, sql):
    self._sql = sql

  @staticmethod
  def _get_tokens(sql):
    # Find escaped '$' characters ($$), or "$<name>" variable references, or
    # literal sequences of character without any '$' in them (in that order).
    return re.findall(r'(\$\$)|(\$[a-zA-Z0-9_]+)|([^\$]*)', sql)

  @staticmethod
  def get_dependencies(sql):
    """ Return the list of tokens referenced in this SQL. """
    dependencies = []
    for (_, placeholder, _) in Sql._get_tokens(sql):
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
    for (escape, placeholder, literal) in Sql._get_tokens(sql):
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
      sampling = _util._Sampling.default(count=count, fields=fields)
    return sampling(sql)
