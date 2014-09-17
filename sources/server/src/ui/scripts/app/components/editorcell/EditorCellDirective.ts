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
 * Directive for creating a single editor cell
 *
 * The input region provides and editable text region. The output region appears if there is any
 * output content, and disappears is the output content is falsey (undefined/null/empty).
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <amd-dependency path="app/components/codeeditor/CodeEditorDirective" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import app = require('app/App');


var log = logging.getLogger(constants.scopes.editorCell);

/**
 * Defines the shape of the controller/directive isolate scope.
 */
interface IEditorCellScope extends ng.IScope {
  inputText: string;
  outputHtml: string;
  trustedOutputHtml: string;
  cellIndex: number;
}

/**
 * Creates a directive definition.
 */
function editorCellDirective (): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      inputText: '=',
      outputs: '=',
      executionCounter: '@'
    },
    templateUrl: constants.scriptPaths.app + '/components/editorcell/editorcell.html'
  }
}

app.registrar.directive(constants.editorCell.directiveName, editorCellDirective);
log.debug('Registered editor cell directive');
