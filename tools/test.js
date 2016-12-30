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

function get_cell_outputs() {

  for (var cellindex in cells) {
    var cell = cells[cellindex];
    if (cell.cell_type == 'code') {
      var cell_outputs = cell.output_area.outputs;
      var scrubbed = [];
      for (var outputindex in cell_outputs) {
        var output = cell_outputs[outputindex].data;
        var scrubbed_data = {};
        for (var mimetype in output) {
          scrubbed_data[mimetype] = scrubber(mimetype, output[mimetype]);
        }
        scrubbed.push(scrubbed_data);
      }
      outputs.push({outputs: scrubbed, element: cell.output_area.element});
    } else {
      outputs.push({outputs: null});
    }
  }
  return outputs;
}

function setStatus(status) {
  e = document.createElement('div');
  e.id = 'test_status'
  e.textContent = status;
  document.body.appendChild(e);
}

function validate() {
  var cells = IPython.notebook.get_cells();

  var result = '';
  var failed = false;
  console.log('Validating...');

  cells.forEach(function(cell, cell_id) {
    var cellfailed = false;
    if (cell.cell_type == 'code' && cell.output_area && cell.output_area.outputs) {
      cell.output_area.outputs.forEach(function(output, output_id) {
        if ((output.output_type && output.output_type == 'error') ||
            output.ename || output.traceback) {
          cellfailed = true;
          failed = true
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

  if (failed) {
    setStatus('FAIL' + result);
  } else {
    setStatus('PASS');
  }
}

function getParameter(name) {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function checkIfDone() {
  if (IPython.notebook.kernel_busy) {
    console.log('Busy');
    setTimeout(function() {
      checkIfDone();
    }, 1000);
  } else {
    console.log('Finished execution');
    if (getParameter('vcr') == '1') {
      IPython.notebook.kernel.execute("cassette.__exit__(None, None, None)\n")
    }
    validate();
  }
}

function runNotebook() {
  if (IPython.notebook.kernel && IPython.notebook.kernel.is_connected()) {
    IPython.notebook.clear_all_output();
    console.log('Starting execution');
    if (getParameter('vcr') == '1') {
      IPython.notebook.kernel.execute(
          "import vcr\n" +
          "import re\n" +
          "\n" +
          window.vcr_matchers +
          "\n" +
          "cassette_file = '" + IPython.notebook.notebook_path + ".yaml'\n" +
          "myvcr = vcr.VCR()\n" +
          "vcr_matcher_register(myvcr)\n" +
          "cassette = myvcr.use_cassette(cassette_file)\n" +
          "cassette.__enter__()\n")
    }
    
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

if (!('scrubber' in window)) {
  window.scrubber = function(mimetype, data) {
    return data;
  }
  window.vcr_matchers = "def vcr_matcher_register(v):\n  pass\n";
}

require(['base/js/namespace', 'base/js/events', 'base/js/dialog', 'base/js/utils', 'base/js/security'],
        testNotebook);

