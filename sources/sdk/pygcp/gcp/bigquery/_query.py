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

"""Implements Query and QueryResult BigQuery APIs."""


import csv
import pandas as pd
from ._job import QueryJob as _QueryJob
from ._sampling import Sampling as _Sampling
from ._table import Table as _Table


class QueryResults(list):
  """Represents a results object holding the results of an executed query.
  """

  def __init__(self, sql, job_id, rows):
    """Initializes an instance of a QueryResults with the rows.

    Args:
      sql: the SQL statement used to produce the result set.
      job_id: the id of the query job that produced this result set.
      rows: the rows making up the result set.
    """
    list.__init__(self, rows)
    self._sql = sql
    self._job_id = job_id

  @property
  def job_id(self):
    """The id of the query job that produced this result set.

    Returns:
      The job id associated with this result.
    """
    return self._job_id

  @property
  def sql(self):
    """The SQL statement used to produce this result set.

    Returns:
      The SQL statement as it was sent to the BigQuery API for execution.
    """
    return self._sql

  def to_dataframe(self):
    """Retrieves the result set as a pandas dataframe object.

    Returns:
      A dataframe representing the data in the result set.
    """
    if len(self) == 0:
      return pd.DataFrame()
    return pd.DataFrame.from_dict(self)


class Query(object):
  """Represents a Query object that encapsulates a BigQuery SQL query.

  This object can be used to execute SQL queries and retrieve results.
  """

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

  def results(self, page_size=0, timeout=0, use_cache=True):
    """Retrieves results for the query.

    Args:
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not. Ignored if append is specified.
    Returns:
      A QueryResults objects representing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    if not use_cache or (self._results is None):
      job = self.execute(table=None, use_cache=use_cache, batch=False)
      rows = job.collect_results(page_size, timeout=timeout)
      self._results = QueryResults(self._sql, job.id, rows)
    return self._results

  def save_to_file(self, path, page_size=0, timeout=0, use_cache=True, write_header=True,
           dialect=csv.excel):
    """Save the results to a local file in CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file
      dialect: the format to use for the output. By default, csv.excel. See
          https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.
    """
    job = self.execute(table=None, use_cache=use_cache, batch=False)
    job.save_results_as_csv(path, write_header, dialect, page_size, timeout=timeout)
    return path

  def sample(self, count=5, sampling=None, timeout=0, use_cache=True):
    """Retrieves a sampling of rows for the query.

    Args:
      count: an optional count of rows to retrieve which is used if a specific
          sampling is not specified.
      sampling: an optional sampling strategy to apply to the table.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResults objects representing a sampling of the result set.
    Raises:
      Exception if the query could not be executed or query response was malformed.
    """
    if sampling is None:
      sampling = _Sampling.default(count=count)
    sampling_sql = sampling(self._sql)

    sampling_query = Query(self._api, sampling_sql)
    return sampling_query.results(page_size=0, timeout=timeout, use_cache=use_cache)

  def execute(self, table=None, append=False, overwrite=False, use_cache=True, batch=True):
    """ Initiate the query.

    Args:
      dataset_id: the datasetId for the result table.
      table: the result table; either a string name or a Table.
      append: if True, append to the table if it is non-empty; else the request will fail if table
          is non-empty unless overwrite is True.
      overwrite: if the table already exists, truncate it instead of appending or raising an
          Exception.
      use_cache: whether to use past query results or ignore cache. Has no effect if destination is
          specified.
      batch: whether to run this as a batch job (lower priority) or as an interactive job (high
        priority, more expensive).
    Returns:
      A Job for the query
    Raises:
      Exception (KeyError) if query could not be executed.
    """
    if isinstance(table, basestring):
      table = _Table(self._api, table)
    query_result = self._api.jobs_insert_query(self._sql,
                                               dataset_id=table.dataset_id if table else None,
                                               table_id=table.table_id if table else None,
                                               append=append,
                                               overwrite=overwrite,
                                               dry_run=False,
                                               use_cache=use_cache,
                                               batch=batch)
    if 'jobReference' not in query_result:
      raise Exception('Unexpected query response.')
    job_id = query_result['jobReference']['jobId']
    if not table:
      destination = query_result['configuration']['query']['destinationTable']
      table = _Table(self._api,
                     (destination['projectId'], destination['datasetId'], destination['tableId']),
                     is_temporary=True)
    return _QueryJob(self._api, job_id, table)

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
