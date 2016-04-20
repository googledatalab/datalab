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

"""Implements job view"""


try:
  import IPython
  import IPython.core.magic
  import IPython.core.display
except ImportError:
  raise Exception('This module can only be loaded in ipython.')

import datalab.utils

import _commands
import _html


_local_jobs = {}


def html_job_status(job_name, job_type, refresh_interval, html_on_running, html_on_success):
  """create html representation of status of a job (long running operation).

  Args:
    job_name: the full name of the job.
    job_type: type of job. Can be 'local' or 'cloud'.
    refresh_interval: how often should the client refresh status.
    html_on_running: additional html that the job view needs to include on job running.
    html_on_success: additional html that the job view needs to include on job success.
  """
  _HTML_TEMPLATE = """
    <div class="jobstatus" id="%s">
    </div>
    <script>
      require(['datalab/job', 'datalab/element!%s', 'base/js/events',
          'datalab/style!/nbextensions/datalab/job.css'],
        function(job, dom, events) {
          job.render(dom, events, '%s', '%s', %s, '%s', '%s');
        }
      );
    </script>"""
  div_id = _html.Html.next_id()
  return IPython.core.display.HTML(_HTML_TEMPLATE % (div_id, div_id, job_name, job_type,
                                   refresh_interval, html_on_running, html_on_success))


@IPython.core.magic.register_line_magic
def _get_job_status(line):
  """magic used as an endpoint for client to get job status.

       %_get_job_status <name>

  Returns:
    A JSON object of the job status.
  """
  try:
    args = line.strip().split()
    job_name = args[0]

    job = None
    if job_name in _local_jobs:
      job = _local_jobs[job_name]
    else:
      raise Exception('invalid job %s' % job_name)

    if job is not None:
      error = '' if job.fatal_error is None else str(job.fatal_error)
      data = {'exists': True, 'done': job.is_complete, 'error': error}
    else:
      data = {'exists': False}

  except Exception as e:
    datalab.utils.print_exception_with_last_stack(e)
    data = {'done': True, 'error': str(e)}

  return IPython.core.display.JSON(data)
