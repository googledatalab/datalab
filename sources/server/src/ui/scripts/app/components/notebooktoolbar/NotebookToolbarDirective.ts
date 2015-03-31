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
 * Directive for rendering a notebook-level toolbar
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <amd-dependency path="app/components/sessions/ClientNotebookSession" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.notebookToolbar);

interface NotebookToolbarScope extends ng.IScope {
  clientNotebookSession: app.IClientNotebookSession;
}

class NotebookToolbarController {

  _clientNotebookSession: app.IClientNotebookSession;
  _scope: NotebookToolbarScope;

  static $inject = ['$scope', constants.clientNotebookSession.name];

  /**
   * Constructor.
   *
   * @param scope The directive scope.
   * @param clientNotebookSession The client's notebook session.
   */
  constructor(
      scope: NotebookToolbarScope,
      clientNotebookSession: app.IClientNotebookSession) {
    this._scope = scope;
    this._scope.clientNotebookSession = clientNotebookSession
  }
}

/**
 * Creates a directive definition.
 */
function notebookToolbarDirective(): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      worksheetId: '=',
      cellId: '='
    },
    templateUrl: constants.scriptPaths.app + '/components/notebooktoolbar/notebooktoolbar.html',
    replace: true,
    controller: NotebookToolbarController
  }
}

_app.registrar.directive(constants.notebookToolbar.directiveName, notebookToolbarDirective);
log.debug('Registered notebook toolbar directive');
