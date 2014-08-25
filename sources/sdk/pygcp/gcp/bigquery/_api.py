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

"""Implements BigQuery HTTP API wrapper."""

import time
import gcp._util as _util


class Api(object):
  """A helper class to issue BigQuery HTTP requests."""

  # TODO(nikhilko): Use named placeholders in these string templates.
  _ENDPOINT = 'https://www.googleapis.com/bigquery/v2'
  _QUERY_PATH = '/projects/%s/queries'
  _QUERY_RESULT_PATH = '/projects/%s/queries/%s'
  _TABLE_PATH = '/projects/%s/datasets/%s/tables/%s'

  _DEFAULT_PAGE_SIZE = 10000
  _DEFAULT_TIMEOUT = 60000

  def __init__(self, credentials, project_id):
    """Initializes the BigQuery helper with context information.

    Args:
      credentials: the credentials to use to authorize requests.
      project_id: the project id to associate with requests.
    """
    self._credentials = credentials
    self._project_id = project_id

  @property
  def project_id(self):
    """The project_id associated with this API client."""
    return self._project_id

  def jobs_query(self, sql, page_size=0, timeout=0, dry_run=False,
                 use_cache=True):
    """Issues a request to the jobs/query method.

    Args:
      sql: the SQL string representing the query to execute.
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      dry_run: whether to actually execute the query or just dry run it.
      use_cache: whether to use past query results or ignore cache.
    Returns:
      A parsed query result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    if page_size == 0:
      page_size = Api._DEFAULT_PAGE_SIZE
    if timeout == 0:
      timeout = Api._DEFAULT_TIMEOUT

    url = Api._ENDPOINT + (Api._QUERY_PATH % self._project_id)
    data = {
        'kind': 'bigquery#queryRequest',
        'query': sql,
        'maxResults': page_size,
        'timeoutMs': timeout,
        'dryRun': dry_run,
        'useQueryCache': use_cache
        }

    return _util.Http.request(url, data=data, credentials=self._credentials)

  def jobs_query_results(self, job_id, page_size=0, timeout=0, wait_interval=0,
                         page_token=None):
    """Issues a request to the jobs/getQueryResults method.

    Args:
      job_id: the id of job from a previously executed query.
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      wait_interval: duration (in seconds) to wait before attempting to
          retrieve query results.
      page_token: the page token from a previous set of results to continue
          retrieving more rows.
    Returns:
      A parsed query result object.
    Raises:
      Exception if there is an error performing the operation.
    """
    if page_size == 0:
      page_size = Api._DEFAULT_PAGE_SIZE
    if timeout == 0:
      timeout = Api._DEFAULT_TIMEOUT

    if wait_interval != 0:
      time.sleep(wait_interval)

    args = {
        'maxResults': page_size,
        'timeoutMs': timeout
        }

    if page_token is not None:
      args['pageToken'] = page_token

    url = Api._ENDPOINT + (Api._QUERY_RESULT_PATH % (self._project_id, job_id))
    return _util.Http.request(url, args=args, credentials=self._credentials)

  def tables_get(self, name_parts):
    """Issues a request to retrieve information about a table.

    Args:
      name_parts: a tuple representing the full name of the table.
    Returns:
      A parsed table information object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._TABLE_PATH % name_parts)
    return _util.Http.request(url, credentials=self._credentials)

  def tables_list(self, dataset_id, max_results=0, page_token=None):
    """Issues a request to retrieve a list of tables.

    Args:
      dataset_id: the name of the dataset to enumerate.
      max_results: an optional maximum number of tables to retrieve.
      page_token: an optional token to continue the retrieval.
    Returns:
      A parsed table list object.
    Raises:
      Exception if there is an error performing the operation.
    """
    url = Api._ENDPOINT + (Api._TABLE_PATH % (self._project_id, dataset_id, ''))

    args = {}
    if max_results != 0:
      args['maxResults'] = max_results
    if page_token is not None:
      args['pageToken'] = page_token

    return _util.Http.request(url, args=args, credentials=self._credentials)
