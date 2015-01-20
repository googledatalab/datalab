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

"""Implements Table, and related Table BigQuery APIs."""

import json
import re
import time
import uuid

from gcp._util import Iterator as _Iterator
from ._query import Query as _Query
from ._parser import Parser as _Parser
from ._sampling import Sampling as _Sampling


class TableSchema(list):
  """Represents the schema of a BigQuery table.
  """

  class _Field(object):

    def __init__(self, name, data_type, mode, description):
      self.name = name
      self.data_type = data_type
      self.mode = mode
      self.description = description

  def __init__(self, data):
    """Initializes a TableSchema from its raw JSON representation.
    """
    list.__init__(self)
    self._populate_fields(data)

    self._map = {}
    # We can't use "for field in self" below as that uses our custom __iter__ which expects the map to be
    # populated! Took me a while to find this bug. Instead, iterate using an indexed loop.
    for i in range(0, len(self)):
      field = self[i]
      self._map[field.name] = field

  def __getitem__(self, key):
    """Provides ability to lookup a schema field by position or by name.
    """
    if isinstance(key, basestring):
      return self._map.get(key, None)
    return list.__getitem__(self, key)

  def _populate_fields(self, data, prefix=''):
    for field_data in data:
      name = prefix + field_data['name']
      data_type = field_data['type']

      field = TableSchema._Field(name, data_type,
                                 field_data.get('mode', 'NULLABLE'),
                                 field_data.get('description', ''))
      self.append(field)

      if data_type == 'RECORD':
        # Recurse into the nested fields, using this field's name as a prefix.
        self._populate_fields(field_data.get('fields'), name + '.')

  def __iter__(self):
    return self._map.iteritems()


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

class TableList(object):
  """Represents a list of BigQuery tables in a dataset."""

  def __init__(self, api, dataset_id):
    """Initializes an instance of a TableList.

    Args:
      api: the BigQuery API object to use to issue requests. The project ID will be inferred from this.
      dataset_id: the BigQuery dataset ID corresponding to this list.
    """
    self._api = api
    self._dataset_id = dataset_id

  def contains(self, name):
    """Checks if the specified table exists.

    Args:
      name: the name of the table to lookup (not including the project and dataset IDs).
    Returns:
      True if the table exists; False otherwise.
    Raises:
      Exception if there was an error requesting information about the table.
    """
    try:
      project_id = self._api.project_id
      _ = self._api.tables_get([project_id, self._dataset_id, name])
    except Exception as e:
      if (len(e.args[0]) > 1) and (e.args[0][1] == 404):
        return False
      raise e
    return True

  def create(self, name, schema):
    """ Create a table with a specified name and schema.

    Args:
      name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name). If a string,
          the name can be fully qualified or just be the last component. If the project ID and dataset ID do not
          match the TableList, creation will fail.
      schema: the schema to use to create the table. Should be a list of dictionaries, each containing at least a
          pair of entries, 'name' and 'type'. See https://cloud.google.com/bigquery/docs/reference/v2/tables#resource
    Returns:
      None on failure, or the Table instance if successful.
    """
    response = self._api.tables_insert(self._dataset_id, name, schema)
    if response:
      return Table(self._api, (self._api.project_id, self._dataset_id, name))
    return None

  def _retrieve_tables(self, page_token):
    list_info = self._api.tables_list(page_token=page_token)

    tables = list_info.get('tables', [])
    if len(tables):
      try:
        project_id = self._api.project_id
        tables = map(lambda info: Table(self._api, (project_id, self._dataset_id, info['tableReference']['tableId'])),
                     tables)
      except KeyError:
        raise Exception('Unexpected item list response.')

    page_token = list_info.get('nextPageToken', None)
    return tables, page_token

  def __iter__(self):
    return iter(_Iterator(self._retrieve_tables))

  def schema_from_dataframe(self, dataframe, default_type='STRING'):
    """
      Infer a BigQuery table schema from a Pandas dataframe. Note that if you don't explicitly set the
      types of the columns in the dataframe, they may be of a type that forces coercion to STRING, so
      even though the fields in the dataframe themselves may be numeric, the type in the derives schema
      may not be. Hence it is prudent to make sure the Pandas dataframe is typed correctly.

    Args:
      dataframe: DataFrame
      default_type : The default big query type in case the type of the column does not exist in the schema.
    Returns:
      A list of dictionaries containing field 'name' and 'type' entries, suitable for use in a BigQuery
      Tables resource schema.
    """

    type_mapping = {
      'i': 'INTEGER',
      'b': 'BOOLEAN',
      'f': 'FLOAT',
      'O': 'STRING',
      'S': 'STRING',
      'U': 'STRING',
      'M': 'TIMESTAMP'
    }

    fields = []
    for column_name, dtype in dataframe.dtypes.iteritems():
      fields.append({'name': column_name,
                     'type': type_mapping.get(dtype.kind, default_type)})

    return fields


