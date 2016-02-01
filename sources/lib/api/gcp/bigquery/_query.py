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

"""Implements Query BigQuery API."""

import re
import gcp._util
import gcp.data
import _api
import _federated_table
import _sampling
import _udf
import _utils


class Query(object):
  """Represents a Query object that encapsulates a BigQuery SQL query.

  This object can be used to execute SQL queries and retrieve results.
  """

  @staticmethod
  def sampling_query(sql, context, fields=None, count=5, sampling=None, udfs=None,
                     data_sources=None):
    """Returns a sampling Query for the SQL object.

    Args:
      sql: the SQL statement (string) or Query object to sample.
      context: a Context object providing project_id and credentials.
      fields: an optional list of field names to retrieve.
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the table.
      udfs: array of UDFs referenced in the SQL.
      data_sources: dictionary of federated (external) tables referenced in the SQL.
    Returns:
      A Query object for sampling the table.
    """
    return Query(_sampling.Sampling.sampling_query(sql, fields, count, sampling), context=context,
                 udfs=udfs, data_sources=data_sources)

  def __init__(self, sql, context=None, values=None, udfs=None, data_sources=None, **kwargs):
    """Initializes an instance of a Query object.
       Note that either values or kwargs may be used, but not both.

    Args:
      sql: the BigQuery SQL query string to execute, or a SqlStatement object. The latter will
          have any variable references replaced before being associated with the Query (i.e.
          once constructed the SQL associated with a Query is static).

          It is possible to have variable references in a query string too provided the variables
          are passed as keyword arguments to this constructor.

      context: an optional Context object providing project_id and credentials. If a specific
          project id or credentials are unspecified, the default ones configured at the global
          level are used.
      values: a dictionary used to expand variables if passed a SqlStatement or a string with
          variable references.
      udfs: array of UDFs referenced in the SQL.
      data_sources: dictionary of federated (external) tables referenced in the SQL.
      kwargs: arguments to use when expanding the variables if passed a SqlStatement
          or a string with variable references.

    Raises:
      Exception if expansion of any variables failed.
      """
    if context is None:
      context = gcp.Context.default()
    self._context = context
    self._api = _api.Api(context)
    self._data_sources = data_sources
    self._udfs = udfs

    if data_sources is None:
      data_sources = {}

    self._results = None
    self._code = None
    self._imports = []
    if values is None:
      values = kwargs

    self._sql = gcp.data.SqlModule.expand(sql, values, udfs)

    # We need to take care not to include the same UDF code twice so we use sets.
    udfs = set(udfs if udfs else [])
    for value in values.values():
      if isinstance(value, _udf.UDF):
        udfs.add(value)
    included_udfs = set([])

    tokens = gcp.data.tokenize(self._sql)
    udf_dict = {udf.name: udf for udf in udfs}

    for i, token in enumerate(tokens):
      # Find the preceding and following non-whitespace tokens
      prior = i - 1
      while prior >= 0 and tokens[prior].isspace():
        prior -= 1
      if prior < 0:
        continue
      next = i + 1
      while next < len(tokens) and tokens[next].isspace():
        next += 1
      if next >= len(tokens):
        continue

      uprior = tokens[prior].upper()
      if uprior != 'FROM' and uprior != 'JOIN':
        continue

      # Check for external tables.
      if tokens[next] not in "[('\"":
        if token not in data_sources:
          if values and token in values:
            if isinstance(values[token], _federated_table.FederatedTable):
              data_sources[token] = values[token]

      # Now check for UDF calls.
      if uprior != 'FROM' or tokens[next] != '(':
        continue

      # We have a 'FROM token (' sequence.

      if token in udf_dict:
        udf = udf_dict[token]
        if token not in included_udfs:
          included_udfs.add(token)
          if self._code is None:
            self._code = []
          self._code.append(udf.code)
          if udf.imports:
            self._imports.extend(udf.imports)

        fields = ', '.join([f[0] for f in udf._outputs])
        tokens[i] = '(SELECT %s FROM %s' % (fields, token)

        # Find the closing parenthesis and add the additional one now needed.
        num_paren = 0
        j = i + 1
        while j < len(tokens):
          if tokens[j] == '(':
            num_paren += 1
          elif tokens[j] == ')':
            num_paren -= 1
            if num_paren == 0:
              tokens[j] = '))'
              break
          j += 1

    self._external_tables = None
    if len(data_sources):
      self._external_tables = {}
      for name, table in data_sources.items():
        if table.schema is None:
          raise Exception('Referenced external table %s has no known schema' % name)
        self._external_tables[name] = table._to_query_json()

    self._sql = ''.join(tokens)

  def _repr_sql_(self):
    """Creates a SQL representation of this object.

    Returns:
      The SQL representation to use when embedding this object into other SQL.
    """
    return '(%s)' % self._sql

  def __str__(self):
    """Creates a string representation of this object.

    Returns:
      The string representation of this object (the unmodified SQL).
    """
    return self._sql

  def __repr__(self):
    """Creates a friendly representation of this object.

    Returns:
      The friendly representation of this object (the unmodified SQL).
    """
    return self._sql

  @property
  def sql(self):
    """ Get the SQL for the query. """
    return self._sql

  @property
  def scripts(self):
    """ Get the code for any Javascript UDFs used in the query. """
    return self._code

  def results(self, use_cache=True):
    """Retrieves table of results for the query. May block if the query must be executed first.

    Args:
      use_cache: whether to use cached results or not. Ignored if append is specified.
    Returns:
      A QueryResultsTable containing the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    if not use_cache or (self._results is None):
      self.execute(use_cache=use_cache)
    return self._results.results

  def extract(self, storage_uris, format='csv', csv_delimiter=',', csv_header=True,
              compress=False, use_cache=True):
    """Exports the query results to GCS.

    Args:
      storage_uris: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of 'csv', 'json', or 'avro'
          (default 'csv').
      csv_delimiter: for csv exports, the field delimiter to use (default ',').
      csv_header: for csv exports, whether to include an initial header line (default True).
      compress whether to compress the data on export. Compression is not supported for
          AVRO format (default False).
      use_cache: whether to use cached results or not (default True).
    Returns:
      A Job object for the export Job if it was completed successfully; else None.
    Raises:
      An Exception if the query or extract failed.
    """
    return self.results(use_cache=use_cache).extract(storage_uris, format=format,
                                                     csv_delimiter=csv_delimiter,
                                                     csv_header=csv_header, compress=compress)

  @gcp._util.async_method
  def extract_async(self, storage_uris, format='csv', csv_delimiter=',',
                    csv_header=True, compress=False, use_cache=True):
    """Exports the query results to GCS. Returns a Job immediately.

    Note that there are two jobs that may need to be run sequentially, one to run the query,
    and the second to extract the resulting table. These are wrapped by a single outer Job.

    If the query has already been executed and you would prefer to get a Job just for the
    extract, you can can call extract_async on the QueryResultsTable instead; i.e.:

        query.results().extract_async(...)

    Args:
      storage_uris: the destination URI(s). Can be a single URI or a list.
      format: the format to use for the exported data; one of 'csv', 'json', or 'avro'
          (default 'csv').
      csv_delimiter: for CSV exports, the field delimiter to use (default ',').
      csv_header: for CSV exports, whether to include an initial header line (default True).
      compress whether to compress the data on export. Compression is not supported for
          AVRO format (default False).
      use_cache: whether to use cached results or not (default True).
    Returns:
      A Job for the combined (execute, extract) task that will in turn return the Job object for
      the completed extract task when done; else None.
    Raises:
      An Exception if the query failed.
    """
    return self.extract(storage_uris, format=format,
                        csv_delimiter=csv_delimiter, csv_header=csv_header,
                        use_cache=use_cache, compress=compress)

  def to_dataframe(self, start_row=0, max_rows=None, use_cache=True):
    """ Exports the query results to a Pandas dataframe.

    Args:
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not (default True).
    Returns:
      A Pandas dataframe containing the table data.
    """
    return self.results(use_cache=use_cache) \
        .to_dataframe(start_row=start_row, max_rows=max_rows)

  def to_file(self, path, format='csv', csv_delimiter=',', csv_header=True, use_cache=True):
    """Save the results to a local file in CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      format: the format to use for the exported data; currently only 'csv' is supported.
      csv_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      csv_header: for CSV exports, whether to include an initial header line. Default true.
      use_cache: whether to use cached results or not.
    Returns:
      The path to the local file.
    Raises:
      An Exception if the operation failed.
    """
    self.results(use_cache=use_cache) \
        .to_file(path, format=format, csv_delimiter=csv_delimiter, csv_header=csv_header)
    return path

  @gcp._util.async_method
  def to_file_async(self, path, format='csv', csv_delimiter=',', csv_header=True, use_cache=True):
    """Save the results to a local file in CSV format. Returns a Job immediately.

    Args:
      path: path on the local filesystem for the saved results.
      format: the format to use for the exported data; currently only 'csv' is supported.
      csv_delimiter: for CSV exports, the field delimiter to use. Defaults to ','
      csv_header: for CSV exports, whether to include an initial header line. Default true.
      use_cache: whether to use cached results or not.
    Returns:
      A Job for the save that returns the path to the local file on completion.
    Raises:
      An Exception if the operation failed.
    """
    return self.to_file(path, format=format, csv_delimiter=csv_delimiter, csv_header=csv_header,
                        use_cache=use_cache)

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
    return Query.sampling_query(self._sql, self._context, count=count, fields=fields,
                                sampling=sampling, udfs=self._udfs,
                                data_sources=self._data_sources).results(use_cache=use_cache)

  def execute_dry_run(self):
    """Dry run a query, to check the validity of the query and return some useful statistics.

    Returns:
      A dict with 'cacheHit' and 'totalBytesProcessed' fields.
    Raises:
      An exception if the query was malformed.
    """
    try:
      query_result = self._api.jobs_insert_query(self._sql, self._code, self._imports, dry_run=True,
                                                 table_definitions=self._external_tables)
    except Exception as e:
      raise e
    return query_result['statistics']['query']

  def execute_async(self, table_name=None, table_mode='create', use_cache=True,
                    priority='interactive', allow_large_results=False):
    """ Initiate the query and return a QueryJob.

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
    Returns:
      A QueryJob.
    Raises:
      Exception if query could not be executed.
    """
    batch = priority == 'low'
    append = table_mode == 'append'
    overwrite = table_mode == 'overwrite'
    if table_name is not None:
      table_name = _utils.parse_table_name(table_name, self._api.project_id)

    try:
      query_result = self._api.jobs_insert_query(self._sql, self._code, self._imports,
                                                 table_name=table_name,
                                                 append=append,
                                                 overwrite=overwrite,
                                                 use_cache=use_cache,
                                                 batch=batch,
                                                 allow_large_results=allow_large_results,
                                                 table_definitions=self._external_tables)
    except Exception as e:
      raise e
    if 'jobReference' not in query_result:
      raise Exception('Unexpected response from server')

    job_id = query_result['jobReference']['jobId']
    if not table_name:
      try:
        destination = query_result['configuration']['query']['destinationTable']
        table_name = (destination['projectId'], destination['datasetId'], destination['tableId'])
      except KeyError:
        # The query was in error
        raise Exception(_utils.format_query_errors(query_result['status']['errors']))
    return _query_job.QueryJob(job_id, table_name, self._sql, context=self._context)

  def execute(self, table_name=None, table_mode='create', use_cache=True, priority='interactive',
              allow_large_results=False):
    """ Initiate the query, blocking until complete and then return the results.

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
    Returns:
      The QueryResultsTable for the query.
    Raises:
      Exception if query could not be executed.
    """
    job = self.execute_async(table_name=table_name, table_mode=table_mode, use_cache=use_cache,
                             priority=priority, allow_large_results=allow_large_results)
    self._results = job.wait()
    return self._results

  def to_view(self, view_name):
    """ Create a View from this Query.

    Args:
      view_name: the name of the View either as a string or a 3-part tuple
          (projectid, datasetid, name).

    Returns:
      A View for the Query.
    """
    return _view.View(view_name, self._context).create(self._sql)

import _query_job
import _view
