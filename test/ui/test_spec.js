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

/*
 * This is a UI test suite that makes sure various parts of the app look
 * as expected, and validates a subset of interactions
 */

const selenium = require('selenium-webdriver'),
      By = selenium.By,
      until = selenium.until;
const test = require('selenium-webdriver/testing');
const fs = require('fs');
const resemble = require('node-resemble');
require('jasmine2-custom-message');

let driver = null;

const suiteTimeout = 60000;  // maximum of one minute for running each suite
const initTimeout = 10000;   // 10 seconds for initialization time, building the webdriver
const scriptTimeout = 10000; // 10 seconds for running synchronous js scripts in the driver
const misMatchThreshold = 0;
const goldenPathPrefix = 'ui/golden/';
const brokenPathPrefix = 'ui/broken/';

function screenshotAndCompare(goldenPath, testName, done) {
  return driver.takeScreenshot()
      .then(function(shot) {
        if (!fs.existsSync(goldenPathPrefix + goldenPath)) {
          fs.writeFileSync(brokenPathPrefix + testName + '.png', shot, 'base64');
          fail('Could not find golden: ' + goldenPath);
        }
        golden = fs.readFileSync(goldenPathPrefix + goldenPath);

        resemble('data:image/png;base64,' + shot).compareTo(golden).onComplete(function(data) {
          if (!fs.existsSync(brokenPathPrefix)){
            fs.mkdirSync(brokenPathPrefix);
          }
          if (data.misMatchPercentage > misMatchThreshold) {
            console.log('Image similarity greater than threshold: ', data.misMatchPercentage);
            fs.writeFileSync(brokenPathPrefix + testName + '.png', shot, 'base64');
          }

          since('Images for test ' + testName + ' are different')
              .expect(data.misMatchPercentage <= misMatchThreshold).toBe(true);
        });
      })
      .finally(() => {
        if (done) {
          done();
        }
      });
}

describe('UI tests', function() {

  // build the selenium webdriver
  beforeAll(function() {
    driver = new selenium.Builder()
      .forBrowser('chrome')
      .usingServer('http://localhost:4444/wd/hub')
      .build();

    driver.manage().timeouts().setScriptTimeout(scriptTimeout);
    return driver.manage().window().setSize(1024, 768);
  }, initTimeout);

  describe('Tree page', function() {
    // navigate to localhost:8081, which is redirected to the tree page
    beforeAll(function(done) {
      return driver.get('http://localhost:8081/tree/datalab')
        .then(function() {
          driver.wait(until.titleIs('Google Cloud DataLab'), 5000);
        })
        .then(function() {
          // wait for the Datalab page to finish loading
          return driver.wait(function() {
            return driver.executeScript('return window.datalab.loaded')
              .then(function(loaded) {
                return loaded === true;
              });
          }, 10000);
        })
        .finally(() => done());
    });

    it('appears correctly before any actions have been taken', function(done) {
      return screenshotAndCompare('body.png', 'body', done);
    });

    it('opens help menu correctly when its button is clicked', function(done) {
      return driver.findElement(By.id('helpButton'))
        .then(function(button) {
          button.click();
        })
        .then(screenshotAndCompare('bodyWithHelp.png', 'bodyWithHelp', done));
    });

    it('appears correctly after closing help menu by clicking the body element', function(done) {
      return driver.findElement(By.tagName('body'))
        .then(function(button) {
          button.click();
        })
        .then(screenshotAndCompare('body.png', 'body', done));
    });

    // Simulate a list reload by calling the Jupyter function, and waiting
    // on the draw list event to make sure all elements have rendered
    function reloadNotebookList() {
      driver.executeAsyncScript(function() {
        const callback = arguments[arguments.length - 1];
        require(['base/js/events'], function(events) {
          events.on('draw_notebook_list.NotebookList', callback);
        });
        Jupyter.notebook_list.load_list()
      });
    }

    it('shows(hides) extra buttons when a tree item is (un)selected', function(done) {
      // Reload the notebook list to make sure the tree initialization
      // code isn't executed more than once
      reloadNotebookList();

      // Get an item in the file listing. the reason we're not using first
      // is because the first item is not selectable (up dir)
      const listItem = driver.findElement(
        By.xpath('(//div[@id="notebook_list"]/div[@class="list_item row"])[last()]'));

      // Click the item, make sure the UI changes accordingly (extra buttons added)
      listItem.click();
      return screenshotAndCompare('listItemSelected.png', 'listItemSelected', null)
        .then(function() {
          // Now unselect the same item and make sure the extra icons disappear
          listItem.click();
          return screenshotAndCompare('listItemUnselected.png', 'listItemUnselected', done);
        });
    });

    it('clicks Add Folder and makes sure a new folder is added', function(done) {
      // Add a new folder
      driver.findElement(By.id('addFolderButton')).click();
      reloadNotebookList();
      return screenshotAndCompare('folderAdded.png', 'folderAdded', done);
    });

    it('clicks Add Notebook and makes sure a new notebook is added', function(done) {
      // Add a new notebook
      driver.findElement(By.id('addNotebookButton')).click();
      reloadNotebookList();
      return screenshotAndCompare('folderAndNotebookAdded.png', 'folderAndNotebookAdded', done);
    });

  }, suiteTimeout);

  afterAll(function() {
    driver.quit();
  });

});
