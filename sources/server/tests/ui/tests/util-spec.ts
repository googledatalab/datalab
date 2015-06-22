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
import util = require('app/common/util');

interface EventHandler {
  (event: any, message: any): void;
}

describe('Angular event registration test', () => {
  var scope: ng.IScope;
  var wasCalled: boolean;
  var callback: EventHandler;

  beforeEach(inject(($rootScope: ng.IRootScopeService) => {
    wasCalled = false;
    scope = $rootScope.$new();
    callback = (event: any, data: any) => {
      wasCalled = true;
    };

  }));

  afterEach(() => {
    wasCalled = false;
    scope = null;
  });

  it('checks if $emit triggers the callback.', () => {
    scope.$on('foo', callback);
    scope.$emit('foo', 'emit message');

    expect(wasCalled).toBe(true);
  });

  it('checks if $broadcast triggers the callback', () => {
    scope.$on('foo', callback);
    scope.$broadcast('foo', 'broadcast message')

    expect(wasCalled).toBe(true);
  });
});

describe('Event handler registration test', () => {
  var scope: ng.IScope;
  var wasCalled: boolean;
  var callback: EventHandler;

  beforeEach(inject(($rootScope: ng.IRootScopeService) => {
    wasCalled = false;
    scope = $rootScope.$new();
    callback = (event: any, data: any) => {
      wasCalled = true;
    };

  }));

  afterEach(() => {
    wasCalled = false;
    scope = null;
  });

  it('checks if $emit triggers the callback.', () => {
    util.registerEventHandler(scope, 'foo', callback);
    scope.$emit('foo', 'emit message');
    scope.$digest();

    expect(wasCalled).toBe(true);
  });

  it('checks if $broadcast triggers the callback', () => {
    util.registerEventHandler(scope, 'foo', callback);
    scope.$broadcast('foo', 'broadcast message')
    scope.$digest();

    expect(wasCalled).toBe(true);
  });
});
