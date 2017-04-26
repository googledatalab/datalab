/*
 * Copyright 2017 Google Inc. All rights reserved.
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

// This is an e2e test suite that runs notebooks in a browser, execute all their cells
// and make sure no errors were thrown.
// It reads a spec.json file specifying which notebooks to run, and optionally a list
// of cell numbers of ignore, which can be useful if specific cells are flaky
// or intentionally erroneous.

const assert = require('assert');
const selenium = require('selenium-webdriver'),
      until = selenium.until;
const test = require('selenium-webdriver/testing');
const fs = require('fs');

var driver = null;

const notebooks_config = JSON.parse(fs.readFileSync('notebook/spec.json'))
const timeOut = 60000;

test.before(function() {
  this.timeout(timeOut);
  driver = new selenium.Builder()
    .forBrowser('chrome')
    .usingServer('http://localhost:4444/wd/hub')
    .build();

  driver.manage().window().setSize(1024, 768);
});

test.after(function() {
  driver.quit();
});

function testNotebook(path, ignoreList = []) {
  const notebookTitle = path.substr(path.lastIndexOf('/') + 1).slice(0, -'.ipynb'.length);
  return driver.get('http://localhost:8081/notebooks/' + path)
    .then(driver.wait(until.titleIs(notebookTitle), 5000))
    .then(function() {
      // wait for the Datalab page to finish loading
      return driver.wait(function() {
        return driver.executeScript('return window.datalab.loaded')
          .then(function(loaded) {
            return loaded === true;
          });
      }, 10000);
    })
    .then(function() {
      // run all cells
      return driver.executeScript('Jupyter.notebook.clear_all_output();')
      .then(driver.executeScript('Jupyter.notebook.execute_all_cells();'))
      // wait for execution to finish. We don't have a good way to do this
      // so one way is to check that no cells have an asterisk for their input
      // prompt number fields, the existence of which signals that its cell
      // is still running, and we'll have to wait
      .then(driver.wait(function() {
        return driver.executeScript(
          'return Jupyter.notebook.get_cells().some(function(cell) {' +
            'return cell.cell_type === "code" && ' +
            'cell.input_prompt_number === "*";' +
          '})')
          .then(function(stillRunning) {
            return stillRunning === false;
          });
        }, 60000));
    })
    .then(function() {
      // validate no cells have failed
      return driver.executeScript('return JSON.stringify(Jupyter.notebook.get_cells());')
        .then(function(cells) {
          cells = JSON.parse(cells);
          cells.forEach(function(cell, idx) {
            if (cell.outputs) {
              cell.outputs.forEach(function(output) {
                if (ignoreList.indexOf(idx) === -1 && output.output_type === 'stream') {
                  assert(output.name !== 'stderr',
                         'Cell #' + idx + ' threw an error: ' + output.text);
                }
              });
            }
          });
        });
    })
    .then(function() {
      // saving the notebook avoids having to deal with an alert when navigating away
      return driver.executeScript('Jupyter.notebook.save_notebook();')
      .then(driver.wait(function() {
        return driver.executeScript('return Jupyter.notebook.dirty')
          .then(function(dirty) {
            return dirty === false;
          });
      }, 2000));
    });
}

test.describe('Notebook tests', function() {

  this.timeout(timeOut);
  notebooks_config.forEach(function(nb) {
    test.it('Running notebook ' + nb.path, function() {
      return testNotebook(nb.path, nb.ignore);
    });
  });

});
