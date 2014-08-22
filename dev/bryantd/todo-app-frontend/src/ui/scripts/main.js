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


/**
 * Configuration for require.js with angular bootstrap
 *
 * This is the main entrypoint to the js bits of the app.
 */ 
'use strict';

// Any external js libraries that need to be require-able are enumerated here.
require.config({
  paths: {
    // TODO(bryantd): Eventually add local fallbacks for these CDN versions
    angular: ['//cdnjs.cloudflare.com/ajax/libs/angular.js/1.2.20/angular.min'],
    angularRoute: ['//cdnjs.cloudflare.com/ajax/libs/angular.js/1.2.20/angular-route.min'],
    angularResource: ['//cdnjs.cloudflare.com/ajax/libs/angular.js/1.2.20/angular-resource.min'],
    socketio: '/socket.io/socket.io'
  },
  shim: {
    angular: {exports: 'angular'},
    angularRoute: {deps: ['angular']},
    angularResource: {deps: ['angular']},
    socketio: {exports: 'socketio'}
  }
});

/*
 * Specify and bootstrap the Todo App (angular) module
 *
 * The top-level controller is required, but not used here, to ensure it is available to the page
 * when angular bootstraps itself.
 *
 * The routes (requirejs) module is depended upon to ensure that everything needed for 
 * routing/views (and their transitive dependencies) is loaded
 */ 
require(['angular', 'routes'], function (angular) {
  angular.bootstrap(document, ['todo-app']);
});