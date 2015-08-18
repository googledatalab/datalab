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

import datetime
from gcp._util import Job as _Job, JobError as _JobError


class Job(_Job):
  """Represents a BigQuery Job.
  """

  def __init__(self, api, job_id):
    """Initializes an instance of a Job.

    Args:
      api: the BigQuery API object to use to issue requests. The project ID will be inferred from
          this.
      job_id: the BigQuery job ID corresponding to this job.
    """
    super(Job, self).__init__(job_id)
    self._api = api
    self._start_time = None
    self._end_time = None

  @property
  def start_time_utc(self):
    """ Returns the UTC start time of the job as a Python datetime. """
    return self._start_time

  @property
  def end_time_utc(self):
    """ Returns the UTC end time of the job (or None if incomplete) as a Python datetime. """
    return self._end_time

  def _refresh_state(self):
    """ Get the state of a job. If the job is complete this does nothing
        otherwise it gets a refreshed copy of the job resource.
    """
    # TODO(gram): should we put a choke on refreshes? E.g. if the last call was less than
    # a second ago should we return the cached value?
    if self._is_complete:
      return

    response = self._api.jobs_get(self._job_id)

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
      self._fatal_error = _JobError(location, message, reason)
    if 'errors' in status:
      self._errors = []
      for error in status['errors']:
        location = error.get('location', None)
        message = error.get('message', None)
        reason = error.get('reason', None)
        self._errors.append(_JobError(location, message, reason))
