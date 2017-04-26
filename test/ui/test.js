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
const misMatchThreshold = 0;
const goldenPathPrefix = 'ui/goldens/';
const brokenPathPrefix = 'ui/broken/';

test.before(function() {
  this.timeout(suiteTimeout);
  driver = new selenium.Builder()
    .forBrowser('chrome')
    .usingServer('http://localhost:4444/wd/hub')
    .build();

  driver.manage().window().setSize(1024, 768);
  return driver.get('http://localhost:8081')
    .then(driver.wait(until.titleIs('Google Cloud DataLab'), 5000))
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

test.after(function() {
  driver.quit();
});

// Takes a screenshot of the current browser page, and compares it
// against the specified golden image at goldenPath
// If the two images have a mismatch that is greater than
// misMatchThreshold, the test fails, and the bad screenshot is
// saved under ui/broken with the testName
function screenshotAndCompare(goldenPath, testName) {
  return driver.takeScreenshot().then(function(shot) {
    if (!fs.existsSync(goldenPathPrefix + goldenPath)) {
      console.log('Could not find golden: ' + goldenPath);
      fs.writeFileSync(brokenPathPrefix + testName + '.png', shot, 'base64');
      return;
    }
    golden = fs.readFileSync(goldenPathPrefix + goldenPath);

    resemble('data:image/png;base64,' + shot).compareTo(golden).onComplete(function(data) {
      if (!fs.existsSync(brokenPathPrefix)){
        fs.mkdirSync(brokenPathPrefix);
      }
      if (data.misMatchPercentage > misMatchThreshold) {
        console.log('Image similarity greater than threshold: ', data.misMatchPercentage);
        console.log('Bad image:', shot);
        fs.writeFileSync(brokenPathPrefix + testName + '.png', shot, 'base64');
      }

      assert(data.misMatchPercentage <= misMatchThreshold,
             'Images for test ' + testName + ' are different');
    });
  });
}

test.describe('UI tests', function() {

  test.it('Makes sure window looks fine at the beginning of tests', function() {
    return screenshotAndCompare('body.png', 'body');
  });

  test.it('Opens help menu and makes sure it looks fine', function() {
    return driver.findElement(By.id('helpButton'))
    .then(function(button) {
      button.click();
    })
    .then(screenshotAndCompare('bodyWithHelp.png', 'bodyWithHelp'));
  });

  test.it('Close help menu and makes sure body looks fine', function() {
    return driver.findElement(By.tagName('body'))
    .then(function(button) {
      button.click();
    })
    .then(screenshotAndCompare('body.png', 'body'));
  });
});
