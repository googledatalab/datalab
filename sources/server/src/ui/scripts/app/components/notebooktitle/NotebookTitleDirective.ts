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
 * Directive for rendering the notebook title widget
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <amd-dependency path="app/components/basename/BaseNameFilter" />
/// <amd-dependency path="app/components/sessions/ClientNotebook" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.notebookTitle);

interface NotebookTitleScope extends ng.IScope {
  title: string;
}

class NotebookTitleController {

  _scope: NotebookTitleScope;

  static $inject = ['$scope', constants.clientNotebook.name];

  /**
   * Constructor.
   *
   * @param scope The directive scope.
   * @param route The client's notebook session.
   */
  constructor(
      scope: NotebookTitleScope,
      clientNotebook: app.IClientNotebook) {

    this._scope = scope;
    this._scope.title = clientNotebook.notebookPath;
  }
}

/**
 * Creates a directive definition.
 */
function notebookTitleDirective(): ng.IDirective {
  return {
    restrict: 'E',
    templateUrl: constants.scriptPaths.app + '/components/notebooktitle/notebooktitle.html',
    replace: true,
    controller: NotebookTitleController
  }
}

_app.registrar.directive(constants.notebookTitle.directiveName, notebookTitleDirective);
log.debug('Registered notebook title directive.');
