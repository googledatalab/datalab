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
 * The global route configuration for the Todo App angular module
 */
define(['ng-app', 'edit/edit-controller', 'summary/summary-controller'],
  function (app, TodoEditController, TodoSummaryController) {
    'use strict';

    var BASE_URL = 'scripts/';

    // NOTE: the module being configured must ensure angular-resource is available
    return app.config(function ($routeProvider) {
      $routeProvider
        .when('/', {
          templateUrl: BASE_URL + 'edit/edit.ng',
          controller: 'TodoEditController', // TODO: possible to refactor to avoid needing string constant?
          controllerAs: 'ctrl'
        })
        .when('/summary', {
          templateUrl: BASE_URL + 'summary/summary.ng',
          controller: 'TodoSummaryController',
          controllerAs: 'ctrl'
        })
        .otherwise({
          redirectTo: '/'
        });
    });
});