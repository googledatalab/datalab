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
 * This is a unit test suite that makes sure various parts of the app function
 * as expected
 */

const assert = require('assert');
var requirejs = require("requirejs");
requirejs.config({
    baseUrl: '../sources/web/datalab/static/',
    nodeRequire: require
});

describe('Unit tests', function() {
describe('Notebook list', function() {

  var notebookList = requirejs('notebook-list');
  notebookList.debug.log = () => {};

  it('strToSemver converts a string version into a backward compatible semver array', function() {
    // old clients compatibility
    assert.deepEqual(notebookList._strToSemver('2017'), [0, 5, 2017]);

    // new clients
    assert.deepEqual(notebookList._strToSemver('1.1.2017'), [1, 1, 2017]);

    // bad version
    assert.equal(notebookList._strToSemver('1.1.1.2017'), null);
  });

  it('semverCompare compares semantic version strings correctly', function() {
    assert.equal(notebookList._semverCompare([0,0,0], [0,0,1]), -1);
    assert.equal(notebookList._semverCompare([0,2,0], [1,0,0]), -1);
    assert.equal(notebookList._semverCompare([2,0,0], [10,0,0]), -1);

    assert.equal(notebookList._semverCompare([10,5,5], [4,2,0]), 1);
    assert.equal(notebookList._semverCompare([1,2,2], [1,2,1]), 1);

    assert.equal(notebookList._semverCompare([0,0,1], [0,0,1]), 0);
    assert.equal(notebookList._semverCompare([2,0,1], [2,0,1]), 0);
    assert.equal(notebookList._semverCompare([0,3,8], [0,3,8]), 0);

    assert.equal(notebookList._semverCompare([7,0,0], [7,0]), null);
  });

});
});
