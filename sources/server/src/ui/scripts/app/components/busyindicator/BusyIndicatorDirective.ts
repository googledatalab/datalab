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
 * Renders a busy indicator.
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');

var log = logging.getLogger(constants.scopes.busyIndicator);

/**
 * Busy indicator directive scope typedef.
 */
interface BusyIndicatorScope extends ng.IScope {
  /**
   * Is context currently busy?
   */
  busy: boolean;

  /**
   * Delay constant in milliseconds.
   *
   * Can only be passed as a string with current set of angular constant-binding hooks.
   */
  delay: string;

  /**
   * Enable the busy indicator?
   */
  enabled: boolean;

  /**
   * Should the busy indicator be shown?
   *
   * Equivalent to 'enabled' if the delay is zero, but otherwise only becomes true
   * after the delay has passed and enabled is still true.
   */
  show: boolean;
}

/**
 * Busy indicator directive controller.
 */
class BusyIndicatorController {

  _pendingTimeout: ng.IPromise<any>;
  _scope: BusyIndicatorScope;
  _timeout: ng.ITimeoutService;

  static $inject: string[] = ['$scope', '$timeout'];

  /**
   * Constructor.
   *
   * @param scope The directive scope.
   */
  constructor (scope: BusyIndicatorScope, timeout: ng.ITimeoutService) {
    this._pendingTimeout = null;
    this._scope = scope;
    this._timeout = timeout;

    this._scope.show = false;
  }

  /**
   * Show the busy indicator after a delay.
   *
   * @param delay Milliseconds after which the busy indicator should become visible.
   */
  showAfter(delay: number) {
    this._pendingTimeout = this._timeout(() => {
      this._scope.show = true;
    }, delay);
  }

  /**
   * Hides the busy indicator.
   */
  hide() {
    this._timeout.cancel(this._pendingTimeout);
    this._scope.$evalAsync(() => {
      this._scope.show = false;
    });
  }
}

function busyIndicatorDirectiveLink(
    scope: BusyIndicatorScope,
    element: ng.IAugmentedJQuery,
    attrs: ng.IAttributes,
    controller: BusyIndicatorController)
    : void {

  var delay = parseInt(attrs['delay']);

  scope.$watch('enabled', (isBusy: any) => {
    if (isBusy) {
      controller.showAfter(delay);
    } else {
      controller.hide();
    }
  });
};

/**
 * Creates a directive definition.
 *
 * @return An Angular directive definition.
 */
function busyIndicatorDirective (): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      busy: '=',
      delay: '@',
      enabled: '='
    },
    templateUrl: constants.scriptPaths.app + '/components/busyindicator/busyindicator.html',
    replace: true,
    controller: BusyIndicatorController,
    link: busyIndicatorDirectiveLink
  }
}

_app.registrar.directive(constants.busyIndicator.directiveName, busyIndicatorDirective);
log.debug('Registered busy indicator directive');
