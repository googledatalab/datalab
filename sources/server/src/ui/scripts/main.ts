/*
 * Copyright 2014 Google Inc. All rights reserved.
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

/// <reference path="../../../../../externs/ts/requirejs/require.d.ts" />
/**
 * RequireJS configuration and angular bootstrapping
 *
 * All third-party JavaScript libraries should be referenced here,
 * other than RequireJS itself.
 */
require.config({
  paths: {
    // Third-party paths
    // TODO(bryantd): Update the requirejs typedefs to support a list of paths
    // to enable fallback locations
    // TODO(bryantd): Add local fallbacks if no licensing issues
    angular: '//ajax.googleapis.com/ajax/libs/angularjs/1.2.23/angular.min',
    angularRoute: '//ajax.googleapis.com/ajax/libs/angularjs/1.2.23/angular-route.min',
    marked: '//cdnjs.cloudflare.com/ajax/libs/marked/0.3.2/marked.min',
    socketio: '/socket.io/socket.io',
    d3: '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.13/d3',

    // First-party paths
    app: './app',

    // Profile configuration paths
    static: '/static',
    extensions: '/static/extensions',
    element: '/static/require/element',
    style: '/static/require/style',
    visualization: '/static/require/visualization'
  },

  shim: {
    angular: {exports: 'angular'},
    angularRoute: {deps: ['angular']},
    socketio: {exports: 'socketio'},
  },

  // CodeMirror addons (e.g., language modes, configurable editor features) internally make
  // references to "../../lib/codemirror" (assuming script path is <cmroot>/mode/lang/foo.js)
  // but CDNJS does not map the main codemirror.js to this relative path. This packages/map
  // config below fixes the issue by remapping references to the <cmroot>/lib/codemirror to
  // point to the actual path of the codemirror main js module
  //
  // Note: the name 'codeMirror' (camelCase) is defined by the "declare" statement in the
  // codemirror.d.ts; the string used there to declare the module needs to match the top-level
  // codemirror module name here
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
  }

  // TODO(bryantd): configure bundles here for working with concatenated sets of modules once we
  // have a build process for generating bundles.
});


/**
 * Entry point for the client-side application
 *
 * By requiring the top-level "App" module, angular components are registered, angular is
 * bootstrapped and the application renders a view based upon the current URL route *
 */
require(['app/App']);
