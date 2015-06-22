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


/// <reference path="../../../../../../externs/ts/jasmine.d.ts"/>
/// <reference path="../../../../../../externs/ts/angularjs/angular.d.ts"/>
/// <reference path="../../../../../../externs/ts/angularjs/angular-mocks.d.ts"/>
/// <amd-dependency path="angularMocks" />

import clientNotebook = require('app/components/sessions/ClientNotebook');
import constants = require('app/common/Constants');
import editPage = require('app/notebooks/edit/EditPageController');
import mocks = require('tests/mocks');
import util = require('tests/util');


describe('Edit page', () => {
  var controllerService: ng.IControllerService;
  var injectables: app.Map<any>;
  var nb: app.IClientNotebook;
  var rootScope: ng.IRootScopeService;

  beforeEach(inject(($controller: ng.IControllerService, $rootScope: ng.IRootScopeService) => {
    controllerService = $controller;
    rootScope = $rootScope;

    nb = new clientNotebook.ClientNotebook(rootScope, util.clone(mocks.routeService));
  }));

  it('creates a controller instance', () => {
    var ctrl = new editPage.EditPageController(rootScope, <app.IClientApi>{}, nb, <app.ISessionEventDispatcher>{});
    expect(ctrl.tab).toBe('outline');
    expect(ctrl.notebook).toBe(nb);
  });

});
