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

import sys as _sys
import gcp._util as _util
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
    self._raw_sql = sql
    self._expanded_sql = None
    self._results = None

  @property
  def sql(self):
    return self._raw_sql

  def _expand(self, sql, ns, complete, in_progress):
    """ Recursive helper method for expanding variables including transitive dependencies. """

    dependencies = _util.Sql.get_dependencies(sql)
    for dependency in dependencies:
      if dependency in complete:
        continue
      if dependency not in ns:
        raise Exception("Unsatisfied dependency $%s" % dependency)
      dep = ns[dependency]
      if isinstance(dep, Query):
        if dependency in in_progress:
          # Circular dependency
          raise Exception("Circular dependency in $%s" % dependency)
        in_progress.append(dependency)
        expanded = self._expand(dep._raw_sql, ns, complete, in_progress)
        in_progress.pop()
        complete[dependency] = Query(self._api, expanded)
      else:
        complete[dependency] = dep
    return _util.Sql.format(sql, complete)

  def expand_sql(self, env=None):
    """ Resolve variable references in a query within an environment.

    This computes and resolves the transitive dependencies in the query and raises an
    exception if that fails due to either undefined or circular references.

    Args:
      env: a dictionary of optional value overrides to use in variable expansion.

    Returns:
      The resolved SQL text.

    Raises:
      Exception on failure.
    """
    ns = {}
    if env:
      ns.update(env)
    else:
      ns.update(_sys.modules['__main__'].__dict__)
    return self._expand(self._raw_sql, ns, complete={}, in_progress=[])

  def results(self, use_cache=True, env=None):
    """Retrieves last results for the query.

    Args:
      use_cache: whether to use cached results or not. Ignored if append is specified.
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A QueryResultsTable containing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    # If we could be returning locally cached results make sure SQL hasn't changed.
    if use_cache and self._results:
      if self.expand_sql(env) != self._expanded_sql:
        self._results = None  # discard cached results

    if not use_cache or (self._results is None):
      self.execute(use_cache=use_cache, batch=False, env=env)
    return self._results.results

  def extract(self, destination, format='CSV', compress=False, field_delimiter=',',
              print_header=True, use_cache=True, env=None):
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
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A Job object for the export Job if it was started successfully; else None.
    Raises:
      An Exception if the query timed out or failed.
    """
    return self.results(use_cache=use_cache, env=env)\
        .extract(destination, format=format, compress=compress, field_delimiter=field_delimiter,
                 print_header=print_header)

  def to_dataframe(self, start_row=0, max_rows=None, use_cache=True, env=None):
    """ Exports the query results to a Pandas dataframe.

    Args:
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not (default True).
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A dataframe containing the table data.
    """
    return self.results(use_cache=use_cache, env=env) \
        .to_dataframe(start_row=start_row, max_rows=max_rows)

  def to_file(self, path, start_row=0, max_rows=None, use_cache=True, write_header=True, env=None):
    """Save the results to a local file in Excel CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      start_row: the row of the table at which to start the export (default 0).
      max_rows: an upper limit on the number of rows to export (default None).
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file.
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      The path to the local file.
    Raises:
      An Exception if the operation failed.
    """
    self.results(use_cache=use_cache, env=env) \
        .to_file(path, start_row=start_row, max_rows=max_rows, write_header=write_header)
    return path

  def sample(self, count=5, fields=None, sampling=None, use_cache=True, env=None):
    """Retrieves a sampling of rows for the query.

    Args:
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified (default 5).
      fields: the list of fields to sample (default None implies all).
      sampling: an optional sampling strategy to apply to the table.
      use_cache: whether to use cached results or not (default True).
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A QueryResultsTable containing a sampling of the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    return Query.sampling_query(self._api, self.expand_sql(env), count=count, fields=fields,
                                sampling=sampling).\
        results(use_cache=use_cache)

  def execute_async(self, table_name=None, append=False, overwrite=False, use_cache=True,
                    batch=True, allow_large_results=False, env=None):
    """ Initiate the query and return immediately.

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
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A Job for the query
    Raises:
      Exception if query could not be executed.
    """
    if table_name is not None:
      table_name = _parse_table_name(table_name, self._api.project_id)

    self._expanded_sql = self.expand_sql(env)

    query_result = self._api.jobs_insert_query(self._expanded_sql,
                                               table_name=table_name,
                                               append=append,
                                               overwrite=overwrite,
                                               dry_run=False,
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

  def execute(self, table_name=None, append=False, overwrite=False, use_cache=True, batch=True,
              allow_large_results=False, env=None):
    """ Initiate the query and block waiting for completion.

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
      allowLargeResults: whether to allow large results; i.e. compressed data over 100MB. This is
          slower and requires a table_name to be specified) (default False).
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      A Job for the query
    Raises:
      Exception if query could not be executed.
    """
    self._results = self.execute_async(table_name=table_name,
                                       append=append,
                                       overwrite=overwrite,
                                       use_cache=use_cache,
                                       batch=batch,
                                       allow_large_results=allow_large_results,
                                       env=env).wait()
    return self._results

  def save_as_view(self, view_name, env=None):
    """ Create a View from this Query.

    Args:
      view_name: the name of the View either as a string or a 3-part tuple
          (projectid, datasetid, name).
      env: an optional dictionary to use when expanding the variables in the SQL.

    Returns:
      A View for the Query.
    """
    return _View(self._api, view_name).create(self.expand_sql(env))

  def _repr_sql_(self, env=None):
    """Creates a SQL representation of this object.

    Args:
      env: an optional dictionary to use when expanding the variables in the SQL.
    Returns:
      The SQL representation to use when embedding this object into SQL.
    """
    return '(' + self.expand_sql(env) + ')'

  def __str__(self):
    """Creates a string representation of this object.

    Returns:
      The string representation of this object.
    """
    return self._raw_sql

from ._query_job import QueryJob as _QueryJob
from ._view import View as _View