class Table(object):
  """Represents a Table object referencing a BigQuery table.

  This object can be used to inspect tables and create SQL queries.
  """

  # Absolute project-qualified name pattern: <project>:<dataset>.<table>
  _ABS_NAME_PATTERN = r'^([a-z0-9\-_\.:]+)\:([a-z0-9_]+)\.([a-z0-9_]+)$'

  # Relative name pattern: <dataset>.<table>
  _REL_NAME_PATTERN = r'^([a-z0-9_]+)\.([a-z0-9_]+)$'

  def __init__(self, api, name):
    """Initializes an instance of a Table object.

    Args:
      api: the BigQuery API object to use to issue requests.
      name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).
    """
    self._api = api

    if isinstance(name, basestring):
      self._name_parts = self._parse_name(name)
    else:
      self._name_parts = name

    self._full_name = '%s:%s.%s' % self._name_parts
    self._name = self._full_name
    self._info = None

  @property
  def full_name(self):
    """The full name of the table."""
    return self._full_name

  @property
  def name(self):
    """The name of the table, as used when it was constructed."""
    return self._name

  @property
  def project_id(self):
    """The project ID for the table."""
    return self._name_parts[0]

  @property
  def dataset_id(self):
    """The dataset ID for the table."""
    return self._name_parts[1]

  @property
  def table_id(self):
    """The table ID for the table."""
    return self._name_parts[2]

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
    # Try to parse as absolute name first.
    m = re.match(Table._ABS_NAME_PATTERN, name, re.IGNORECASE)
    if m is not None:
      return m.groups()

    # Next try to match as a relative name implicitly scoped within current project.
    m = re.match(Table._REL_NAME_PATTERN, name)
    if m is not None:
      groups = m.groups()
      return self._api.project_id, groups[0], groups[1]

    raise Exception('Invalid table name: ' + name)

  def metadata(self):
    """Retrieves metadata about the table.

    Returns:
      A TableMetadata object.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    self._load_info()
    return TableMetadata(self._full_name, self._info)

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
      A query results object containing the resulting data.
    Raises:
      Exception if the sample query could not be executed or query response was malformed.
    """
    if sampling is None:
      sampling = _Sampling.default(fields=fields, count=count)
    sql = sampling(self._repr_sql_())
    q = _Query(self._api, sql)

    return q.results(timeout=timeout, use_cache=use_cache)

  def insertAll(self, dataframe, chunk_size=10000):
    """ Insert the contents of a Pandas dataframe into the table
    Args:
      dataframe: the dataframe to insert.
      chunk_size: for a large dataframe, the max number of records per POST. Note that BigQuery limits each POST
          to max 1MB in size.
    Returns:
      The table.
    Raises:
      Exception if the table doesn't exists, the schema differs from the dataframe's, or the insert failed.
    """

    # TODO(gram): add different exception types for each failure case.
    dataset_tables = TableList(self._api, self.dataset_id)

    if not dataset_tables.contains(self.table_id):
      raise Exception('Table %s does not exist.' % self._full_name)

    data_schema = dataset_tables.schema_from_dataframe(dataframe)
    table_schema = self.schema()
    for data_field in data_schema:
      name = data_field['name']
      table_field = table_schema[name]
      if table_field is None:
        raise Exception('Table does not contain field %s' % name)
      data_type = data_field['type']
      table_type = table_field.data_type
      if table_type != data_type:
        raise Exception('Field %s in data has type %s but in table has type %s' % (name, data_type, table_type))

    total_rows = len(dataframe)
    total_pushed = 0

    job_id = uuid.uuid4().hex
    rows = []
    for index, dataframe_row in dataframe.reset_index(drop=True).iterrows():
      encoded = json.loads(dataframe_row.to_json(force_ascii=False, date_unit='s', date_format='iso'))

      rows.append({
        'json': encoded,
        'insertId': job_id + str(index)
      })

      total_pushed += 1

      if (total_pushed == total_rows) or (len(rows) == chunk_size):
        response = self._api.tables_insertAll(self.dataset_id, self.table_id, rows)
        if 'insertErrors' in response:
          raise Exception('insertAll failed: %s' % response['insertErrors'])

        time.sleep(1)  # Streaming API is rate-limited
        rows = []
    return self

  def schema(self):
    """Retrieves the schema of the table.

    Returns:
      A TableSchema object containing a list of schema fields and associated metadata.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    try:
      self._load_info()
      return TableSchema(self._info['schema']['fields'])
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
