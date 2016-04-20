/*
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

/// <reference path="../../../../../../externs/ts/require/require.d.ts" />

declare var datalab: any;
declare var IPython: any;

module Job {

  function refresh(dom: any, job_name: any, job_type: any, interval: any,
      html_on_running: string, html_on_success: string): any {
    var code = '%_get_job_status ' + job_name + ' ' + job_type;
    datalab.session.execute(code, function (error: any, newData: any) {
      error = error || newData.error;
      if (error) {
        dom.innerHTML = '<p class="jobfail">Job failed with error: ' + error
            + '</p>';
        return;
      }
      if (!newData.exists) {
        dom.innerHTML = '<p>The job does not exist.</p>';
      } else if (newData.done) {
        dom.innerHTML = '<p class="jobsucceed">Job completed successfully.</p><br>' +
                        html_on_success;
      } else {
        dom.innerHTML = 'Running... <p class="jobfooter">Updated at '
          + new Date().toLocaleTimeString() + '</p>' + html_on_running;
        setTimeout(function() {
              refresh(dom, job_name, job_type, interval, html_on_running, html_on_success);
            }, interval * 1000);
      }
    });
  }

  // Render the job view. This is called from Python generated code.
  export function render(dom: any, events: any, job_name: string, job_type: string,
      interval: any, html_on_running: string, html_on_success: string) {
    if (IPython.notebook.kernel.is_connected()) {
      refresh(dom, job_name, job_type, interval, html_on_running, html_on_success);
      return;
    }
    // If the kernel is not connected, wait for the event.
    events.on('kernel_ready.Kernel', function(e: any) {
      refresh(dom, job_name, job_type, interval, html_on_running, html_on_success);
    });
  }
}


export = Job;

