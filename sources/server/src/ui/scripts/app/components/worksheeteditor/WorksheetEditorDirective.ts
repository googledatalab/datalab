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
 * Directive for rendering a single worksheet.
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <amd-dependency path="app/components/codecell/CodeCellDirective" />
/// <amd-dependency path="app/components/markdowncell/MarkdownCellDirective" />
/// <amd-dependency path="app/components/headingcell/HeadingCellDirective" />
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.worksheetEditor);

interface WorksheetEditorScope extends ng.IScope {
  worksheet: app.notebooks.Worksheet;
}

/**
 * Creates a worksheet editor directive definition.
 *
 * @return A directive definition.
 */
function worksheetEditorDirective (): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      worksheet: '='
    },
    replace: true,
    templateUrl: constants.scriptPaths.app + '/components/worksheeteditor/worksheeteditor.html',
  }
}

_app.registrar.directive(constants.worksheetEditor.directiveName, worksheetEditorDirective);
log.debug('Registered worksheet editor directive');
