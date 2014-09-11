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
 * Directive for creating a single code editor element
 */
/// <reference path="../../../../../../typedefs/angularjs/angular.d.ts" />
/// <reference path="../../../../../../typedefs/codemirror/codemirror.d.ts" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import app = require('app/App');
import codeMirror = require('codeMirror');


var log = logging.getLogger(constants.scopes.codeEditor);

var codeMirrorOptions: CodeMirror.EditorConfiguration = {
  lineNumbers: true
};

/**
 * Defines the shape of the directive scope.
 */
interface ICodeEditorScope extends ng.IScope {
  code: string;
}

/**
 * Sets up the event handlers to link the directive scope to the external world.
 *
 * @param scope the directive's (isolate) scope
 * @param element the jqLite-selected directive element
 */
function codeEditorDirectiveLink (
    scope: ICodeEditorScope,
    element: ng.IAugmentedJQuery)
    : void {
  var cmContainer = <HTMLTextAreaElement>element[0];
  var cmInstance: CodeMirror.Editor = codeMirror(cmContainer, codeMirrorOptions);

  // Sets the inital code editor content equal to the linked template attribute value.
  // The 'code' element attribute will point to a value in the parent scope/controller.
  cmInstance.setValue(scope.code);

  // Registers a callback to update the scope's 'code' value when the CodeMirror content changes
  cmInstance.on('change', (
      cm: CodeMirror.Editor,
      change: CodeMirror.EditorChange
      ) => {
    // Wraps scope modifications in an $apply to "publish" them to the parent scope/ctrl
    scope.$apply(() => {
      scope.code = cm.getValue();
    });
  });
};

/**
 * Creates a code editor directive
 * 
 * @return a directive definition
 */
function codeEditorDirective (): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      code: '=contents'
    },
    link: codeEditorDirectiveLink
  }
}

app.registrar.directive(constants.components.codeEditor.directiveName, codeEditorDirective);
log.debug('Registered code editor directive');