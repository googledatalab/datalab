
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
 * Renders the list of outputs for a cell.
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.cellOutputViewer);

/**
 * Creates a cell output viewer directive definition.
 *
 * @return A directive definition.
 */
function cellOutputViewerDirective (): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      outputs: '='
    },
    templateUrl: constants.scriptPaths.app + '/components/celloutputviewer/celloutputviewer.html',
    replace: true,
  }
}

_app.registrar.directive(constants.cellOutputViewer.directiveName, cellOutputViewerDirective);
log.debug('Registered cell output viewer directive');
