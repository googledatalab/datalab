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

"""Implements BigQuery Job functionality."""

import datetime
import gcp._util
import _api


class Job(gcp._util.Job):
  """Represents a BigQuery Job.
  """

  def __init__(self, job_id, context):
    """Initializes an instance of a Job.

    Args:
      job_id: the BigQuery job ID corresponding to this job.
      context: a Context object providing project_id and credentials.
    """
    super(Job, self).__init__(job_id)
    self._context = context
    self._api = _api.Api(context)
    self._start_time = None
    self._end_time = None

  def __repr__(self):
    """Returns a representation for the job for showing in the notebook.
    """
    return 'Job %s' % self._job_id

  @property
  def start_time_utc(self):
    """ The UTC start time of the job as a Python datetime. """
    return self._start_time

  @property
  def end_time_utc(self):
    """ The UTC end time of the job (or None if incomplete) as a Python datetime. """
    return self._end_time

  @property
  def total_time(self):
    """ The total time in fractional seconds that the job took, or None if not complete. """
    if self._end_time is None:
      return None
    return (self._end_time - self._start_time).total_seconds()

  def _refresh_state(self):
    """ Get the state of a job. If the job is complete this does nothing;
        otherwise it gets a refreshed copy of the job resource.
    """
    # TODO(gram): should we put a choke on refreshes? E.g. if the last call was less than
    # a second ago should we return the cached value?
    if self._is_complete:
      return

    try:
      response = self._api.jobs_get(self._job_id)
    except Exception as e:
      raise e

    if 'statistics' in response:
      statistics = response['statistics']
      start_time = statistics.get('creationTime', None)
      if start_time:
        self._start_time = datetime.datetime.fromtimestamp(float(start_time) / 1000.0)
      end_time = statistics.get('endTime', None)
      if end_time:
        self._end_time = datetime.datetime.fromtimestamp(float(end_time) / 1000.0)

    if 'status' in response:
      status = response['status']
      if 'state' in status and status['state'] == 'DONE':
        self._end_time = datetime.datetime.utcnow()
        self._is_complete = True
        self._process_job_status(status)

  def _process_job_status(self, status):
    if 'errorResult' in status:
      error_result = status['errorResult']
      location = error_result.get('location', None)
      message = error_result.get('message', None)
      reason = error_result.get('reason', None)
      self._fatal_error = gcp._util.JobError(location, message, reason)
    if 'errors' in status:
      self._errors = []
      for error in status['errors']:
        location = error.get('location', None)
        message = error.get('message', None)
        reason = error.get('reason', None)
        self._errors.append(gcp._util.JobError(location, message, reason))
