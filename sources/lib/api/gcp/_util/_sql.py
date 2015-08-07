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
  """A helper class for formatting SQL statements.
  """

  def __init__(self):
    pass

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

    # Find escaped '$' characters ($$), or "$<name>" variable references, or
    # literal sequences of character without any '$' in them (in that order).
    tokens = re.findall(r'(\$\$)|(\$[a-zA-Z0-9_]+)|([^\$]*)', sql)

    # Rebuild the SQL string, substituting just '$' for escaped $ occurrences,
    # variable references subsituted with their values, or literal text copied
    # over as-is.
    parts = []
    for (escape, placeholder, literal) in tokens:
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
          value = value._repr_sql_()
        elif (type(value) == str) or (type(value) == unicode):
          value = '"' + value.replace('"', '\\"') + '"'
        else:
          value = str(value)
        parts.append(value)
      elif literal:
        parts.append(literal)

    return ''.join(parts)
