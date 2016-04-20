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

"""Implements BigQuery query job functionality."""

import _job


class QueryJob(_job.Job):
  """ Represents a BigQuery Query Job. """

  def __init__(self, job_id, table_name, sql, context):
    """  Initializes a QueryJob object.

    Args:
      job_id: the ID of the query job.
      table_name: the name of the table where the query results will be stored.
      sql: the SQL statement that was executed for the query.
      context: the Context object providing project_id and credentials that was used
          when executing the query.
    """
    super(QueryJob, self).__init__(job_id, context)
    self._sql = sql
    self._table = _query_results_table.QueryResultsTable(table_name, context, self,
                                                         is_temporary=True)
    self._bytes_processed = None
    self._cache_hit = None
    self._total_rows = None

  @property
  def bytes_processed(self):
    """ The number of bytes processed, or None if the job is not complete. """
    return self._bytes_processed

  @property
  def total_rows(self):
    """ The total number of rows in the result, or None if not complete. """
    return self._total_rows

  @property
  def cache_hit(self):
    """ Whether the query results were obtained from the cache or not, or None if not complete. """
    return self._cache_hit

  @property
  def sql(self):
    """ The SQL statement that was executed for the query. """
    return self._sql

  def wait(self, timeout=None):
    """ Wait for the job to complete, or a timeout to happen.

      This is more efficient than the version in the base Job class, in that we can
      use a call that blocks for the poll duration rather than a sleep. That means we
      shouldn't block unnecessarily long and can also poll less.

    Args:
      timeout: how long to wait (in seconds) before giving up; default None which means no timeout.

    Returns:
      The QueryJob
    """
    poll = 30
    while not self._is_complete:
      try:
        query_result = self._api.jobs_query_results(self._job_id,
                                                    project_id=self._context.project_id,
                                                    page_size=0,
                                                    timeout=poll * 1000)
      except Exception as e:
        raise e
      if query_result['jobComplete']:
        if 'totalBytesProcessed' in query_result:
          self._bytes_processed = int(query_result['totalBytesProcessed'])
        self._cache_hit = query_result.get('cacheHit', None)
        if 'totalRows' in query_result:
          self._total_rows = int(query_result['totalRows'])
        break

      if timeout is not None:
        timeout -= poll
        if timeout <= 0:
          break

    self._refresh_state()
    return self

  @property
  def results(self):
    """ Get the table used for the results of the query. If the query is incomplete, this blocks.

    Raises:
      Exception if we timed out waiting for results or the query failed.
    """
    self.wait()
    if self.failed:
      raise Exception('Query failed: %s' % str(self.errors))
    return self._table

import _query_results_table
