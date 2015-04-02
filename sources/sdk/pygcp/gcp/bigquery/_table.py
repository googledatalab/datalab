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
import csv
from datetime import datetime
import math
import pandas as pd
import time
import uuid

from gcp._util import Iterator as _Iterator
from ._base_table import BaseTable as _BaseTable
from ._job import Job as _Job
from ._parser import Parser as _Parser
from ._schema import Schema as _Schema


# import of Query is at end of module as we have a circular dependency of
# Query.execute().results -> Table and Table.sample() -> Query


class Table(_BaseTable):
  """Represents a Table object referencing a BigQuery table.

  This object can be used to inspect tables and create SQL queries.
  """

  # When fetching table contents, the max number of rows to fetch per HTTP request
  _DEFAULT_PAGE_SIZE = 1024

  def __init__(self, api, name):
    """Initializes an instance of a Table object.

    Args:
      api: the BigQuery API object to use to issue requests.
      name: the name of the table either as a string or a 3-part tuple (projectid, datasetid, name).
    """
    super(Table, self).__init__(api, name)
    self._cached_page = None
    self._cached_page_index = 0

  def create(self, schema, overwrite=False):
    """ Create the table with the specified schema.

    Args:
      schema: the schema to use to create the table. Should be a list of dictionaries, each
          containing at least a pair of entries, 'name' and 'type'.
          See https://cloud.google.com/bigquery/docs/reference/v2/tables#resource
      overwrite: if True, delete the object first if it exists. If False and the object exists,
          creation will fail and raise an Exception.
    Returns:
      The Table instance.
    Raises:
      Exception if the table couldn't be created or already exists and overwrite was False.
    """
    return super(Table, self).create(schema=schema, overwrite=overwrite)

  @property
  def is_temporary(self):
    """ Whether this is a short-lived table or not. """
    return self._is_temporary

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

    data_schema = _Schema(data=data)
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

    schema = self.schema
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
          df = df.append(page_rows, ignore_index=True)
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
    for column in self.schema:
      fieldnames.append(column.name)
    writer = csv.DictWriter(f, fieldnames=fieldnames, dialect=dialect)
    if write_header:
      writer.writeheader()
    for row in self.range(max_rows, start_row=start_row):
      writer.writerow(row)
    f.close()

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


