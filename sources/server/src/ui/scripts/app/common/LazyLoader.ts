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
 * Utilities for lazy-loading Angular components.
 */
/// <reference path="../../../../../typedefs/requirejs/require.d.ts" />
/// <reference path="Interfaces.ts" />


/**
 * Loads the given (TypeScript) module and invokes it's ngRegister() method.
 *
 * @param q angular's $q service for generating deferred tasks
 * @param rootScope root angular scope
 * @param otherRequire require function from an appropriate scope
 * @param modulePath path to the (TS) module relative to otherRequire's filepath
 * @return a promise that when resolved will ensure the given controller is registered with angular
 */
export function load (
    q: ng.IQService,
    rootScope: ng.IRootScopeService,
    otherRequire: Require,
    modulePath: string
    ): ng.IPromise<any> {

  var deferred = q.defer();
  otherRequire([modulePath], (loadedModule: any) => {
    // Resolve the promise and notify the root scope of potential updates
    rootScope.$apply((): void => {
      deferred.resolve();
    });
  });

  // Promise will be resovled once the module is loaded and angular components are registered
  return deferred.promise;
}