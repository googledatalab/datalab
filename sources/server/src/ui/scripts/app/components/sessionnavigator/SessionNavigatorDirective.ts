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
 * Directive for a session navigator.
 */

/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../../shared/requests.d.ts" />
/// <amd-dependency path="app/services/SessionService" />
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import _app = require('app/App');

var log = logging.getLogger(constants.scopes.sessionNavigator);


interface SessionNavigatorScope extends ng.IScope {
  resources: app.SessionMetadata[];
  ctrl: SessionNavigatorController;
  sortColumn: string;
  sortOrder: string;
}

class SessionNavigatorController {

  static $inject = ['$scope', constants.sessionService.name];
 
  _scope: SessionNavigatorScope;
  _service: app.ISessionService;

  /**
   * Constructor.
   *
   * @param scope The directive's scope.
   */
  constructor (scope: SessionNavigatorScope, service: app.ISessionService) {
    this._scope = scope;
    this._scope.ctrl = this;
    this._scope.sortColumn = 'path';
    this._scope.sortOrder = '+';
    this._service = service;
    this.updateView();
  }

  /**
   * Refresh the view by getting the latest session list from the session service.
   */
  updateView() {
    this._service.list().then(
      (response: app.requests.ListSessionsResponse) => this.update(response)
    );
  }

  /**
   * Post-process the server response and convert the createdAt dates to strings in 
   * the format we want.
   */
  update(response: app.requests.ListSessionsResponse) {
    response.sessions.forEach((session, index) =>
        session.createdAt = (new Date(Date.parse(session.createdAt))).toLocaleString());
    this._scope.resources = response.sessions;
  }

  /**
   * Get the CSS class for a column based on sort-order.
   *
   * @param column: the property name associated with the column.
   */
  sortIconClass(column: string) : string {
    var cls = '';
    if (column == this._scope.sortColumn) {
      cls = 'datalab-navigator-header sort-' + (this._scope.sortOrder == '-' ? 'down' : 'up');
    }
    return cls;
  }

  /**
   * Handle the change in sort order resulting from a column header click.
   *
   * @param column: the property name associated with the column.
   */
  reSort(column: string) {
    if (this._scope.sortColumn == column) {
      // Same column so toggle order.
      this._scope.sortOrder = this._scope.sortOrder == '+' ? '-' : '+';
    } else {
      // New column so switch to that with ascending order.
      this._scope.sortColumn = column;
      this._scope.sortOrder = '+';
    }
  }

  /**
   * Remove a session from the resource list.
   *
   * @param path: the path of the session.
   */
  remove(path: string) {
    var resources = this._scope.resources;
    for (var i = 0; i < resources.length; i++) {
      if (resources[i].path == path) {
        resources.splice(i, 1);
        break;
      }
    }
  }

  /**
   * Shut down a session and then remove it from list.
   *
   * @param path: the path of the session.
   */
  shutdownSession(path: string) {
    this._service.shutdown(path).then(
      (item: string) => this.remove(item)
    );
  }

  /**
   * Reset a session.
   *
   * @param path: the path of the session.
   * TODO(gram) expose a way to do this in UX; there is none at present.
   */
  resetSession(path: string) {
    this._service.reset(path).then(
      (item: string) => log.debug("Reset session " + item)
    );
  }
}

/**
 * Creates a session navigator directive definition.
 *
 * @return A directive definition.
 */
function sessionNavigatorDirective (): ng.IDirective {
  return {
    restrict: 'E',
    replace: true,
    templateUrl: constants.scriptPaths.app + '/components/sessionnavigator/sessionnavigator.html',
    controller: SessionNavigatorController
  }
}

_app.registrar.directive(constants.sessionNavigator.directiveName, sessionNavigatorDirective);
log.debug('Registered session navigator directive');
