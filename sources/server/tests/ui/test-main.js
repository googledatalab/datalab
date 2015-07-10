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

/**
 * All files which match the TEST_REGEXP will be executed as tests by Karma.
 */
var allTestFiles = [];
var TEST_REGEXP = /(-spec)\.js$/i;
Object.keys(window.__karma__.files).forEach(function(file) {
  if (TEST_REGEXP.test(file)) {
    allTestFiles.push(file);
  }
});

require.config({
  // Note: Karma serves files under /base, which is the basePath from your config file
  // basePath + baseUrl = default lookup path for modules.
  //
  // See karma-config.js for the configured value of basePath.
  baseUrl: '/base',

  // Require that all tests and their transitive dependencies are loaded before starting the test.
  deps: allTestFiles,

  // Two general strategies for providing alternative/mocked versions of modules during testing
  // are outlined here for posterity. Both can be applied to substitute a third-party module
  // (e.g., socket.io) or an internal app module (e.g., app/common/Logging).
  //
  // 1. If you want to override some module globally (i.e., for all tests), specify a substitute
  // module to load via the paths configuration below (see socket.io example).
  //
  // 2. If you need to override a module for a specific test only (i.e., not globally), then
  // add a Requirejs "map" property that specifies the substitute module to load for a specified
  // test module. This strategy allows you to load a mocked version of some module for a given test
  // without needing to modify the code being tested. For details see:
  // http://requirejs.org/docs/api.html#config-map

  paths: {
    app: '/base/app',
    tests: '/base/tests',

    // Mocked RequireJS modules.
    socketio: '/base/tests/socketio-mock',

    // Third-party libraries.
    angular: 'https://ajax.googleapis.com/ajax/libs/angularjs/1.2.23/angular',
    angularMocks: 'https://ajax.googleapis.com/ajax/libs/angularjs/1.2.23/angular-mocks',
    angularRoute: 'https://ajax.googleapis.com/ajax/libs/angularjs/1.2.23/angular-route',
    marked: 'https://cdnjs.cloudflare.com/ajax/libs/marked/0.3.2/marked',
  },

  shim: {
    angular: {exports: 'angular'},
    angularRoute: {deps: ['angular']},
    angularMocks: {deps: ['angular'], 'exports': 'angular.mock'}
  },

  // Note: see the main.ts RequireJS config for an explanation of the CodeMirror configuration
  // needed here.
  packages: [
    {
      // Base path for codemirror AMD references
      name: 'codeMirror',
      // Base path for the actual resources in CDN
      location: '//cdnjs.cloudflare.com/ajax/libs/codemirror/4.8.0',
      // AMD reference to 'codeMirror' resolves to $location/$main (.js implied)
      main: 'codemirror.min'
    }
  ],
  map: {
    // Map AMD dependencies for codeMirror/lib/codemirror to the actual location of the main cm
    // module in the CDN
    codeMirror: { 'codeMirror/lib/codemirror': 'codeMirror/codemirror.min' }
  },

  // Starts running the tests once all dependencies (see config.deps property) have been resolved.
  callback: window.__karma__.start
});
