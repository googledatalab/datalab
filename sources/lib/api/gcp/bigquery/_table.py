# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied. See the License for the specific language governing permissions and limitations under
# the License.

"""Implements Table, and related Table BigQuery APIs."""

import calendar
import codecs
import csv
import datetime
import math
import pandas
import time
import traceback
import uuid

import gcp._util
import _api
import _csv_options
import _federated_table
import _job
import _parser
import _schema
import _utils

# import of Query is at end of module as we have a circular dependency of
# Query.execute().results -> Table and Table.sample() -> Query


class TableMetadata(object):
  """Represents metadata about a BigQuery table."""

  def __init__(self, table, info):
    """Initializes a TableMetadata instance.

    Args:
      table: the Table object this belongs to.
      info: The BigQuery information about this table as a Python dictionary.
    """
    self._table = table
    self._info = info

  @property
  def created_on(self):
    """The creation timestamp."""
    timestamp = self._info.get('creationTime')
    return _parser.Parser.parse_timestamp(timestamp)

  @property
  def description(self):
    """The description of the table if it exists."""
    return self._info.get('description', '')

  @property
  def expires_on(self):
    """The timestamp for when the table will expire, or None if unknown."""
    timestamp = self._info.get('expirationTime', None)
    if timestamp is None:
      return None
    return _parser.Parser.parse_timestamp(timestamp)

  @property
  def friendly_name(self):
    """The friendly name of the table if it exists."""
    return self._info.get('friendlyName', '')

  @property
  def modified_on(self):
    """The timestamp for when the table was last modified."""
    timestamp = self._info.get('lastModifiedTime')
    return _parser.Parser.parse_timestamp(timestamp)

  @property
  def rows(self):
    """The number of rows within the table, or -1 if unknown. """
    return int(self._info['numRows']) if 'numRows' in self._info else -1

  @property
  def size(self):
    """The size of the table in bytes, or -1 if unknown. """
    return int(self._info['numBytes']) if 'numBytes' in self._info else -1


