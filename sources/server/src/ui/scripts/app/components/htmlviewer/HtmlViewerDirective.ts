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
 * Renders HTML with <script> tag execution.
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.htmlViewer);

/**
 * HTML Viewer directive scope typedef.
 */
interface HtmlViewerScope extends ng.IScope {
  source: string;
}

/**
 * HTML viewer directive link function.
 *
 * @param scope The directive scope.
 * @param element The directive element.
 */
function htmlViewerDirectiveLink (
    scope: HtmlViewerScope,
    element: ng.IAugmentedJQuery) {

  // The directive DOM element will be the container for the HTML content.
  var containerElement = element[0];
  // Nodes (text, elements, etc.) are written to a document fragment while building.
  var docFragment = document.createDocumentFragment();

  // A throw-away element is used to parse the raw HTML string into DOM nodes.
  var parserElement = document.createElement('div');
  parserElement.innerHTML = scope.source;

  // Build the document fragment that will contain the HTML nodes.
  for (var i = 0; i < parserElement.childNodes.length; ++i) {
    var node = parserElement.childNodes[i];
    var nodeToAdd: Node;

    if ('script' == node.nodeName.toLowerCase()) {
      // Construct a <script> element that will execute the given JavaScript
      nodeToAdd = document.createElement('script');
      nodeToAdd.appendChild(document.createTextNode(node.textContent));
    } else {
      // All other node types are simply cloned into the document fragment.
      nodeToAdd = node.cloneNode(/* deep copy */ true);
    }

    // Add it to the document fragment.
    docFragment.appendChild(nodeToAdd);
  }

  // Add the content from the document fragment to the main document/page.
  containerElement.appendChild(docFragment);
}

/**
 * Creates a directive definition.
 *
 * @return An Angular directive definition.
 */
function htmlViewerDirective (): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      source: '='
    },
    template: '<div class="datalab-html-viewer"></div>',
    replace: true,
    link: htmlViewerDirectiveLink
  }
}

_app.registrar.directive(constants.htmlViewer.directiveName, htmlViewerDirective);
log.debug('Registered html viewer directive');
