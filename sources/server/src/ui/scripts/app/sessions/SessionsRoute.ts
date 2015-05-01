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
 * Angular route configuration for the sessions page
 */
/// <reference path="../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../../../../../../../externs/ts/angularjs/angular-route.d.ts" />
/// <reference path="../common/Interfaces.ts" />
import lazyLoader = require('app/common/LazyLoader');
import constants = require('app/common/Constants');


var controllerName: string = constants.sessions.pageControllerName;
var controllerPath: string = './' + controllerName;

export function loadController (
    q: ng.IQService,
    rootScope: ng.IRootScopeService
    ): ng.IPromise<any> {
  return lazyLoader.load(q, rootScope, require, controllerPath);
}
loadController.$inject = ['$q', '$rootScope'];

export var route: ng.route.IRoute = {
  templateUrl: constants.scriptPaths.app + '/sessions/sessions.html',
  controller: controllerName,
  controllerAs: 'pageCtrl',
  resolve: {
    loadController: loadController
  }
};
