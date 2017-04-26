const assert = require('assert');
const selenium = require('selenium-webdriver'),
      By = selenium.By,
      until = selenium.until;
const test = require('selenium-webdriver/testing');
const fs = require('fs');
const resemble = require('node-resemble');

var driver = null;

const timeOut = 60000;
const similarityThreshold = 0;
const goldenPathPrefix = 'ui/goldens/';
const brokenPathPrefix = 'ui/broken/';

test.before(function() {
  this.timeout(timeOut);
  let options = {'args': ['disable-infobars']}
  driver = new selenium.Builder()
    .forBrowser('chrome')
    .usingServer('http://localhost:4444/wd/hub')
    .build();

  driver.manage().window().setSize(1024, 768);
  return driver.get('http://localhost:8081')
    .then(() => driver.wait(until.titleIs('Google Cloud DataLab')))
    .then(() => {
      // wait for the Datalab page to finish loading
      return driver.wait(() => {
        return driver.executeScript('return window.datalab.loaded')
          .then(loaded => {
            return loaded === true;
          });
      }, 10000);
    });
});

test.after(function() {
  driver.quit();
});

function screenshotAndCompare(goldenPath, testName, callback) {
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
      if (data.misMatchPercentage > similarityThreshold) {
        console.log('Image similarity greater than threshold: ', data.misMatchPercentage);
        console.log('Bad image:', shot);
        fs.writeFileSync(brokenPathPrefix + testName + '.png', shot, 'base64');
      }

      assert(data.misMatchPercentage <= similarityThreshold,
             'Images for test ' + testName + ' are different');
    });
  });
}

test.describe('UI unit tests', function() {

  test.it('Makes sure window looks fine at the beginning of tests', function() {
    return screenshotAndCompare('body.png', 'body');
  });

  test.it('Opens help menu and makes sure it looks fine', function() {
    return driver.findElement(By.id('helpButton'))
    .then(button => button.click())
    .then(() => screenshotAndCompare('bodyWithHelp.png', 'bodyWithHelp'));
  });

  test.it('Close help menu and makes sure body looks fine', function() {
    return driver.findElement(By.tagName('body'))
    .then(button => button.click())
    .then(() => screenshotAndCompare('body.png', 'body'));
  });

});
