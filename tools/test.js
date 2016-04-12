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

function get_cell_contents() {
  var cells = IPython.notebook.get_cells();
  var outputs = []
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

function validate(old_outputs, new_outputs) {
  var failed = false;
  console.log('Validating...');
  var result = '';
  if (old_outputs.length != new_outputs.length) {
    var msg = 'Old output had ' + old_outputs.length + ' entries but new output has ' +
        new_outputs.length + ' entries';
    console.log('FAIL: ' + msg);
    result += '#' + msg;
    failed = true;
  }
  for (var i in new_outputs) {
    var cellfailed = false;
    var old_output = old_outputs[i];
    var new_output = new_outputs[i];
    var element = new_output.element;
    if (old_output.outputs == null) {
      if (new_output.outputs != null) {
        var msg = 'Cell ' + i + ' had no outputs but now has ' + new_output.outputs.length;
        console.log('FAIL: ' + msg);
        result += '#' + msg;
        cellfailed = true;
      }
    } else if (new_output.outputs == null) {
      console.log('FAIL: Cell ' + i + ' now has no code output but did before');
      cellfailed = true;
    } else if (old_output.outputs.length != new_output.outputs.length) {
      var msg = 'Cell ' + i + ' had ' + old_output.outputs.length + ' outputs but now has ' +
          new_output.outputs.length;
      console.log('FAIL: ' + msg);
      result += '#' + msg;
      cellfailed = true;
    }
    if (cellfailed) {
      result += '#' + i + ':F';
    } else {
      for (var j in new_output.outputs) {
        var old_set = old_output.outputs[j];
        var new_set = new_output.outputs[j];
        if (old_set.length != new_set.length) {
          cellfailed = true;
          result += '#' + i + ':F';
          break;
        }
        for (var mt in new_set) {
          if (new_set[mt] != old_set[mt]) {
            console.log('FAIL: Failed at ' + i + ': ' + mt + '\nExpected: ' + old_set[mt] +
                '\nbut got: ' + new_set[mt]);
            cellfailed = true;
            result += '#' + i + '/' + mt + ':F';
            break;
          }
        }
      }
    }
    if (cellfailed) {
      failed = true;
    }
    if (new_output.element) {
      if (cellfailed) {
        new_output.element[0].style.backgroundColor="red";
      } else {
        new_output.element[0].style.backgroundColor="green";
      }
    }
  }
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

function checkIfDone(old_outputs) {
  if (IPython.notebook.kernel_busy) {
    console.log('Busy');
    setTimeout(function() {
      checkIfDone(old_outputs);
    }, 1000);
  } else {
    console.log('Finished execution');
    var new_outputs = get_cell_contents();
    if (getParameter('vcr') == '1') {
      IPython.notebook.kernel.execute("cassette.__exit__(None, None, None)\n")
    }
    validate(old_outputs, new_outputs);
  }
}

function runNotebook() {
  if (IPython.notebook.kernel && IPython.notebook.kernel.is_connected()) {
    var old_outputs = get_cell_contents();
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
      checkIfDone(old_outputs);
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

