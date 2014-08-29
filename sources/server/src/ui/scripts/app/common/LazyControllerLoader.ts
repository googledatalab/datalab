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
 * Utilities for lazy-loading Angular controllers.
 */
/// <reference path="../../../../../typedefs/requirejs/require.d.ts" />
/// <reference path="../../../../../typedefs/angularjs/angular.d.ts" />
import angular = require('angular');


/**
 * Registers the given controller with Angular so that it is available for injection.
 *
 * This function is meant to be post-Angular bootstrap whenever the controller (and it's
 * dependencies) should be loaded.
 *
 * Angular's $controllerProvider instance is only available pre-boostrap (i.e., during
 * configuration), so rely upon the caller passing a reference to it somehow.
 *
 * TODO(bryantd): Needs to be refactored into a generic "lazy load" util that can be used
 * for all of dynamic angular loading means (i.e., make all providers available post-bootstrap).
 *
 * @param  $q  Generates deferred tasks
 * @param  $controllerProvider  Registers controllers with Angular
 * @param  otherRequire  Require function from an appropriate scope
 * @param  controllerName  Name under which to register the controller with Angular (i.e., DI name)
 * @param  modulePath  Path to the controller module relative to otherRequire scope
 * @return A promise the when resolved will ensure the given controller is registered with Angular
 */
export function loadController (
    $q: ng.IQService,
    $controllerProvider: ng.IControllerProvider,
    otherRequire: (modulePaths: string[], callback: Function) => any,
    controllerName: string,
    modulePath: string
    ): ng.IPromise<any> { // Promise that ensures controller registration pre-resolve

  var deferred = $q.defer();
  otherRequire([modulePath], (controllerModule: {[key:string]: any}) => {
    // Register the controller with Angular
    // TODO(bryantd): does this need to be wrapped in $rootScope.apply?
    $controllerProvider.register(controllerName, controllerModule[controllerName]);
    deferred.resolve();
  });
  return deferred.promise;
}