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

"""Implements Query BigQuery API."""

from gcp._util import async_method
from ._sampling import Sampling as _Sampling
from ._utils import parse_table_name as _parse_table_name


class Query(object):
  """Represents a Query object that encapsulates a BigQuery SQL query.

  This object can be used to execute SQL queries and retrieve results.
  """

  @staticmethod
  def sampling_query(api, sql, fields=None, count=5, sampling=None):
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
    # This was the cause of circular dependencies between Query and Table hence it was
    # moved here.
    if sampling is None:
      sampling = _Sampling.default(count=count, fields=fields)
    sampling_sql = sampling(sql)

    return Query(api, sampling_sql)

  def __init__(self, api, sql):
    """Initializes an instance of a Query object.

    Args:
      api: the BigQuery API object to use to issue requests.
      sql: the BigQuery SQL string to execute.
    """
    self._api = api
    self._sql = sql
    self._results = None

  @property
  def sql(self):
    return self._sql

  def results(self, use_cache=True):
    """Retrieves results for the query.

    Args:
      use_cache: whether to use cached results or not. Ignored if append is specified.
    Returns:
      A QueryResultsTable containing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    if not use_cache or (self._results is None):
      self.execute(use_cache=use_cache, batch=False)
    return self._results

  def extract(self, destination, format='CSV', compress=False, field_delimiter=',',
              print_header=True, use_cache=True):
    """Exports the query results to GCS.

    Args:
      destination: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO
          (default 'CSV').
      compress whether to compress the data on export. Compression is not supported for
          AVRO format (default False).
      field_delimiter: for CSV exports, the field delimiter to use (default ',').
      print_header: for CSV exports, whether to include an initial header line (default True).
      use_cache: whether to use cached results or not (default True).
    Returns:
      A Job object for the export Job if it was completed successfully; else None.
    Raises:
      An Exception if the query or extract failed.
    """
    results = self.results(use_cache=use_cache)
    job = results.extract(destination, format=format, compress=compress,
                          field_delimiter=field_delimiter, print_header=print_header)
    if job is not None:
      job.wait()
    return job

  @async_method
  def extract_async(self, destination, format='CSV', compress=False, field_delimiter=',',
                    print_header=True, use_cache=True):
    """Exports the query results to GCS. Returns a Future immediately.

    Args:
      destination: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO
          (default 'CSV').
      compress whether to compress the data on export. Compression is not supported for
          AVRO format (default False).
      field_delimiter: for CSV exports, the field delimiter to use (default ',').
      print_header: for CSV exports, whether to include an initial header line (default True).
      use_cache: whether to use cached results or not (default True).
    Returns:
      A Future that returns a Job object for the export if it was started successfully; else None.
    Raises:
      An Exception if the query failed.
    """
    return self.extract(destination, format=format, compress=compress,
                        field_delimiter=field_delimiter, print_header=print_header,
                        use_cache=use_cache)

  def to_dataframe(self, start_row=0, max_rows=None, use_cache=True):
    """ Exports the query results to a Pandas dataframe.

    Args:
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not (default True).
    Returns:
      A dataframe containing the table data.
    """
    return self.results(use_cache=use_cache) \
        .to_dataframe(start_row=start_row, max_rows=max_rows)

  def to_file(self, path, start_row=0, max_rows=None, use_cache=True, write_header=True):
    """Save the results to a local file in Excel CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file.
    Returns:
      The path to the local file.
    Raises:
      An Exception if the operation failed.
    """
    self.results(use_cache=use_cache) \
        .to_file(path, start_row=start_row, max_rows=max_rows, write_header=write_header)
    return path

  @async_method
  def to_file_async(self, path, start_row=0, max_rows=None, use_cache=True, write_header=True):
    """Save the results to a local file in Excel CSV format. Returns a Job immediately.

    Args:
      path: path on the local filesystem for the saved results.
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file.
    Returns:
      A Job returning the path to the local file.
    Raises:
      An Exception if the operation failed.
    """
    return self.to_file(path, start_row=start_row, max_rows=max_rows, use_cache=use_cache,
                        write_header=write_header)

  def sample(self, count=5, fields=None, sampling=None, use_cache=True):
    """Retrieves a sampling of rows for the query.

    Args:
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified (default 5).
      fields: the list of fields to sample (default None implies all).
      sampling: an optional sampling strategy to apply to the table.
      use_cache: whether to use cached results or not (default True).
    Returns:
      A QueryResultsTable containing a sampling of the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    return Query.sampling_query(self._api, self._sql, count=count, fields=fields,
                                sampling=sampling).\
        results(use_cache=use_cache)

  def execute_dry_run(self):
    """Dry run a query, to check the validity of the query and return statistics.

    Returns:
        dict, with cacheHit and totalBytesProcessed fields.
    """
    query_result = self._api.jobs_insert_query(self._sql, dry_run=True)
    return query_result['statistics']['query']

  def execute_async(self, table_name=None, append=False, overwrite=False, use_cache=True,
                    batch=True, allow_large_results=False):
    """ Initiate the query and return the Job.

    Args:
      dataset_id: the datasetId for the result table.
      table_name: the result table name as a string or TableName; if None (the default), then a
          temporary table will be used.
      append: if True, append to the table if it is non-empty; else the request will fail if table
          is non-empty unless overwrite is True (default False).
      overwrite: if the table already exists, truncate it instead of appending or raising an
          Exception (default False).
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified (default True).
      batch: whether to run this as a batch job (lower priority) or as an interactive job (high
        priority, more expensive) (default True).
      allow_large_results: whether to allow large results; i.e. compressed data over 100MB. This is
          slower and requires a table_name to be specified) (default False).
    Returns:
      The QueryJob.
    Raises:
      Exception if query could not be executed.
    """
    if table_name is not None:
      table_name = _parse_table_name(table_name, self._api.project_id)

    query_result = self._api.jobs_insert_query(self._sql,
                                               table_name=table_name,
                                               append=append,
                                               overwrite=overwrite,
                                               use_cache=use_cache,
                                               batch=batch,
                                               allow_large_results=allow_large_results)
    if 'jobReference' not in query_result:
      raise Exception('Unexpected query response.')

    job_id = query_result['jobReference']['jobId']
    if not table_name:
      try:
        destination = query_result['configuration']['query']['destinationTable']
        table_name = (destination['projectId'], destination['datasetId'], destination['tableId'])
      except KeyError:
        # The query was in error
        raise Exception('Query failed: %s' % str(query_result['status']['errors']))
    return _QueryJob(self._api, job_id, table_name, self._sql)

  def execute(self, table_name=None, append=False, overwrite=False, use_cache=True,
               batch=True, allow_large_results=False):
    """ Initiate the query, block until complete and return the results.

    Args:
      table_name: the result table name as a string or TableName; if None (the default), then a
          temporary table will be used.
      append: if True, append to the table if it is non-empty; else the request will fail if table
          is non-empty unless overwrite is True (default False).
      overwrite: if the table already exists, truncate it instead of appending or raising an
          Exception (default False).
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified (default True).
      batch: whether to run this as a batch job (lower priority) or as an interactive job (high
        priority, more expensive) (default True).
      allow_large_results: whether to allow large results; i.e. compressed data over 100MB. This is
          slower and requires a table_name to be specified) (default False).
    Returns:
      The Query results Table.
    Raises:
      Exception if query could not be executed.
    """
    job = self.execute_async(table_name=table_name, append=append, overwrite=overwrite,
                             use_cache=use_cache, batch=batch,
                             allow_large_results=allow_large_results)
    self._results = job.results
    return self._results

  def save_as_view(self, view_name):
    """ Create a View from this Query.

    Args:
      view_name: the name of the View either as a string or a 3-part tuple
          (projectid, datasetid, name).

    Returns:
      A View for the Query.
    """
    return _View(self._api, view_name).create(self.sql)

  def _repr_sql_(self):
    """Creates a SQL representation of this object.

    Returns:
      The SQL representation to use when embedding this object into SQL.
    """
    return '(' + self._sql + ')'

  def __str__(self):
    """Creates a string representation of this object.

    Returns:
      The string representation of this object.
    """
    return self._sql

from ._query_job import QueryJob as _QueryJob
from ._view import View as _View
