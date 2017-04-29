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

// This is a UI test suite that makes sure various parts of the app look
// as expected, and validates a subset of interactions

const assert = require('assert');
const selenium = require('selenium-webdriver'),
      By = selenium.By,
      until = selenium.until;
const test = require('selenium-webdriver/testing');
const fs = require('fs');
const resemble = require('node-resemble');

var driver = null;

const suiteTimeout = 60000;
const initTimeout = 10000;
const misMatchThreshold = 0;
const goldenPathPrefix = 'ui/golden/';
const brokenPathPrefix = 'ui/broken/';

function screenshotAndCompare(goldenPath, testName) {
  return driver.takeScreenshot().then(function(shot) {
    if (!fs.existsSync(goldenPathPrefix + goldenPath)) {
      fs.writeFileSync(brokenPathPrefix + testName + '.png', shot, 'base64');
      assert(false, 'Could not find golden: ' + goldenPath);
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

      assert(data.misMatchPercentage <= misMatchThreshold,
             'Images for test ' + testName + ' are different');
    });
  });
}

test.describe('UI tests', function() {

  // build the selenium webdriver
  before(function() {
    this.timeout(initTimeout);
    driver = new selenium.Builder()
      .forBrowser('chrome')
      .usingServer('http://localhost:4444/wd/hub')
      .build();

    driver.manage().timeouts().setScriptTimeout(5000);
    return driver.manage().window().setSize(1024, 768);
  });

  test.describe('Tree page', function() {
    this.timeout(suiteTimeout);

    // navigate to localhost:8081, which is redirected to the tree page
    before(function() {
      return driver.get('http://localhost:8081')
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
        });
    });

    test.it('appears correctly before any actions have been taken', function() {
      return screenshotAndCompare('body.png', 'body');
    });

    test.it('opens help menu correctly when its button is clicked', function() {
      return driver.findElement(By.id('helpButton'))
        .then(function(button) {
          button.click();
        })
        .then(screenshotAndCompare('bodyWithHelp.png', 'bodyWithHelp'));
    });

    test.it('appears correctly after closing help menu by clicking the body element', function() {
      return driver.findElement(By.tagName('body'))
        .then(function(button) {
          button.click();
        })
        .then(screenshotAndCompare('body.png', 'body'));
    });

    test.it('shows(hides) extra buttons when a tree item is (un)selected', function() {
      // simulate a list reload by calling the Jupyter function, and waiting
      // on the draw list event to make sure all elements have rendered
      // this makes sure the tree initialization code isn't executed more than once
      driver.executeAsyncScript(function() {
        let callback = arguments[arguments.length - 1];
        require(['base/js/events'], function(events) {
          events.on('draw_notebook_list.NotebookList', callback);
        });
        Jupyter.notebook_list.load_list()
      });

      // get an item in the file listing. the reason we're not using first
      // is because the first item is not selectable (up dir)
      let listItem = driver.findElement(
        By.xpath('(//div[@id="notebook_list"]/div[@class="list_item row"])[last()]'));

      // click the item, make sure the UI changes accordingly (extra buttons added)
      listItem.click();
      return screenshotAndCompare('listItemSelected.png', 'listItemSelected')
      .then(function() {
        // now unselect the same item and make sure the extra icons disappear
        listItem.click();
        return screenshotAndCompare('listItemUnselected.png', 'listItemUnselected');
      });
    });

  });

  after(function() {
    driver.quit();
  });

});
