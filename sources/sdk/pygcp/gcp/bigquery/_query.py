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
from ._utils import parse_table_name as _parse_table_name


class Query(_util.SqlStatement):
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
    return Query(api, _util.Sampling.sampling_query(sql, fields, count, sampling))

  def __init__(self, api, sql):
    """Initializes an instance of a Query object.

    Args:
      api: the BigQuery API object to use to issue requests.
      sql: the BigQuery SQL string to execute.
    """
    super(Query, self).__init__(sql)
    self._api = api
    self._expanded_sql = None
    self._results = None

  def results(self, use_cache=True, args=None):
    """Retrieves last results for the query.

    Args:
      use_cache: whether to use cached results or not. Ignored if append is specified.
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A QueryResultsTable containing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    # If we could be returning locally cached results make sure SQL hasn't changed.
    if use_cache and self._results:
      if self.expand(args) != self._expanded_sql:
        self._results = None  # discard cached results

    if not use_cache or (self._results is None):
      self.execute(use_cache=use_cache, batch=False, args=args)
    return self._results.results

  def extract(self, storage_uris, format='csv', csv_delimiter=',', csv_header=True,
              use_cache=True, compress=False, args=None):
    """Exports the query results to GCS.

    Args:
      storage_uris: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of CSV, NEWLINE_DELIMITED_JSON or AVRO
          (default 'CSV').
      csv_delimiter: for CSV exports, the field delimiter to use (default ',').
      csv_header: for CSV exports, whether to include an initial header line (default True).
      use_cache: whether to use cached results or not (default True).
      compress whether to compress the data on export. Compression is not supported for
          AVRO format (default False).
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A Job object for the export Job if it was completed successfully; else None.
    Raises:
      An Exception if the query or extract failed.
    """
    results = self.results(use_cache=use_cache, args=args)
    job = results.extract(storage_uris, format=format, csv_delimiter=csv_delimiter,
                          csv_header=csv_header, compress=compress)
    if job is not None:
      job.wait()
    return job

  @async_method
  def extract_async(self, storage_uris, format='csv', csv_delimiter=',',
                    csv_header=True, use_cache=True, compress=False, args=args):
    """Exports the query results to GCS. Returns a Future immediately.

    Args:
      storage_uris: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of 'csv', 'json', or 'avro'
          (default 'csv').
      csv_delimiter: for CSV exports, the field delimiter to use (default ',').
      csv_header: for CSV exports, whether to include an initial header line (default True).
      use_cache: whether to use cached results or not (default True).
      compress whether to compress the data on export. Compression is not supported for
          AVRO format (default False).
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A Future that returns a Job object for the export if it was started successfully; else None.
    Raises:
      An Exception if the query failed.
    """
    return self.extract(storage_uris, format=format,
                        csv_delimiter=csv_delimiter, csv_header=csv_header,
                        use_cache=use_cache, compress=compress, args=args)

  def to_dataframe(self, start_row=0, max_rows=None, use_cache=True, args=None):
    """ Exports the query results to a Pandas dataframe.

    Args:
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not (default True).
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A dataframe containing the table data.
    """
    return self.results(use_cache=use_cache, args=args) \
        .to_dataframe(start_row=start_row, max_rows=max_rows)

  def to_file(self, path, start_row=0, max_rows=None, use_cache=True, write_header=True, args=None):
    """Save the results to a local file in Excel CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file.
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      The path to the local file.
    Raises:
      An Exception if the operation failed.
    """
    self.results(use_cache=use_cache, args=args) \
        .to_file(path, start_row=start_row, max_rows=max_rows, write_header=write_header)
    return path

  @async_method
  def to_file_async(self, path, start_row=0, max_rows=None, use_cache=True, write_header=True, args=None):
    """Save the results to a local file in Excel CSV format. Returns a Job immediately.

    Args:
      path: path on the local filesystem for the saved results.
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file.
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A Job returning the path to the local file.
    Raises:
      An Exception if the operation failed.
    """
    return self.to_file(path, start_row=start_row, max_rows=max_rows, use_cache=use_cache,
                        write_header=write_header, args=args)

  def sample(self, count=5, fields=None, sampling=None, use_cache=True):
    """Retrieves a sampling of rows for the query.

    Args:
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified (default 5).
      fields: the list of fields to sample (default None implies all).
      sampling: an optional sampling strategy to apply to the table.
      use_cache: whether to use cached results or not (default True).
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A QueryResultsTable containing a sampling of the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    return Query.sampling_query(self._api, self.expand(args), count=count,
                                fields=fields, sampling=sampling).results(use_cache=use_cache)

  def execute_dry_run(self, args=None):
    """Dry run a query, to check the validity of the query and return statistics.

    Args:
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
        dict, with cacheHit and totalBytesProcessed fields.
    """
    query_result = self._api.jobs_insert_query(self.expand(args), dry_run=True)
    return query_result['statistics']['query']

  def execute_async(self, table_name=None, table_mode='create', use_cache=True,
                    priority='interactive', allow_large_results=False, args=None):
    """ Initiate the query and return the Job.

    Args:
      dataset_id: the datasetId for the result table.
      table_name: the result table name as a string or TableName; if None (the default), then a
          temporary table will be used.
      table_mode: one of 'create', 'overwrite' or 'append'. If 'create' (the default), the request
          will fail if the table exists.
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified (default True).
      priority:one of 'batch' or 'interactive' (default). 'interactive' jobs should be scheduled
          to run quickly but are subject to rate limits; 'batch' jobs could be delayed by as much
          as three hours but are not rate-limited.
      allow_large_results: whether to allow large results; i.e. compressed data over 100MB. This is
          slower and requires a table_name to be specified) (default False).
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      The QueryJob.
    Raises:
      Exception if query could not be executed.
    """
    batch = priority == 'low'
    append = table_mode == 'append'
    overwrite = table_mode == 'overwrite'
    if table_name is not None:
      table_name = _parse_table_name(table_name, self._api.project_id)

    # TODO(gram): Can we do away with this late binding now? We would need to check all places
    # where we instantiate bq.Query and make sure those use expanded SQL.
    self._expanded_sql = self.expand(args)

    query_result = self._api.jobs_insert_query(self._expanded_sql,
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
    return _QueryJob(self._api, job_id, table_name, self._expanded_sql)

  def execute(self, table_name=None, table_mode='create', use_cache=True, priority='interactive',
              allow_large_results=False, args=None):
    """ Initiate the query, block until complete and return the results.

    Args:
      table_name: the result table name as a string or TableName; if None (the default), then a
          temporary table will be used.
      table_mode: one of 'create', 'overwrite' or 'append'. If 'create' (the default), the request
          will fail if the table exists.
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified (default True).
      priority:one of 'batch' or 'interactive' (default). 'interactive' jobs should be scheduled
          to run quickly but are subject to rate limits; 'batch' jobs could be delayed by as much
          as three hours but are not rate-limited.
      allow_large_results: whether to allow large results; i.e. compressed data over 100MB. This is
          slower and requires a table_name to be specified) (default False).
      args: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      The Query results Table.
    Raises:
      Exception if query could not be executed.
    """
    job = self.execute_async(table_name=table_name, table_mode=table_mode, use_cache=use_cache,
                             priority=priority, allow_large_results=allow_large_results, args=args)
    self._results = job.wait()
    return self._results

  def to_view(self, view_name):
    """ Create a View from this Query.

    Args:
      view_name: the name of the View either as a string or a 3-part tuple
          (projectid, datasetid, name).
      args: an optional dictionary to use when expanding the variables in the SQL.

    Returns:
      A View for the Query.
    """
    return _View(self._api, view_name).create(self.expand(args))

from ._query_job import QueryJob as _QueryJob
from ._view import View as _View
