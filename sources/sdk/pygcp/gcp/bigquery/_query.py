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

import codecs
import csv
import os
import pandas as pd
from ._parser import Parser as _Parser
from ._sampling import Sampling as _Sampling


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


class ResultProcessor(object):
  """ Abstract base class for query results processors.
  """

  @property
  def result_count(self):
    """ Get the number of results processed so far.

    Returns:
     Number of results.
    """
    pass

  def set_schema(self, schema):
    """ Process the schema of the results. This is called once before any calls to process().

    Args:
      schema: The schema of the results.
    """
    pass

  def process(self, results):
    """ Process a single result.

    Args:
      result: A row of results.
    """
    pass

  def finish(self):
    """ Called after all results have been processed. Can do any necessary housekeeping at this point.
    """
    pass

  def on_fail(self):
    """ Called if the query failed to clean up any associated resources.
    """
    pass


class ResultCollector(ResultProcessor):
  """ A query result processor that saves the results in an array.
  """

  def __init__(self):
    self.rows = []
    self.schema = None

  @property
  def result_count(self):
    """ Get the number of results processed so far.

    Returns:
     Number of results.
    """
    return len(self.rows)

  def set_schema(self, schema):
    """ Process the schema of the results. This is called once before any calls to process(). Saves the schema
        for use by the results parser in process().

    Args:
      schema: The schema of the results.
    """
    self.schema = schema

  def process(self, results):
    """ Process a single result. Parses the result according to the schema and turns it into a dictionary
        which is then appended to the list of result rows.

      Args:
        result: A row of results.
    """
    self.rows.append(_Parser.parse_row(self.schema, results))


class ResultCSVFileSaver(ResultProcessor):
  """ A query result processor that saves the results to a local file.
  """

  def __init__(self, path, write_header, dialect=csv.excel):
    """
    Args:
      path: the local file path
      write_header: if true (the default), write column name header row at start of file
      dialect: the format to use for the output. By default, csv.excel. See
          https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.
    """
    self.path = path
    self.schema = None
    self.write_header = write_header
    self.dialect = dialect
    self.file = None
    self.writer = None
    self.count = 0

  @property
  def result_count(self):
    """ Get the number of results processed so far.

    Returns:
     Number of results.
    """
    return self.count

  def set_schema(self, schema):
    """ Process the schema of the results. This is called once before any calls to process().
        Saves the schema, and opens the output file and associated CSV dictionary writer.

      Args:
        schema: The schema of the results.
    """
    if not self.file:
      self.schema = schema
      self.file = codecs.open(self.path, 'w', 'utf-8')
      fieldnames = []
      for column in schema:
        fieldnames.append(column['name'])
      self.writer = csv.DictWriter(self.file, fieldnames=fieldnames, dialect=self.dialect)
      if self.write_header:
        self.writer.writeheader()

  def process(self, results):
    """ Process a single result. Parses the result according to the schema and turns it into a dictionary
        which is then written to the CSV file with the DictionaryWriter.

      Args:
        result: A row of results.
    """
    self.writer.writerow(_Parser.parse_row(self.schema, results))
    self.count += 1

  def finish(self):
    """ Closes the file after all results have been processed.
    """
    self.file.close()

  def on_fail(self):
    """ Clean up if the query failed. Closes the file stream and removes the CSV file if it exists.
    """
    if self.file:
      self.file.close()
      if os.exists(self.path):
        os.remove(self.path)


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
      use_cache: whether to use cached results or not.
      write_header: if true (the default), write column name header row at start of file
      dialect: the format to use for the output. By default, csv.excel. See
          https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.
      quote_char: the character used for escaping the delimiter and itself; by default backslash '\'
    Returns:
      A QueryResults objects representing the result set.
    Raises:
      Exception if the query could not be executed or query response was
      malformed.
    """
    if not use_cache or (self._results is None):
      self._results = self._execute(page_size, timeout, use_cache)
    return self._results

  def save(self, path, page_size=0, timeout=0, use_cache=True, write_header=True, dialect=csv.excel):
    """Save the results to a local file in CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
    """
    try:
      processor = ResultCSVFileSaver(path, write_header, dialect)
      self._run_query(page_size, timeout, use_cache, processor)
      return path
    except KeyError:
      raise Exception('Unexpected query response.')

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
      Exception if the query could not be executed or query response was
      malformed.
    """
    if sampling is None:
      sampling = _Sampling.default(count=count)
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
      collector = ResultCollector()
      job_id = self._run_query(page_size, timeout, use_cache, collector)
      return QueryResults(self._sql, job_id, collector.rows)
    except KeyError:
      raise Exception('Unexpected query response.')

  def _run_query(self, page_size, timeout, use_cache, result_processor):
    """Executes a query and processes results after waiting for completion.

    Args:
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
      use_cache: whether to use cached results or not.
      result_processor: object used to process the results
    Returns:
      The job ID for the query.
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

      total_count = int(query_result['totalRows'])
      if total_count != 0:
        schema = query_result['schema']['fields']
        result_processor.set_schema(schema)

        while result_processor.result_count < total_count:
          for r in query_result['rows']:
            result_processor.process(r)

          if result_processor.result_count < total_count:
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
      result_processor.finish()
      return job_id
    except KeyError:
      result_processor.on_fail()
      raise Exception('Unexpected query response.')

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
