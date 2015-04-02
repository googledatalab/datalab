
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
 * Renders string content an an HTML heading element.
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import app = require('app/App');


var log = logging.getLogger(constants.scopes.headingViewer);

interface HeadingViewerScope extends ng.IScope {
  // The level attribute controls the heading level (h1 vs h2 vs h3 vs etc.)
  level: number;
  source: string;
}

/**
 * Creates a heading viewer directive definition.
 *
 * @return A directive definition.
 */
function headingViewerDirective (): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      level: '='
      source: '=',
    },
    templateUrl: constants.scriptPaths.app + '/components/headingviewer/headingviewer.html',
    replace: true
  }
}

app.registrar.directive(constants.headingViewer.directiveName, headingViewerDirective);
log.debug('Registered heading viewer directive');
