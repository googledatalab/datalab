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

"""Implements Table and View metadata."""

from ._parser import Parser as _Parser


class TableMetadata(object):
  """Represents metadata about a BigQuery table."""

  def __init__(self, table, info):
    """Initializes an instance of a TableMetadata.

    Args:
      table: the table this belongs to.
      info: The BigQuery information about this table.
    """
    self._table = table
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
    return self._table.full_name

  @property
  def modified_on(self):
    """The timestamp for when the table was last modified."""
    timestamp = self._info.get('lastModifiedTime')
    return _Parser.parse_timestamp(timestamp)

  @property
  def rows(self):
    """The number of rows within the table."""
    return int(self._info['numRows']) if 'numRows' in self._info else -1

  @property
  def size(self):
    """The size of the table in bytes."""
    return int(self._info['numBytes']) if 'numBytes' in self._info else -1

  @property
  def view_query(self):
    """Returns the query associated with the view, if the Table is really a view."""
    return self._info['view']['query'] if 'view' in self._info and 'query' in self._info['view'] \
        else None
