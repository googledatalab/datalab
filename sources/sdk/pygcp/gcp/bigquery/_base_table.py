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

"""Base class for Table and the virtual tables used for View."""

import collections
from datetime import datetime
import re
import time
from ._schema import Schema as _Schema
from ._table_metadata import TableMetadata as _TableMetadata


TableName = collections.namedtuple('TableName', ['project_id', 'dataset_id', 'table_id'])


class BaseTable(object):

  # Absolute project-qualified name pattern: <project>:<dataset>.<table>
  _ABS_NAME_PATTERN = r'^([a-z0-9\-_\.:]+)\:([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$'

  # Relative name pattern: <dataset>.<table>
  _REL_NAME_PATTERN = r'^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$'

  # Table-only name pattern: <table>
  _TABLE_NAME_PATTERN = r'^([a-zA-Z0-9_]+)$'

  # Allowed characters in a BigQuery table column name
  _VALID_COLUMN_NAME_CHARACTERS = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  @staticmethod
  def _parse_name(name, project_id=None, dataset_id=None):
    """Parses a table name into its individual parts.

    Args:
      name: the name to parse, or a tuple, dictionary or array containing the parts.
      project_id: the expected project ID. If the name does not contain a project ID,
          this will be used; if the name does contain a project ID and it does not match
          this, an exception will be thrown.
      dataset_id: the expected dataset ID. If the name does not contain a dataset ID,
          this will be used; if the name does contain a dataset ID and it does not match
          this, an exception will be thrown.
    Returns:
      A tuple consisting of the full name and individual name parts.
    Raises:
      Exception: raised if the name doesn't match the expected formats.
    """
    _project_id = _dataset_id = _table_id = None
    if isinstance(name, basestring):
      # Try to parse as absolute name first.
      m = re.match(BaseTable._ABS_NAME_PATTERN, name, re.IGNORECASE)
      if m is not None:
        _project_id, _dataset_id, _table_id = m.groups()
      else:
        # Next try to match as a relative name implicitly scoped within current project.
        m = re.match(BaseTable._REL_NAME_PATTERN, name)
        if m is not None:
          groups = m.groups()
          _project_id, _dataset_id, _table_id = project_id, groups[0], groups[1]
        else:
          # Finally try to match as a table name only.
          m = re.match(BaseTable._TABLE_NAME_PATTERN, name)
          if m is not None:
            groups = m.groups()
            _project_id, _dataset_id, _table_id = project_id, dataset_id, groups[0]
    elif isinstance(name, dict):
      try:
        _table_id = name['table_id']
        _dataset_id = name['dataset_id']
        _project_id = name['project_id']
      except KeyError:
        pass
    else:
      # Try treat as an array or tuple
      if len(name) == 3:
        _project_id, _dataset_id, _table_id = name
      elif len(name) == 2:
        _dataset_id, _table_id = name
    if not _table_id:
      raise Exception('Invalid table name: ' + str(name))
    if not _project_id:
      _project_id = project_id
    if not _dataset_id:
      _dataset_id = dataset_id

    return TableName(_project_id, _dataset_id, _table_id)

  def __init__(self, api, name):
    """Initializes an instance of a BaseTable object.

    Args:
      api: the BigQuery API object to use to issue requests.
      name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).
    """
    self._api = api
    self._name_parts = BaseTable._parse_name(name, api.project_id)
    self._full_name = '%s:%s.%s' % self._name_parts
    self._info = None

  @property
  def full_name(self):
    """The full name for the table."""
    return self._full_name

  @property
  def name(self):
    """The TableName for the table."""
    return self._name_parts

  def _load_info(self):
    """Loads metadata about this table."""
    if self._info is None:
      self._info = self._api.tables_get(self._name_parts)

  @property
  def metadata(self):
    """Retrieves metadata about the table.

    Returns:
      A TableMetadata object.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    self._load_info()
    return _TableMetadata(self, self._info)

  def exists(self):
    """Checks if the table exists.

    Returns:
      True if the table exists; False otherwise.
    Raises:
      Exception if there was an error requesting information about the table.
    """
    try:
      _ = self._api.tables_get(self._name_parts)
    except Exception as e:
      if (len(e.args[0]) > 1) and (e.args[0][1] == 404):
        return False
      raise e
    return True

  def delete(self):
    """ Delete the table.

    Returns:
      Nothing
    """
    try:
      self._api.table_delete(self._name_parts)
    except Exception as e:
      # TODO(gram): May want to check the error reasons here and if it is not
      # because the file didn't exist, return an error.
      pass

  def create(self, schema=None, query=None, overwrite=False):
    """ Create the table with the specified schema (if Table) or query (if View).

    Args:
      schema: the schema to use to create the table. Should be a list of dictionaries, each
          containing at least a pair of entries, 'name' and 'type'.
          See https://cloud.google.com/bigquery/docs/reference/v2/tables#resource
      overwrite: if True, delete the object first if it exists. If False and the object exists,
          creation will fail and raise an Exception.
    Returns:
      The Table instance.
    Raises:
      Exception if the table couldn't be created or already exists and truncate was False.
    """
    if overwrite and self.exists():
      self.delete()
    if isinstance(schema, _Schema):
      schema = schema._bq_schema
    if isinstance(query, _Query):
      query = query.sql
    response = self._api.tables_insert(self._name_parts, schema=schema, query=query)
    if 'selfLink' in response:
      return self
    raise Exception("%s %s could not be created as it already exists" %
                    (("View" if query else "Table"), self.full_name))

  def sample(self, fields=None, count=5, sampling=None, timeout=0, use_cache=True):
    """Retrieves a sampling of data from the table.

    Args:
      fields: an optional list of field names to retrieve.
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the table.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResults object containing the resulting data.
    Raises:
      Exception if the sample query could not be executed or query response was malformed.
    """
    sql = self._repr_sql_()
    return _Query.sampling_query(self._api, sql, count=count, fields=fields, sampling=sampling). \
      results(timeout=timeout, use_cache=use_cache)

  @property
  def schema(self):
    """Retrieves the schema of the table.

    Returns:
      A Schema object containing a list of schema fields and associated metadata.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    try:
      self._load_info()
      return _Schema(definition=self._info['schema']['fields'])
    except KeyError:
      raise Exception('Unexpected table response.')

  def update(self, friendly_name=None, description=None, expiry=None, schema=None, query=None):
    """ Selectively updates Table information.

    Args:
      friendly_name: if not None, the new friendly name.
      description: if not None, the new description.
      expiry: if not None, the new expiry time, either as a DateTime or milliseconds since epoch.
      schema: if not None, the new schema: either a list of dictionaries or a Schema.
      query: if not None, a new query (used for Views).

    Returns:
    """
    if not(friendly_name or description or expiry or schema or query):
      return  # Nothing to do.
    self._load_info()
    if friendly_name is not None:
      self._info['friendly_name'] = friendly_name
    if description is not None:
      self._info['description'] = description
    if expiry is not None:
      if isinstance(expiry, datetime):
        expiry = time.mktime(expiry.timetuple()) * 1000
      self._info['expiry'] = expiry
    if schema is not None:
      if isinstance(schema, _Schema):
        schema = schema._bq_schema
      self._info['schema'] = {'fields': schema}
    if query is not None:
      if isinstance(query, _Query):
        query = query.sql
      self._info['view'] = {'query': query}
    try:
      self._api.table_update(self._name_parts, self._info)
    except Exception:
      # The cached metadata is out of sync now; abandon it.
      self._info = None

  def _repr_sql_(self):
    """Returns a representation of the table for embedding into a SQL statement.

    Returns:
      A formatted table name for use within SQL statements.
    """
    return '[' + self._full_name + ']'

  def __repr__(self):
    """Returns a representation for the table for showing in the notebook.
    """
    return ''

  def __str__(self):
    """Returns a string representation of the table using its specified name.

    Returns:
      The string representation of this object.
    """
    return self.full_name

  @property
  def length(self):
    """ Get the length of the table (number of rows). We don't use __len__ as this may
        return -1 for 'unknown'.
    """
    return self.metadata.rows


from ._query import Query as _Query