class Table(object):
  """Represents a Table object referencing a BigQuery table. """

  # Allowed characters in a BigQuery table column name
  _VALID_COLUMN_NAME_CHARACTERS = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

  # When fetching table contents, the max number of rows to fetch per HTTP request
  _DEFAULT_PAGE_SIZE = 1024

  # Milliseconds per week
  _MSEC_PER_WEEK = 7 * 24 * 3600 * 1000

  def __init__(self, name, context=None):
    """Initializes an instance of a Table object. The Table need not exist yet.

    Args:
      name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).
        If a string, it must have the form '<project>:<dataset>.<table>' or '<dataset>.<table>'.
      context: an optional Context object providing project_id and credentials. If a specific
        project id or credentials are unspecified, the default ones configured at the global
        level are used.
    Raises:
      Exception if the name is invalid.
    """
    if context is None:
      context = gcp.Context.default()
    self._context = context
    self._api = _api.Api(context)
    self._name_parts = _utils.parse_table_name(name, self._api.project_id)
    self._full_name = '%s:%s.%s%s' % self._name_parts
    self._info = None
    self._cached_page = None
    self._cached_page_index = 0
    self._schema = None

  @property
  def name(self):
    """The TableName named tuple (project_id, dataset_id, table_id, decorator) for the table."""
    return self._name_parts

  @property
  def job(self):
    """ For tables resulting from executing queries, the job that created the table.

    Default is None for a Table object; this is overridden by QueryResultsTable.
    """
    return None

  @property
  def is_temporary(self):
    """ Whether this is a short-lived table or not. Always False for non-QueryResultsTables. """
    return False

  def _load_info(self):
    """Loads metadata about this table."""
    if self._info is None:
      try:
        self._info = self._api.tables_get(self._name_parts)
      except Exception as e:
        raise e

  @property
  def metadata(self):
    """Retrieves metadata about the table.

    Returns:
      A TableMetadata object.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    self._load_info()
    return TableMetadata(self, self._info)

  def exists(self):
    """Checks if the table exists.

    Returns:
      True if the table exists; False otherwise.
    Raises:
      Exception if there was an error requesting information about the table.
    """
    try:
      _ = self._api.tables_get(self._name_parts)
    except gcp._util.RequestException as e:
      if e.status == 404:
        return False
      raise e
    except Exception as e:
      raise e
    return True

  def delete(self):
    """ Delete the table.

    Returns:
      True if the Table no longer exists; False otherwise.
    """
    try:
      self._api.table_delete(self._name_parts)
    except gcp._util.RequestException:
      # TODO(gram): May want to check the error reasons here and if it is not
      # because the file didn't exist, return an error.
      pass
    except Exception as e:
      raise e
    return not self.exists()

  def create(self, schema, overwrite=False):
    """ Create the table with the specified schema.

    Args:
      schema: the schema to use to create the table. Should be a list of dictionaries, each
          containing at least a pair of entries, 'name' and 'type'.
          See https://cloud.google.com/bigquery/docs/reference/v2/tables#resource
      overwrite: if True, delete the table first if it exists. If False and the table exists,
          creation will fail and raise an Exception.
    Returns:
      The Table instance.
    Raises:
      Exception if the table couldn't be created or already exists and truncate was False.
    """
    if overwrite and self.exists():
      self.delete()
    if not isinstance(schema, _schema.Schema):
      # Convert to a Schema object
      schema = _schema.Schema(schema)
    try:
      response = self._api.tables_insert(self._name_parts, schema=schema._bq_schema)
    except Exception as e:
      raise e
    if 'selfLink' in response:
      self._schema = schema
      return self
    raise Exception("Table %s could not be created as it already exists" % self._full_name)

  def sample(self, fields=None, count=5, sampling=None, use_cache=True):
    """Retrieves a sampling of data from the table.

    Args:
      fields: an optional list of field names to retrieve.
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the table.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResultsTable object containing the resulting data.
    Raises:
      Exception if the sample query could not be executed or query response was malformed.
    """
    sql = self._repr_sql_()
    return _query.Query.sampling_query(sql, context=self._context, count=count, fields=fields,
                                       sampling=sampling).results(use_cache=use_cache)

  @staticmethod
  def _encode_dict_as_row(record, column_name_map):
    """ Encode a dictionary representing a table row in a form suitable for streaming to BQ.

      This includes encoding timestamps as ISO-compatible strings and removing invalid
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
      if isinstance(v, pandas.Timestamp) or isinstance(v, datetime.datetime):
        v = record[k] = record[k].isoformat()

      # If k has invalid characters clean it up
      if k not in column_name_map:
        column_name_map[k] = ''.join(c for c in k if c in Table._VALID_COLUMN_NAME_CHARACTERS)
      new_k = column_name_map[k]
      if k != new_k:
        record[new_k] = v
        del record[k]
    return record

  def insert_data(self, data, include_index=False, index_name=None):
    """ Insert the contents of a Pandas DataFrame or a list of dictionaries into the table.

    The insertion will be performed using at most 500 rows per POST, and at most 10 POSTs per
    second, as BigQuery has some limits on streaming rates.

    Args:
      data: the DataFrame or list to insert.
      include_index: whether to include the DataFrame or list index as a column in the BQ table.
      index_name: for a list, if include_index is True, this should be the name for the index.
          If not specified, 'Index' will be used.
    Returns:
      The table.
    Raises:
      Exception if the table doesn't exist, the table's schema differs from the data's schema,
      or the insert failed.
    """
    # TODO(gram): we could create the Table here is it doesn't exist using a schema derived
    # from the data. IIRC we decided not to but doing so seems less unwieldy that having to
    # create it first and then validate the schema against it itself.

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

    data_schema = _schema.Schema.from_data(data)
    if isinstance(data, list):
      if include_index:
        if not index_name:
          index_name = 'Index'
        data_schema._add_field(index_name, 'INTEGER')

    table_schema = self.schema

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

    is_dataframe = isinstance(data, pandas.DataFrame)
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
        try:
          response = self._api.tabledata_insertAll(self._name_parts, rows)
        except Exception as e:
          raise e
        if 'insertErrors' in response:
          raise Exception('insertAll failed: %s' % response['insertErrors'])

        time.sleep(post_interval)  # Streaming API is rate-limited
        rows = []
    return self

  def _init_job_from_response(self, response):
    """ Helper function to create a Job instance from a response. """
    job = None
    if response and 'jobReference' in response:
      job = _job.Job(job_id=response['jobReference']['jobId'], context=self._context)
    return job

  def extract_async(self, destination, format='csv', csv_delimiter=',', csv_header=True,
                    compress=False):
    """Starts a job to export the table to GCS.

    Args:
      destination: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of 'csv', 'json', or 'avro'
          (default 'csv').
      csv_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      csv_header: for CSV exports, whether to include an initial header line. Default true.
      compress: whether to compress the data on export. Compression is not supported for
          AVRO format. Defaults to False.
    Returns:
      A Job object for the export Job if it was started successfully; else None.
    """
    try:
      response = self._api.table_extract(self._name_parts, destination, format, compress,
                                         csv_delimiter, csv_header)
      return self._init_job_from_response(response)
    except Exception as e:
      raise gcp._util.JobError(location=traceback.format_exc(), message=e.message,
                               reason=str(type(e)))

  def extract(self, destination, format='csv', csv_delimiter=',', csv_header=True, compress=False):
    """Exports the table to GCS; blocks until complete.

    Args:
      destination: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of 'csv', 'json', or 'avro'
          (default 'csv').
      csv_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      csv_header: for CSV exports, whether to include an initial header line. Default true.
      compress: whether to compress the data on export. Compression is not supported for
          AVRO format. Defaults to False.
    Returns:
      A Job object for the completed export Job if it was started successfully; else None.
    """
    format = format.upper()
    if format == 'JSON':
      format = 'NEWLINE_DELIMITED_JSON'
    job = self.extract_async(destination, format=format, csv_delimiter=csv_delimiter,
                             csv_header=csv_header, compress=compress)
    if job is not None:
      job.wait()
    return job

  def load_async(self, source, mode='create', source_format='csv', csv_options=None,
                 ignore_unknown_values=False, max_bad_records=0):
    """ Starts importing a table from GCS and return a Future.

    Args:
      source: the URL of the source objects(s). Can include a wildcard '*' at the end of the item
         name. Can be a single source or a list.
      mode: one of 'create', 'append', or 'overwrite'. 'append' or 'overwrite' will fail if the
          table does not already exist, while 'create' will fail if it does. The default is
          'create'. If 'create' the schema will be inferred if necessary.
      source_format: the format of the data, 'csv' or 'json'; default 'csv'.
      csv_options: if source format is 'csv', additional options as a CSVOptions object.
      ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
          the unknown values are ignored (default False).
      max_bad_records The maximum number of bad records that are allowed (and ignored) before
          returning an 'invalid' error in the Job result (default 0).

    Returns:
      A Job object for the import if it was started successfully or None if not.
    Raises:
      Exception if the load job failed to be started or invalid arguments were supplied.
    """
    if source_format == 'csv':
      source_format = 'CSV'
    elif source_format == 'json':
      source_format = 'NEWLINE_DELIMITED_JSON'
    else:
      raise Exception("Invalid source format %s" % source_format)

    if not(mode == 'create' or mode == 'append' or mode == 'overwrite'):
      raise Exception("Invalid mode %s" % mode)

    if csv_options is None:
      csv_options = _csv_options.CSVOptions()

    try:
      response = self._api.jobs_insert_load(source, self._name_parts,
                                            append=(mode == 'append'),
                                            overwrite=(mode == 'overwrite'),
                                            create=(mode == 'create'),
                                            source_format=source_format,
                                            field_delimiter=csv_options.delimiter,
                                            allow_jagged_rows=csv_options.allow_jagged_rows,
                                            allow_quoted_newlines=csv_options.allow_quoted_newlines,
                                            encoding=csv_options.encoding.upper(),
                                            ignore_unknown_values=ignore_unknown_values,
                                            max_bad_records=max_bad_records,
                                            quote=csv_options.quote,
                                            skip_leading_rows=csv_options.skip_leading_rows)
    except Exception as e:
      raise e
    return self._init_job_from_response(response)

  def load(self, source, mode='create', source_format='csv', csv_options=None,
           ignore_unknown_values=False, max_bad_records=0):
    """ Load the table from GCS.

    Args:
      source: the URL of the source objects(s). Can include a wildcard '*' at the end of the item
         name. Can be a single source or a list.
      mode: one of 'create', 'append', or 'overwrite'. 'append' or 'overwrite' will fail if the
          table does not already exist, while 'create' will fail if it does. The default is
          'create'. If 'create' the schema will be inferred if necessary.
      source_format: the format of the data, 'csv' or 'json'; default 'csv'.
      csv_options: if source format is 'csv', additional options as a CSVOptions object.
      ignore_unknown_values: If True, accept rows that contain values that do not match the schema;
          the unknown values are ignored (default False).
      max_bad_records The maximum number of bad records that are allowed (and ignored) before
          returning an 'invalid' error in the Job result (default 0).

    Returns:
      A Job object for the completed load Job if it was started successfully; else None.
    """
    job = self.load_async(source,
                          mode=mode,
                          source_format=source_format,
                          csv_options=csv_options,
                          ignore_unknown_values=ignore_unknown_values,
                          max_bad_records=max_bad_records)
    if job is not None:
      job.wait()
    return job

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

    schema = self.schema._bq_schema
    name_parts = self._name_parts

    def _retrieve_rows(page_token, count):

      page_rows = []
      if max_rows and count >= max_rows:
        page_token = None
      else:
        if max_rows and page_size > (max_rows - count):
          max_results = max_rows - count
        else:
          max_results = page_size

        try:
          if page_token:
            response = self._api.tabledata_list(name_parts, page_token=page_token,
                                                max_results=max_results)
          else:
            response = self._api.tabledata_list(name_parts, start_index=start_row,
                                                max_results=max_results)
        except Exception as e:
          raise e
        page_token = response['pageToken'] if 'pageToken' in response else None
        if 'rows' in response:
          page_rows = response['rows']

      rows = []
      for row_dict in page_rows:
        rows.append(_parser.Parser.parse_row(schema, row_dict))

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
    return iter(gcp._util.Iterator(fetcher))

  def to_dataframe(self, start_row=0, max_rows=None):
    """ Exports the table to a Pandas dataframe.

    Args:
      start_row: the row of the table at which to start the export (default 0)
      max_rows: an upper limit on the number of rows to export (default None)
    Returns:
      A Pandas dataframe containing the table data.
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
          df = pandas.DataFrame.from_dict(page_rows)
        else:
          df = df.append(page_rows, ignore_index=True)
      if not page_token:
        break

    # Need to reorder the dataframe to preserve column ordering
    ordered_fields = [field.name for field in self.schema]
    return df[ordered_fields] if df is not None else pandas.DataFrame()

  def to_file(self, destination, format='csv', csv_delimiter=',', csv_header=True):
    """Save the results to a local file in CSV format.

    Args:
      destination: path on the local filesystem for the saved results.
      format: the format to use for the exported data; currently only 'csv' is supported.
      csv_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      csv_header: for CSV exports, whether to include an initial header line. Default true.
    Raises:
      An Exception if the operation failed.
    """
    f = codecs.open(destination, 'w', 'utf-8')
    fieldnames = []
    for column in self.schema:
      fieldnames.append(column.name)
    writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=csv_delimiter)
    if csv_header:
      writer.writeheader()
    for row in self:
      writer.writerow(row)
    f.close()

  @gcp._util.async_method
  def to_file_async(self, destination, format='csv', csv_delimiter=',', csv_header=True):
    """Start saving the results to a local file in CSV format and return a Job for completion.

    Args:
      destination: path on the local filesystem for the saved results.
      format: the format to use for the exported data; currently only 'csv' is supported.
      csv_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      csv_header: for CSV exports, whether to include an initial header line. Default true.
    Returns:
      A Job for the async save operation.
    Raises:
      An Exception if the operation failed.
    """
    self.to_file(destination, format=format, csv_delimiter=csv_delimiter, csv_header=csv_header)

  @property
  def schema(self):
    """Retrieves the schema of the table.

    Returns:
      A Schema object containing a list of schema fields and associated metadata.
    Raises
      Exception if the request could not be executed or the response was malformed.
    """
    if not self._schema:
      try:
        self._load_info()
        self._schema = _schema.Schema(self._info['schema']['fields'])
      except KeyError:
        raise Exception('Unexpected table response: missing schema')
    return self._schema

  def update(self, friendly_name=None, description=None, expiry=None, schema=None):
    """ Selectively updates Table information.

    Any parameters that are omitted or None are not updated.

    Args:
      friendly_name: if not None, the new friendly name.
      description: if not None, the new description.
      expiry: if not None, the new expiry time, either as a DateTime or milliseconds since epoch.
      schema: if not None, the new schema: either a list of dictionaries or a Schema.
    """
    self._load_info()
    if friendly_name is not None:
      self._info['friendlyName'] = friendly_name
    if description is not None:
      self._info['description'] = description
    if expiry is not None:
      if isinstance(expiry, datetime.datetime):
        expiry = calendar.timegm(expiry.utctimetuple()) * 1000
      self._info['expirationTime'] = expiry
    if schema is not None:
      if isinstance(schema, _schema.Schema):
        schema = schema._bq_schema
      self._info['schema'] = {'fields': schema}
    try:
      self._api.table_update(self._name_parts, self._info)
    except gcp._util.RequestException:
      # The cached metadata is out of sync now; abandon it.
      self._info = None
    except Exception as e:
      raise e

  def _repr_sql_(self):
    """Returns a representation of the table for embedding into a SQL statement.

    Returns:
      A formatted table name for use within SQL statements.
    """
    return '[' + self._full_name + ']'

  def __repr__(self):
    """Returns a representation for the table for showing in the notebook.
    """
    return 'Table %s' % self._full_name

  def __str__(self):
    """Returns a string representation of the table using its specified name.

    Returns:
      The string representation of this object.
    """
    return self._full_name

  @property
  def length(self):
    """ Get the length of the table (number of rows). We don't use __len__ as this may
        return -1 for 'unknown'.
    """
    return self.metadata.rows

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

  @staticmethod
  def _convert_decorator_time(when):
    if isinstance(when, datetime.datetime):
      value = 1000 * (when - datetime.datetime.utcfromtimestamp(0)).total_seconds()
    elif isinstance(when, datetime.timedelta):
      value = when.total_seconds() * 1000
      if value > 0:
        raise Exception("Invalid snapshot relative when argument: %s" % str(when))
    else:
      raise Exception("Invalid snapshot when argument type: %s" % str(when))

    if value < -Table._MSEC_PER_WEEK:
      raise Exception("Invalid snapshot relative when argument: must be within 7 days: %s"
                      % str(when))

    if value > 0:
      now = 1000 * (datetime.datetime.utcnow() -
                    datetime.datetime.utcfromtimestamp(0)).total_seconds()
      # Check that an abs value is not more than 7 days in the past and is
      # not in the future
      if not ((now - Table._MSEC_PER_WEEK) < value < now):
        raise Exception("Invalid snapshot absolute when argument: %s" % str(when))

    return int(value)

  def snapshot(self, at):
    """ Return a new Table which is a snapshot of this table at the specified time.

    Args:
      at: the time of the snapshot. This can be a Python datetime (absolute) or timedelta
          (relative to current time). The result must be after the table was created and no more
          than seven days in the past. Passing None will get a reference the oldest snapshot.

          Note that using a datetime will get a snapshot at an absolute point in time, while
          a timedelta will provide a varying snapshot; any queries issued against such a Table
          will be done against a snapshot that has an age relative to the execution time of the
          query.

    Returns:
      A new Table object referencing the snapshot.

    Raises:
      An exception if this Table is already decorated, or if the time specified is invalid.
    """
    if self._name_parts.decorator != '':
      raise Exception("Cannot use snapshot() on an already decorated table")

    value = Table._convert_decorator_time(at)
    return Table("%s@%s" % (self._full_name, str(value)), context=self._context)

  def window(self, begin, end=None):
    """ Return a new Table limited to the rows added to this Table during the specified time range.

    Args:
      begin: the start time of the window. This can be a Python datetime (absolute) or timedelta
          (relative to current time). The result must be after the table was created and no more
          than seven days in the past.

          Note that using a relative value will provide a varying snapshot, not a fixed
          snapshot; any queries issued against such a Table will be done against a snapshot
          that has an age relative to the execution time of the query.

      end: the end time of the snapshot; if None, then the current time is used. The types and
          interpretation of values is as for start.

    Returns:
      A new Table object referencing the window.

    Raises:
      An exception if this Table is already decorated, or if the time specified is invalid.
    """
    if self._name_parts.decorator != '':
      raise Exception("Cannot use window() on an already decorated table")

    start = Table._convert_decorator_time(begin)
    if end is None:
      if isinstance(begin, datetime.timedelta):
        end = datetime.timedelta(0)
      else:
        end = datetime.datetime.utcnow()
    stop = Table._convert_decorator_time(end)

    # Both values must have the same sign
    if (start > 0 >= stop) or (stop > 0 >= start):
      raise Exception("window: Between arguments must both be absolute or relative: %s, %s" %
                      (str(begin), str(end)))

    # start must be less than stop
    if start > stop:
      raise Exception("window: Between arguments: begin must be before end: %s, %s" %
                      (str(begin), str(end)))

    return Table("%s@%s-%s" % (self._full_name, str(start), str(stop)), context=self._context)

  def to_query(self, fields=None):
    """ Return a Query for this Table.

    Args:
      fields: the fields to return. If None, all fields will be returned. This can be a string
          which will be injected into the Query after SELECT, or a list of field names.

    Returns:
      A Query object that will return the specified fields from the records in the Table.
    """
    if fields is None:
      fields = '*'
    elif isinstance(fields, list):
      fields = ','.join(fields)
    return _query.Query('SELECT %s FROM %s' % (fields, self._repr_sql_()), context=self._context)

import _query
