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

import codecs
import collections
import csv
from datetime import datetime
import math
import pandas as pd
import re
import time
import uuid

from gcp._util import Iterator as _Iterator
from ._job import Job as _Job
from ._parser import Parser as _Parser
# import of Query is at end of module as we have a circular dependency of
# Query.execute().results -> Table and
# Table.sample() -> Query


class TableSchema(list):
  """Represents the schema of a BigQuery table.
  """

  class _Field(object):

    def __init__(self, name, data_type, mode='NULLABLE', description=''):
      self.name = name
      self.data_type = data_type
      self.mode = mode
      self.description = description

    def _repr_sql_(self):
      """Returns a representation of the field for embedding into a SQL statement.

      Returns:
        A formatted field name for use within SQL statements.
      """
      return self.name

    def __eq__(self, other):
      return self.name == other.name and self.data_type == other.data_type \
          and self.mode == other.mode

    def __str__(self):
      # Stringize in the form of a dictionary
      return "{ 'name': '%s', 'type': '%s', 'mode':'%s', 'description': '%s' }" %\
             (self.name, self.data_type, self.mode, self.description)

    def __repr__(self):
      return str(self)

    def __getitem__(self, item):
      # TODO(gram): Currently we need this for a Schema object to work with the Parser object.
      # Eventually if we change Parser to only work with Schema (and not also with the
      # schema dictionaries in query results) we can remove this.

      if item == 'name':
        return self.name
      if item == 'type':
        return self.data_type
      if item == 'mode':
        return self.mode
      if item == 'description':
        return self.description

  @staticmethod
  def _from_dataframe(dataframe, default_type='STRING'):
    """
      Infer a BigQuery table schema from a Pandas dataframe. Note that if you don't explicitly set
      the types of the columns in the dataframe, they may be of a type that forces coercion to
      STRING, so even though the fields in the dataframe themselves may be numeric, the type in the
      derived schema may not be. Hence it is prudent to make sure the Pandas dataframe is typed
      correctly.

    Args:
      dataframe: The DataFrame.
      default_type : The default big query type in case the type of the column does not exist in
          the schema.
    Returns:
      A list of dictionaries containing field 'name' and 'type' entries, suitable for use in a
          BigQuery Tables resource schema.
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

  @staticmethod
  def _from_list(data):
    """
    Infer a BigQuery table schema from a list. The list must be non-empty and be a list
    of dictionaries (in which case the first item is used), or a list of lists. In the latter
    case the type of the elements is used and the field names are simply 'Column1', 'Column2', etc.

    Args:
      data: The list.
    Returns:
      A list of dictionaries containing field 'name' and 'type' entries, suitable for use in a
          BigQuery Tables resource schema.
    """
    if not data:
      return []

    def _get_type(value):
      if isinstance(value, datetime):
        return 'TIMESTAMP'
      elif isinstance(value, int):
        return 'INTEGER'
      elif isinstance(value, float):
        return 'FLOAT'
      elif isinstance(value, bool):
        return 'BOOLEAN'
      else:
        return 'STRING'

    datum = data[0]
    if isinstance(datum, dict):
      return [{'name': key, 'type': _get_type(datum[key])} for key in datum.keys()]
    else:
      return [{'name': 'Column%d' % (i + 1), 'type': _get_type(datum[i])}
              for i in range(0, len(datum))]

  def __init__(self, data=None, definition=None):
    """Initializes a TableSchema from its raw JSON representation, a Pandas Dataframe, or a list.

    Args:
      data: A Pandas DataFrame or a list of dictionaries or lists from which to infer a schema.
      definition: a definition of the schema as a list of dictionaries with 'name' and 'type'
          entries and possibly 'mode' and 'description' entries. Only used if no data argument was
          provided. 'mode' can be 'NULLABLE', 'REQUIRED' or 'REPEATED'. For the allowed types, see:
          https://cloud.google.com/bigquery/preparing-data-for-bigquery#datatypes
    """
    list.__init__(self)
    self._map = {}
    if isinstance(data, pd.DataFrame):
      data = TableSchema._from_dataframe(data)
    elif isinstance(data, list):
      data = TableSchema._from_list(data)
    elif definition:
      data = definition
    else:
      raise Exception("TableSchema requires either data or json argument.")
    self._populate_fields(data)

  def __getitem__(self, key):
    """Provides ability to lookup a schema field by position or by name.
    """
    if isinstance(key, basestring):
      return self._map.get(key, None)
    return list.__getitem__(self, key)

  def _add_field(self, name, data_type, mode='NULLABLE', description=''):
    field = TableSchema._Field(name, data_type, mode, description)
    self.append(field)
    self._map[name] = field

  def _populate_fields(self, data, prefix=''):
    self._bq_schema = data
    for field_data in data:
      name = prefix + field_data['name']
      data_type = field_data['type']
      self._add_field(name, data_type, field_data.get('mode', None),
                      field_data.get('description', None))

      if data_type == 'RECORD':
        # Recurse into the nested fields, using this field's name as a prefix.
        self._populate_fields(field_data.get('fields'), name + '.')

  def __str__(self):
    return str(self._bq_schema)

  def __eq__(self, other):
    other_map = other._map
    if len(self._map) != len(other_map):
      return False
    for name in self._map.iterkeys():
      if name not in other_map:
        return False
      if not self._map[name] == other_map[name]:
        return False
    return True


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
    return int(self._info['numRows']) if 'numRows' in self._info else -1

  @property
  def size(self):
    """The size of the table in bytes."""
    return int(self._info['numBytes']) if 'numBytes' in self._info else -1


TableName = collections.namedtuple('TableName', ['project_id', 'dataset_id', 'table_id'])


class Table(object):
  """Represents a Table object referencing a BigQuery table.

  This object can be used to inspect tables and create SQL queries.
  """

  # Absolute project-qualified name pattern: <project>:<dataset>.<table>
  _ABS_NAME_PATTERN = r'^([a-z0-9\-_\.:]+)\:([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$'

  # Relative name pattern: <dataset>.<table>
  _REL_NAME_PATTERN = r'^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$'

  # Table-only name pattern: <table>
  _TABLE_NAME_PATTERN = r'^([a-zA-Z0-9_]+)$'

  # Allowed characters in a BigQuery table column name
  _VALID_COLUMN_NAME_CHARACTERS = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  # When fetching table contents, the max number of rows to fetch per HTTP request
  _DEFAULT_PAGE_SIZE = 1024

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
      m = re.match(Table._ABS_NAME_PATTERN, name, re.IGNORECASE)
      if m is not None:
        _project_id, _dataset_id, _table_id = m.groups()
      else:
        # Next try to match as a relative name implicitly scoped within current project.
        m = re.match(Table._REL_NAME_PATTERN, name)
        if m is not None:
          groups = m.groups()
          _project_id, _dataset_id, _table_id = project_id, groups[0], groups[1]
        else:
          # Finally try to match as a table name only.
          m = re.match(Table._TABLE_NAME_PATTERN, name)
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
    """Initializes an instance of a Table object.

    Args:
      api: the BigQuery API object to use to issue requests.
      name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).
    """
    self._api = api
    self._name_parts = Table._parse_name(name, api.project_id)
    self._full_name = '%s:%s.%s' % self._name_parts
    self._info = None
    self._cached_page = None
    self._cached_page_index = 0

  @property
  def full_name(self):
    """The full name for the table."""
    return self._full_name

  @property
  def name(self):
    """The TableName for the table."""
    return self._name_parts

  @property
  def is_temporary(self):
    """ Whether this is a short-lived table or not. """
    return self._is_temporary

  def _load_info(self):
    """Loads metadata about this table."""
    if self._info is None:
      self._info = self._api.tables_get(self._name_parts)

  def metadata(self):
    """Retrieves metadata about the table.

    Returns:
      A TableMetadata object.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    self._load_info()
    return TableMetadata(self._full_name, self._info)

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

  def create(self, schema, truncate=False):
    """ Create the table with the specified schema.

    Args:
      schema: the schema to use to create the table. Should be a list of dictionaries, each
          containing at least a pair of entries, 'name' and 'type'.
          See https://cloud.google.com/bigquery/docs/reference/v2/tables#resource
      truncate: if True, delete the table first if it exists. If False and the Table exists,
          creation will fail and raise an Exception.
    Returns:
      The Table instance.
    Raises:
      Exception if the table couldn't be created or already exists and truncate was False.
    """
    if truncate and self.exists():
      self.delete()
    if isinstance(schema, TableSchema):
      schema = schema._bq_schema
    response = self._api.tables_insert(self._name_parts, schema)
    if 'selfLink' in response:
      return self
    raise Exception("Table %s could not be created as it already exists" % self.full_name)

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
    return _Query.sampling_query(self._api, sql, count=count, fields=fields, sampling=sampling).\
        results(timeout=timeout, use_cache=use_cache)

  @staticmethod
  def _encode_dict_as_row(record, column_name_map):
    """ Encode a dictionary representing a table row in a form suitable for streaming to BQ.
        This means encoding timestamps as ISO-compatible strings and removing invalid
        characters from column names.

    Args:
      record: a Python dictionary representing the table row.
      column_name_map: a dictionary mapping dictionary keys to column names. This is initially
        empty and built up by this method when it first encounters each column, then used as a
        cache subsequently.
    Returns:
      The sanitized dictionary.
    """
    for k in record.keys():
      v = record[k]
      # If the column is a date, convert to ISO string.
      if isinstance(v, pd.Timestamp) or isinstance(v, datetime):
        v = record[k] = record[k].isoformat()

      # If k has invalid characters clean it up
      if k not in column_name_map:
        column_name_map[k] = ''.join(c for c in k if c in Table._VALID_COLUMN_NAME_CHARACTERS)
      new_k = column_name_map[k]
      if k != new_k:
        record[new_k] = v
        del record[k]
    return record

  def insertAll(self, data, include_index=False, index_name=None):
    """ Insert the contents of a Pandas DataFrame or a list of dictionaries into the table.

    Args:
      data: the DataFrame or list to insert.
      include_index: whether to include the DataFrame or list index as a column in the BQ table.
      index_name: for a list, if include_index is True, this should be the name for the index.
          If not specified, 'Index' will be used.
    Returns:
      The table.
    Raises:
      Exception if the table doesn't exist, the schema differs from the data's schema, or the insert
          failed.
    """
    # There are BigQuery limits on the streaming API:
    #
    # max_rows_per_post = 500
    # max_bytes_per_row = 20000
    # max_rows_per_second = 10000
    # max_bytes_per_post = 1000000
    # max_bytes_per_second = 10000000
    #
    # It is non-trivial to enforce these here, but as an approximation we enforce the 500 row limit
    # with a 0.1 sec POST interval.
    max_rows_per_post = 500
    post_interval = 0.1

    # TODO(gram): add different exception types for each failure case.
    if not self.exists():
      raise Exception('Table %s does not exist.' % self._full_name)

    data_schema = TableSchema(data=data)
    if isinstance(data, list):
      if include_index:
        if not index_name:
          index_name = 'Index'
        data_schema._add_field(index_name, 'INTEGER')

    table_schema = self.schema()

    # Do some validation of the two schema to make sure they are compatible.
    for data_field in data_schema:
      name = data_field.name
      table_field = table_schema[name]
      if table_field is None:
        raise Exception('Table does not contain field %s' % name)
      data_type = data_field.data_type
      table_type = table_field.data_type
      if table_type != data_type:
        raise Exception('Field %s in data has type %s but in table has type %s' %
                        (name, data_type, table_type))

    total_rows = len(data)
    total_pushed = 0

    job_id = uuid.uuid4().hex
    rows = []
    column_name_map = {}

    is_dataframe = isinstance(data, pd.DataFrame)
    if is_dataframe:
      # reset_index creates a new dataframe so we don't affect the original. reset_index(drop=True)
      # drops the original index and uses an integer range.
      gen = data.reset_index(drop=not include_index).iterrows()
    else:
      gen = enumerate(data)

    for index, row in gen:
      if is_dataframe:
        row = row.to_dict()
      elif include_index:
        row[index_name] = index

      rows.append({
        'json': self._encode_dict_as_row(row, column_name_map),
        'insertId': job_id + str(index)
      })

      total_pushed += 1

      if (total_pushed == total_rows) or (len(rows) == max_rows_per_post):
        response = self._api.tabledata_insertAll(self._name_parts, rows)
        if 'insertErrors' in response:
          raise Exception('insertAll failed: %s' % response['insertErrors'])

        time.sleep(post_interval)  # Streaming API is rate-limited
        rows = []
    return self

  def extract(self, destination, format='CSV', compress=False,
              field_delimiter=',', print_header=True):
    """Exports the table to GCS.

    Args:
      destination: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO.
          Defaults to CSV.
      compress whether to compress the data on export. Compression is not supported for
          AVRO format. Defaults to False.
      field_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      print_header: for CSV exports, whether to include an initial header line. Default true.
    Returns:
      A Job object for the export Job if it was started successfully; else None.
    """
    response = self._api.table_extract(self._name_parts, destination, format, compress,
                                       field_delimiter, print_header)
    return _Job(self._api, response['jobReference']['jobId']) \
        if response and 'jobReference' in response else None

  def load(self, source, append=False, overwrite=False, source_format='CSV'):
    """ Load the table from GCS.

    Args:
      source: the URL of the source bucket(s). Can include wildcards.
      append: if True append onto existing table contents.
      overwrite: if True overwrite existing table contents.
      source_format: the format of the data; default 'CSV'. Other options are DATASTORE_BACKUP
          or NEWLINE_DELIMITED_JSON.
    Returns:
      A Job object for the load Job if it was started successfully; else None.
    """
    response = self._api.jobs_insert_load(source, self._name_parts,
                                          append=append, overwrite=overwrite,
                                          source_format=source_format)
    return _Job(self._api, response['jobReference']['jobId']) \
        if response and 'jobReference' in response else None

  def _get_row_fetcher(self, start_row=0, max_rows=None, page_size=_DEFAULT_PAGE_SIZE):
    """ Get a function that can retrieve a page of rows.

    The function returned is a closure so that it can have a signature suitable for use
    by Iterator.

    Args:
      start_row: the row to start fetching from; default 0.
      max_rows: the maximum number of rows to fetch (across all calls, not per-call). Default
          is None which means no limit.
      page_size: the maximum number of results to fetch per page; default 1024.
    Returns:
      A function that can be called repeatedly with a page token and running count, and that
      will return an array of rows and a next page token; when the returned page token is None
      the fetch is complete.
    """
    if not start_row:
      start_row = 0
    elif start_row < 0:  # We are measuring from the table end
      if self.length >= 0:
        start_row += self.length
      else:
        raise Exception('Cannot use negative indices for table of unknown length')

    schema = self.schema()
    name_parts = self._name_parts

    def _retrieve_rows(page_token, count):

      if max_rows and count >= max_rows:
        page_rows = []
        page_token = None
      else:
        if max_rows and page_size > (max_rows - count):
          max_results = max_rows - count
        else:
          max_results = page_size

        if page_token:
          response = self._api.tabledata_list(name_parts, page_token=page_token,
                                              max_results=max_results)
        else:
          response = self._api.tabledata_list(name_parts, start_index=start_row,
                                              max_results=max_results)
        page_token = response['pageToken'] if 'pageToken' in response else None
        page_rows = response['rows']

      rows = []
      for row_dict in page_rows:
        rows.append(_Parser.parse_row(schema, row_dict))

      return rows, page_token

    return _retrieve_rows

  def range(self, start_row=0, max_rows=None):
    """ Get an iterator to iterate through a set of table rows.

    Args:
      start_row: the row of the table at which to start the iteration (default 0)
      max_rows: an upper limit on the number of rows to iterate through (default None)

    Returns:
      A row iterator.
    """
    fetcher = self._get_row_fetcher(start_row=start_row, max_rows=max_rows)
    return iter(_Iterator(fetcher))

  def to_dataframe(self, start_row=0, max_rows=None):
    """ Exports the table to a Pandas dataframe.

    Args:
      start_row: the row of the table at which to start the export (default 0)
      max_rows: an upper limit on the number of rows to export (default None)
    Returns:
      A dataframe containing the table data.
    """
    fetcher = self._get_row_fetcher(start_row=start_row, max_rows=max_rows)
    count = 0
    page_token = None
    df = None
    while True:
      page_rows, page_token = fetcher(page_token, count)
      if len(page_rows):
        count += len(page_rows)
        if df is None:
          df = pd.DataFrame.from_dict(page_rows)
        else:
          df.append(page_rows, ignore_index=True)
      if not page_token:
        break

    return df

  def to_file(self, path, start_row=0, max_rows=None, write_header=True, dialect=csv.excel):
    """Save the results to a local file in CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      start_row: the row of the table at which to start the export (default 0)
      max_rows: an upper limit on the number of rows to export (default None)
      write_header: if true (the default), write column name header row at start of file
      dialect: the format to use for the output. By default, csv.excel. See
          https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.
    Raises:
      An Exception if the operation failed.
    """
    f = codecs.open(path, 'w', 'utf-8')
    fieldnames = []
    for column in self.schema():
      fieldnames.append(column.name)
    writer = csv.DictWriter(f, fieldnames=fieldnames, dialect=dialect)
    if write_header:
      writer.writeheader()
    for row in self.range(max_rows, start_row=start_row):
      writer.writerow(row)
    f.close()

  def schema(self):
    """Retrieves the schema of the table.

    Returns:
      A TableSchema object containing a list of schema fields and associated metadata.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    try:
      self._load_info()
      return TableSchema(definition=self._info['schema']['fields'])
    except KeyError:
      raise Exception('Unexpected table response.')

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
    return self.metadata().rows

  def __iter__(self):
    """ Get an iterator for the table.
    """
    return self.range(start_row=0)

  def __getitem__(self, item):
    """ Get an item or a slice of items from the table. This uses a small cache
        to reduce the number of calls to tabledata.list.

        Note: this is a useful function to have, and supports some current usage like
        query.results()[0], but should be used with care.
    """
    if isinstance(item, slice):
      # Just treat this as a set of calls to __getitem__(int)
      result = []
      i = item.start
      step = item.step if item.step else 1
      while i < item.stop:
        result.append(self[i])
        i += step
      return result

    # Handle the integer index case.
    if item < 0:
      if self.length >= 0:
        item += self.length
      else:
        raise Exception('Cannot use negative indices for table of unknown length')

    if not self._cached_page \
        or self._cached_page_index > item \
            or self._cached_page_index + len(self._cached_page) <= item:
      # cache a new page. To get the start row we round to the nearest multiple of the page
      # size.
      first = int(math.floor(item / self._DEFAULT_PAGE_SIZE)) * self._DEFAULT_PAGE_SIZE
      count = self._DEFAULT_PAGE_SIZE

      if self.length >= 0:
        remaining = self.length - first
        if count > remaining:
          count = remaining

      fetcher = self._get_row_fetcher(start_row=first, max_rows=count, page_size=count)
      self._cached_page_index = first
      self._cached_page, _ = fetcher(None, 0)

    return self._cached_page[item - self._cached_page_index]


from ._query import Query as _Query
