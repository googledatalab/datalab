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

"""Implements OS shell Job functionality."""

import _async
import _job


class LambdaJob(_job.Job):
  """Represents an lambda function as a Job.
  """

  def __init__(self, fn, job_id, *args, **kwargs):
    """Initializes an instance of a Job.

    Args:
      fn: the lambda function to execute asyncronously
      job_id: an optional ID for the job. If None, a UUID will be generated.
    """
    super(LambdaJob, self).__init__(job_id)
    self._future = _async.async.executor.submit(fn, *args, **kwargs)

  def __repr__(self):
    """Returns a representation for the job for showing in the notebook.
    """
    return 'Job %s %s' % (self._job_id, self.state)

  #TODO: ShellJob, once we need it, should inherit on LambdaJob:
  #      import subprocess
  #      LambdaJob(subprocess.check_output, id, command_line, shell=True)
