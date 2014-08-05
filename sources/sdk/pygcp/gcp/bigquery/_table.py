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

"""Implements Table and TableMetadata BigQuery APIs."""

import re
from ._query import Query as _Query
from ._parser import Parser as _Parser
from ._sampling import Sampling as _Sampling


class TableMetadata(object):
  """Represents metadata about a BigQuery table."""

  def __init__(self, name, info):
    """Initializes an instance of a TableMetadata.

    Args:
      name: the name of the table.
      info: The BigQuery information about this table.
    """
    self._name = name
    self._info = info

  @property
  def created_on(self):
    """The creation timestamp."""
    timestamp = self._info.get('creationTime')
    return _Parser.parse_timestamp(timestamp)

  @property
  def description(self):
    """The description of the table if it exists."""
    return self._info.get('description', '')

  @property
  def expires_on(self):
    """The timestamp for when the table will expire."""
    timestamp = self._info.get('expirationTime', None)
    if timestamp is None:
      return None
    return _Parser.parse_timestamp(timestamp)

  @property
  def friendly_name(self):
    """The friendly name of the table if it exists."""
    return self._info.get('friendlyName', '')

  @property
  def full_name(self):
    """The full name of the table."""
    return self._name

  @property
  def modified_on(self):
    """The timestamp for when the table was last modified."""
    timestamp = self._info.get('lastModifiedTime')
    return _Parser.parse_timestamp(timestamp)

  @property
  def rows(self):
    """The number of rows within the table."""
    return self._info['numRows']

  @property
  def size(self):
    """The size of the table in bytes."""
    return self._info['numBytes']


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
    self._full_name = '%s:%s.%s' % self._name_parts
    self._info = None

  @property
  def name(self):
    """The name of the table, as used when it was constructed."""
    return self._name

  def _load_info(self):
    """Loads metadata about this table."""
    if self._info is None:
      self._info = self._api.tables_get(self._name_parts)

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
    m = re.match(r'^([a-z0-9\-_\.:]+)\:([a-z0-9_]+)\.([a-z0-9_]+)$', name, re.IGNORECASE)
    if m is not None:
      return m.groups()

    # Next try to match <dataset>.<table> as a project-scoped table.
    m = re.match(r'^([a-z0-9]+)\.([a-z0-9]+)$', name)
    if m is not None:
      groups = m.groups()
      return (self._api.project_id, groups[0], groups[1])

    raise Exception('Invalid table name: ' + name)

  def metadata(self):
    """Retrieves metadata about the table.

    Returns:
      A TableMetadata object.
    Raises
      Exception if the request could not be executed or the response was
      malformed.
    """
    self._load_info()
    return TableMetadata(self._full_name, self._info)

  def sample(self, sampling=None):
    """Retrieves a sampling of data from the table.

    Args:
      sampling: an optional sampling strategy to apply to the table.
    Returns:
      A query results object containing the resulting data.
    Raises:
      Exception if the sample query could not be executed or query response was
      malformed.
    """
    if sampling is None:
      sampling = _Sampling.default()
    sql = sampling(self._api, '[' + self._full_name + ']')
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
      self._load_info()

      # TODO(nikhilko): Build a python-representation of the schema, as well
      #                 as handle nested objects/json fields
      return self._info['schema']['fields']
    except KeyError:
      raise Exception('Unexpected table response.')

  def _repr_sql_(self):
    """Returns a representation of the table for embedding into a SQL statement.

    Returns:
      A formatted table name for use within SQL statements.
    """
    return '[' + self._full_name + ']'

  def __str__(self):
    """Returns a string representation of the table using its specified name.

    Returns:
      The string representation of this object.
    """
    return self._name
