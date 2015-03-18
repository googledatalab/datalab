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

"""Implements BigQuery query job functionality."""

from ._job import Job as _Job
from ._query_results_table import QueryResultsTable as _QueryResultsTable


class QueryJob(_Job):
  """ Represents a BigQuery Query Job.
  """

  _DEFAULT_TIMEOUT = 60000

  def __init__(self, api, job_id, table_name, sql, timeout=0):
    super(QueryJob, self).__init__(api, job_id)
    self._sql = sql
    self._timeout = timeout if timeout else self._DEFAULT_TIMEOUT
    self._table = _QueryResultsTable(api, table_name, self, is_temporary=True)

  @property
  def results(self):
    """ Get the table used for the results of the query. If the query is incomplete, this blocks.

    Args:
      timeout: timeout in msec to wait for the query to complete.

    Raises:
      Exception if we timed out waiting for results.
    """
    if not self.iscomplete:
      # Block until done (or timed out). We do this by call Jobs.queryResults but use a
      # page size of zero because we're not actually fetching any results here.
      query_result = self._api.jobs_query_results(self._job_id,
                                                  project_id=self._table.name.project_id,
                                                  page_size=0,
                                                  timeout=self._timeout)
      if not query_result['jobComplete']:
        raise Exception('Timed out getting query results')
    return self._table

  @property
  def sql(self):
    return self._sql
