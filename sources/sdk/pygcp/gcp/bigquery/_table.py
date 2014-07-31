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

import re
from _query import Query as _Query


class Table(object):
  """Represents a Table object referencing a BigQuery table.

  This object can be used to inspect tables and create SQL queries.
  """

  def __init__(self, api, name):
    """Initializes an instance of a Table object.

    Args:
      api: the BigQuery API object to use to issue requests.
      name: the name of the table.
    """

    self._api = api
    self._name = name
    self._name_parts = self._parse_name(name)

  def _parse_name(self, name):
    """Parses a table name into its individual parts.

    The resulting tuple of name parts is a triple consisting of project id,
    dataset id and table name.

    Args:
      name: the name to parse
    Returns:
      A triple consisting of the individual name parts.
    Raises:
      Exception: raised if the name doesn't match the expected formats.
    """

    # Try to parse as fully-qualified <project>:<dataset>.<table> name first.
    m = re.match(r'^([a-z0-9\-_]+)\:([a-z0-9]+)\.([a-z0-9]+)$', name)
    if m is not None:
      return m.groups()

    # Next try to match <dataset>.<table> as a project-scoped table.
    m = re.match(r'^([a-z0-9]+)\.([a-z0-9]+)$', name)
    if m is not None:
      groups = m.groups()
      return (self._api.project_id, groups[0], groups[1])

    raise Exception('Invalid table name: ' + name)

  def sample(self, count=5):
    """Retrieves a sampling of data from the table.

    Args:
      count: the number of rows of data to retrieve. This defaults to 5.
    Returns:
      A query results object containing the resulting data.
    Raises:
      Exception if the sample query could not be executed or query response was
      malformed.
    """

    sql = 'SELECT * FROM [%s:%s.%s] LIMIT %d' % (self._name_parts + (count,))
    q = _Query(self._api, sql)

    return q.results()

  def schema(self):
    """Retrieves the schema of the table.

    Returns:
      An array of schema fields and associated metadata.
    Raises
      Exception if the request could not be executed or the response was
      malformed.
    """

    try:
      table_info = self._api.tables_get(self._name_parts)

      # TODO(nikhilko): Build a python-representation of the schema, as well
      #                 as handle nested objects/json fields
      return table_info['schema']['fields']
    except KeyError:
      raise Exception('Unexpected table response.')

  def _repr_sql_(self):
    """Returns a representation of the table for embedding into a SQL statement.

    Returns:
      A formatted table name for use within SQL statements.
    """
    return '[%s:%s.%s]' % self._name_parts

  def __str__(self):
    """Returns a string representation of the table using its specified name.

    Returns:
      The string representation of this object.
    """
    return self._name
