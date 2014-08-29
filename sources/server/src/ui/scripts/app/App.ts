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
 * Top-level angular module
 */
/// <reference path="../../../../typedefs/angularjs/angular.d.ts" />
/// <reference path="../../../../typedefs/angularjs/angular-route.d.ts" />
/// <amd-dependency path="angularRoute" />
import angular = require('angular');
import notebooksRoute = require('app/notebooks/NotebooksRoute');
import notebooksEditRoute = require('app/notebooks/edit/EditRoute');


// Create the root Angular module for the app
export var app = angular.module('app', ['ngRoute']);

/**
 * Adds routes and associated handlers to the Angular app
 *
 * TODO(bryantd): have a Route objects return a list of routes and support it here
 */
function addRoutes (
    $routeProvider: ng.route.IRouteProvider,
    $controllerProvider: ng.IControllerProvider
    ): void {

  $routeProvider
    .when('/notebooks', notebooksRoute.configure($controllerProvider))
    .when('/notebooks/:notebookId', notebooksEditRoute.configure($controllerProvider))
    .otherwise({
      redirectTo: '/notebooks'
    });
};
addRoutes.$inject = ['$routeProvider', '$controllerProvider'];

app.config(addRoutes);

angular.element(document).ready(() => {
  angular.bootstrap(document, ['app']);
});
