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

"""Implements BigQuery Job functionality."""

from datetime import datetime
import codecs
import collections
import csv
import os
from ._parser import Parser as _Parser

JobError = collections.namedtuple('JobError', ['location', 'message', 'reason'])


class Job(object):
  """Represents a BigQuery Job.
  """

  def __init__(self, api, job_id):
    """Initializes an instance of a Job.

    Args:
      api: the BigQuery API object to use to issue requests. The project ID will be inferred from
          this.
      job_id: the BigQuery job ID corresponding to this job.
    """
    self._api = api
    self._job_id = job_id
    self._is_complete = False
    self._errors = None
    self._fatal_error = None

  @property
  def id(self):
    """ Get the Job ID.

    Returns:
      The ID of the job.
    """
    return self._job_id

  @property
  def iscomplete(self):
    """ Get the completion state of the job.

    Returns:
      True if the job is complete; False if it is still running.
    """
    self._refresh_state()
    return self._is_complete

  @property
  def failed(self):
    """ Get the success state of the job.

    Returns:
      True if the job failed; False if it is still running or succeeded (possibly with partial
      failure).
    """
    self._refresh_state()
    return self._is_complete and self._fatal_error

  @property
  def fatal_error(self):
    """ Get the job error.

    Returns:
      None if the job succeeded or is still running, else the error tuple for the failure.
    """
    self._refresh_state()
    return self._fatal_error

  @property
  def errors(self):
    """ Get the errors in the job.

    Returns:
      None if the job is still running, else the list of errors that occurred.
    """
    self._refresh_state()
    return self._errors

  def _refresh_state(self):
    """ Get the state of a job. If the job is complete this does nothing
        otherwise it gets a refreshed copy of the job resource.
    """
    # TODO(gram): should we put a choke on refreshes? E.g. if the last call was less than
    # a second ago should we return the cached value?
    if self._is_complete:
      return

    response = self._api.jobs_get(self._job_id)

    self._is_complete = \
        response['state'] if 'state' in response and response['state'] == 'DONE' else False

    if self._is_complete:
      if 'status' in response:
        status = response['status']
        if 'errorResult' in status:
          error_result = status['errorResult']
          self._fatal_error = JobError(error_result['location'],
                                       error_result['message'],
                                       error_result['reason'])
        if 'errors' in status:
          self._errors = []
          for error in status['errors']:
            self._errors.append(JobError(error['location'], error['message'], error['reason']))

  def __repr__(self):
    """ Get the notebook representation for the job.
    """
    return 'Job %s' % str(self._job_id)


class QueryJobResultProcessor(object):
  """ Abstract base class for query job results processors.
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
    """ Called after all results have been processed; do any necessary housekeeping here.
    """
    pass

  def on_fail(self):
    """ Called if the query failed to clean up any associated resources.
    """
    pass


class ResultCollector(QueryJobResultProcessor):
  """ A query result processor that saves the results in an array.
  """

  def __init__(self):
    super(ResultCollector, self).__init__()
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
    """ Process the schema of the results. This is called once before any calls to process().
        Saves the schema for use by the results parser in process().

    Args:
      schema: The schema of the results.
    """
    self.schema = schema

  def process(self, results):
    """ Process a single result. Parses the result according to the schema and turns it into a
        dictionary which is then appended to the list of result rows.

      Args:
        result: A row of results.
    """
    self.rows.append(_Parser.parse_row(self.schema, results))


class ResultCSVFileSaver(QueryJobResultProcessor):
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
    super(ResultCSVFileSaver, self).__init__()
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
    """ Process a single result. Parses the result according to the schema and turns it into a
        dictionary which is then written to the CSV file with the DictionaryWriter.

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


class QueryJob(Job):
  """ Represents a BigQuery Query Job.
  """

  _DEFAULT_TIMEOUT = 60000

  def __init__(self, api, job_id, table, timeout=0):
    super(QueryJob, self).__init__(api, job_id)
    self._table = table
    self._timeout = timeout if timeout else self._DEFAULT_TIMEOUT

  @property
  def table(self):
    """ Get the table used for the results of the query. If the query is incomplete, this blocks.
    """
    if not self.iscomplete:
      query_result = self._api.jobs_query_results(self._job_id,
                                                  page_size=0,
                                                  timeout=self._timeout)
      if not query_result['jobComplete']:
        # TODO(gram): Should we raise an exception instead?
        return None
    return self._table

  # TODO(gram): get rid of this and the results processors
  def process_results(self, result_processor, page_size=0, timeout=None):
    """ Process the results of a query job; this will block if the job is not complete.

    Args:
      result_processor: object used to process the results.
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete; default 60,000.
      use_cache: whether to use cached results or not.
    Returns:
      The query result processor.
    """

    if not timeout:
      timeout = self._DEFAULT_TIMEOUT

    # Get the start time; we decrement the timeout each time by the elapsed time so the timeout
    # applies to the overall operation, not individual page requests.
    start_time = datetime.now()

    try:
      query_result = self._api.jobs_query_results(self._job_id,
                                                  page_size=page_size,
                                                  timeout=timeout,
                                                  start_index=0)
      if not query_result['jobComplete']:
        return None

      total_count = int(query_result['totalRows'])
      if total_count != 0:
        schema = query_result['schema']['fields']
        result_processor.set_schema(schema)

        while result_processor.result_count < total_count:
          for r in query_result['rows']:
            result_processor.process(r)

          if result_processor.result_count < total_count:

            # Set the timeout to be the remaining time
            end_time = datetime.now()
            elapsed = end_time - start_time
            start_time = end_time
            timeout -= int(elapsed.total_seconds() * 1000)
            if timeout <= 0:  # TODO(gram): use a larger threshold; e.g. 1000?
              break

            query_result = self._api.jobs_query_results(self._job_id,
                                                        page_size=page_size,
                                                        timeout=timeout,
                                                        start_index=result_processor.result_count)
            if not query_result['jobComplete']:
              break

      result_processor.finish()
    except KeyError:
      result_processor.on_fail()

    return result_processor

  def collect_results(self, page_size=0, timeout=None):
    """Retrieves results for the query.

    Args:
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
    Returns:
      A list of rows of results.
    """
    return self.process_results(ResultCollector(), page_size=page_size, timeout=timeout).rows

  def save_results_as_csv(self, path, write_header=True, dialect=csv.excel, page_size=0,
                          timeout=None):
    """Save the results to a local file in CSV format.

    Args:
      path: path on the local filesystem for the saved results.
      write_header: if true (the default), write column name header row at start of file.
      dialect: the format to use for the output. By default, csv.excel. See
          https://docs.python.org/2/library/csv.html#csv-fmt-params for how to customize this.
      page_size: limit to the number of rows to fetch per page.
      timeout: duration (in milliseconds) to wait for the query to complete.
    Returns:
      Nothing.
    """
    self.process_results(ResultCSVFileSaver(path, write_header, dialect), page_size=page_size,
                         timeout=timeout)
