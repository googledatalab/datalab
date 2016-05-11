# Copyright 2016 Google Inc. All rights reserved.
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

"""Implements GCP Job functionality."""

import datalab.context
import _job


class GCPJob(_job.Job):
  """Represents a BigQuery Job.
  """

  def __init__(self, job_id, context):
    """Initializes an instance of a Job.

    Args:
      job_id: the BigQuery job ID corresponding to this job.
      context: a Context object providing project_id and credentials.
    """
    super(GCPJob, self).__init__(job_id)
    if context is None:
      context = datalab.context.Context.default()
    self._context = context
    self._api = self._create_api(context)

  def _create_api(self, context):
    raise Exception('_create_api must be defined in a derived class')

  def __repr__(self):
    """Returns a representation for the job for showing in the notebook.
    """
    return 'Job %s/%s %s' % (self._context.project_id, self._job_id, self.state)

