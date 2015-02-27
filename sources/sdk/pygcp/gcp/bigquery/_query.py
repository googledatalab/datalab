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


import csv
from ._query_job import QueryJob as _QueryJob
from ._sampling import Sampling as _Sampling


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

  def results(self, timeout=0, use_cache=True):
    """Retrieves results for the query.

    Args:
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not. Ignored if append is specified.
    Returns:
      A QueryResultsTable containing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    if not use_cache or (self._results is None):
      self._results = self.execute(use_cache=use_cache, batch=False, timeout=timeout)
    return self._results.results

  def to_file(self, path, start_row=0, max_rows=None, timeout=0, use_cache=True, write_header=True,
              dialect=csv.excel):
    """Save the results to a local file in CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      start_row: the row of the table at which to start the export (default 0)
      max_rows: an upper limit on the number of rows to export (default None)
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file
      dialect: the format to use for the output. By default, csv.excel. See
          https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.
    Returns:
      The path to the local file.
    Raises:
      An Exception if the operation failed.
    """
    self.execute(use_cache=use_cache, batch=False, timeout=timeout)\
        .results.to_file(path, start_row=start_row, max_rows=max_rows,
                         write_header=write_header, dialect=dialect)
    return path

  def sample(self, count=5, fields=None, sampling=None, timeout=0, use_cache=True):
    """Retrieves a sampling of rows for the query.

    Args:
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the table.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResultsTable containing a sampling of the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    return Query.sampling_query(self._api, self._sql, count=count, fields=fields,
                                sampling=sampling).\
        results(timeout=timeout, use_cache=use_cache)

  def execute(self, table_name=None, append=False, overwrite=False, use_cache=True, batch=True,
              timeout=0):
    """ Initiate the query.

    Args:
      dataset_id: the datasetId for the result table.
      table: the result table name; if None, then a temporary table will be used.
      append: if True, append to the table if it is non-empty; else the request will fail if table
          is non-empty unless overwrite is True.
      overwrite: if the table already exists, truncate it instead of appending or raising an
          Exception.
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified.
      batch: whether to run this as a batch job (lower priority) or as an interactive job (high
        priority, more expensive).
      timeout: duration (in milliseconds) to wait for the query to complete.
    Returns:
      A Job for the query
    Raises:
      Exception (KeyError) if query could not be executed.
    """
    query_result = self._api.jobs_insert_query(self._sql,
                                               table_name=table_name,
                                               append=append,
                                               overwrite=overwrite,
                                               dry_run=False,
                                               use_cache=use_cache,
                                               batch=batch)
    if 'jobReference' not in query_result:
      raise Exception('Unexpected query response.')
    job_id = query_result['jobReference']['jobId']
    if not table_name:
      destination = query_result['configuration']['query']['destinationTable']
      table_name = (destination['projectId'], destination['datasetId'], destination['tableId'])
    return _QueryJob(self._api, job_id, table_name, self._sql, timeout=timeout)

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
