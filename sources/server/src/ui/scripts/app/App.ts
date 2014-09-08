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
/// <reference path="../../../../typedefs/app/app.d.ts" />
/// <amd-dependency path="angularRoute" />
import angular = require('angular');
import constants = require('app/common/Constants');
import registrarModule = require('app/common/Registrar');
import notebooksRoute = require('app/notebooks/NotebooksRoute');
import notebooksEditRoute = require('app/notebooks/edit/EditRoute');


// Create the root Angular module for the app
export var app: ng.IModule = angular.module(constants.appModuleName, ['ngRoute']);

// Expose a post-bootstrap registration object to allow for lazy-loaded Angular components
export var registrar: app.IRegistrar;

/**
 * Captures pre-bootstrap provider instances for creating a Registrar singleton.
 *
 * @param controllerProvider Angular's $controllerProvider
 * @param compileProvider Angular's $compileProvider
 * @param filterProvider Angular's $filterProvider
 * @param provide Angular's $provide service
 */
function configureRegistrar (
    controllerProvider: ng.IControllerProvider,
    compileProvider: ng.ICompileProvider,
    filterProvider: ng.IFilterProvider,
    provide: ng.auto.IProvideService): void {
  registrar = new registrarModule.Registrar(controllerProvider, compileProvider, filterProvider,
      provide);
}
configureRegistrar.$inject = ['$controllerProvider', '$compileProvider', '$filterProvider',
    '$provide'];
app.config(configureRegistrar);

/**
 * Adds routes and associated handlers to the Angular app
 *
 * TODO(bryantd): have a Route objects return a list of routes and support it here
 */
function addRoutes (routeProvider: ng.route.IRouteProvider): void {
  routeProvider
    .when('/notebooks', notebooksRoute.route)
    .when('/notebooks/:notebookId', notebooksEditRoute.route)
    .otherwise({
      redirectTo: '/notebooks'
    });
};
addRoutes.$inject = ['$routeProvider'];
app.config(addRoutes);

// Bootstrap the Angular application
angular.element(document).ready(() => {
  angular.bootstrap(document, [constants.appModuleName]);
});