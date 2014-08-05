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

import pandas as pd
from ._parser import Parser as _Parser
from ._sampling import Sampling as _Sampling


class QueryResults(object):
  """Represents a results object holding the results of an executed query.
  """

  def __init__(self, sql, rows):
    """Initializes an instance of a QueryResults with the rows.

    Args:
      sql: the SQL statement used to produce the result set.
      rows: the rows making up the result set.
    """
    self._sql = sql
    self._rows = rows

  @property
  def sql(self):
    """The SQL statement used to produce this result set.

    Returns:
      The SQL statement as it was sent to the BigQuery API for execution.
    """
    return self._sql

  def __iter__(self):
    """Creates an iterator to iterate over the rows in the result set.

    Returns:
      An iterator to iterate over the rows.
    """
    return iter(self._rows)

  def __len__(self):
    """Retrieves the number of rows in the result set.

    Returns:
      The number of rows in the resultset.
    """
    return len(self._rows)

  def to_list(self):
    """Retrieves the result set as a simple list of objects.

    Returns:
      The list of rows forming the result set.
    """
    return self._rows

  def to_dataframe(self):
    """Retrieves the result set as a pandas dataframe object.

    Returns:
      A dataframe representing the data in the result set.
    """
    if len(self._rows) == 0:
      return pd.DataFrame()
    return pd.DataFrame.from_dict(self._rows)


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

  def results(self, page_size=0, timeout=0, use_cache=True):
    """Retrieves results for the query.

    Args:
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResults objects representing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    if not use_cache or (self._results is None):
      self._results = self._execute(page_size, timeout, use_cache)
    return self._results

  def sample(self, sampling=None, timeout=0, use_cache=True):
    """Retrieves a sampling of rows for the query.

    Args:
      sampling: an optional sampling strategy to apply to the table.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResults objects representing a sampling of the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    if sampling is None:
      sampling = _Sampling.default()
    sampling_sql = sampling(self._sql)

    sampling_query = Query(self._api, sampling_sql)
    return sampling_query.results(page_size=0, timeout=timeout, use_cache=use_cache)

  def _execute(self, page_size, timeout, use_cache):
    """Executes a query and retrieve results after waiting for completion.

    Args:
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    Returns:
      A QueryResults objects representing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    try:
      query_result = self._api.jobs_query(self._sql,
                                          page_size=page_size,
                                          timeout=timeout,
                                          use_cache=use_cache)
      job_id = query_result['jobReference']['jobId']

      while not query_result['jobComplete']:
        query_result = self._api.jobs_query_results(job_id,
                                                    page_size=page_size,
                                                    timeout=timeout,
                                                    wait_interval=1)

      rows = []

      total_count = int(query_result['totalRows'])
      if total_count != 0:
        schema = query_result['schema']['fields']

        while len(rows) < total_count:
          for r in query_result['rows']:
            rows.append(_Parser.parse_row(schema, r))

          if len(rows) < total_count:
            token = query_result['pageToken']
            if token is None:
              # Breaking out to avoid making an API call that will fail or
              # result in invalid data. More pages of results were expected,
              # based on total_count, but lack a page token to continue further.
              # Opt to use existing results, rather than fail the operation.
              #
              # TODO(nikhilko): TBD, is that the better choice?
              break

            query_result = self._api.jobs_query_results(job_id,
                                                        page_size=page_size,
                                                        timeout=timeout,
                                                        page_token=token)
      return QueryResults(self._sql, rows)
    except KeyError:
      raise Exception('Unexpected query response.')

  def _repr_sql_(self):
    """Creates a SQL representation of this object.

    Returns:
      The SQL representation to use when embedding this object into SQL.
    """
    return '(' + self._sql + ')'

  def __str__(self):
    """Creates a string represention of this object.

    Returns:
      The string representation of this object.
    """
    return self._sql
