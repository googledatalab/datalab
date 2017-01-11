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

// This code is generic and can be factored out into a separate Jupyter testing project.

function setStatus(status) {
  e = document.createElement('div');
  e.id = 'test_status'
  e.textContent = status;
  document.body.appendChild(e);
}

function validate() {
  var cells = IPython.notebook.get_cells();

  var result = '';
  var testfailed = false;
  console.log('Validating...');

  cells.forEach(function(cell, cell_id) {
    var cellfailed = false;
    if (cell.cell_type == 'code' && cell.output_area && cell.output_area.outputs) {
      cell.output_area.outputs.forEach(function(output, output_id) {
        if ((output.output_type && output.output_type == 'error') ||
            output.ename || output.traceback) {
          cellfailed = true;
          testfailed = true
          result += '#Cell ' + cell_id + ' output number ' + output_id + ' failed';
        }
      })
    }

    if (cell.output_area && cell.output_area.element) {
      if (cellfailed)
        cell.output_area.element[0].style.backgroundColor="#fdc0bf";
      else
        cell.output_area.element[0].style.backgroundColor="#b9f7b9";
    }
    if (cellfailed)
      result += '#' + cell_id + ':F';
  });

  if (testfailed) {
    setStatus('FAIL' + result);
  } else {
    setStatus('PASS');
  }
}

function checkIfDone() {
  if (IPython.notebook.kernel_busy) {
    console.log('Busy');
    setTimeout(function() {
      checkIfDone();
    }, 1000);
  } else {
    console.log('Finished execution');
    validate();
  }
}

function runNotebook() {
  if (IPython.notebook.kernel && IPython.notebook.kernel.is_connected()) {
    IPython.notebook.clear_all_output();
    console.log('Starting execution');
    
    IPython.notebook.execute_all_cells();
    setTimeout(function() {
      checkIfDone();
    }, 1000);
  } else {
    setTimeout(function() {
      runNotebook();
    }, 1000);
  }
}

function testNotebook() {
  var pageClass = document.body.className;
  if (pageClass.indexOf('notebook_app') >= 0) {
    runNotebook();
  }
}

require(['base/js/namespace', 'base/js/events', 'base/js/dialog', 'base/js/utils', 'base/js/security'],
        testNotebook);

