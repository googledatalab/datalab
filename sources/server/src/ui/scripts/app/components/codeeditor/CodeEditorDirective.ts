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
 * Directive for creating a single code editor element.
 *
 * This directive wraps a CodeMirror instance and exposes attributes for two-way binding the source
 * (text) content.
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../../../../../../../../externs/ts/codemirror/codemirror.d.ts" />
/// <amd-dependency path="codeMirror/mode/python/python" />
/// <amd-dependency path="codeMirror/mode/markdown/markdown" />
/// <amd-dependency path="codeMirror/mode/sql/sql" />
/// <amd-dependency path="codeMirror/mode/javascript/javascript" />
/// <amd-dependency path="codeMirror/addon/edit/matchbrackets" />

import codeMirror = require('codeMirror');
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import highlighting = require('app/components/codeeditor/CodeEditorMagicHighlighting')
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.codeEditor);

// TODO(bryantd): enable dynamic language selection based upon containing cell attributes.
var codeMirrorOptions: CodeMirror.EditorConfiguration = {
  // TODO(bryantd): add hook to enable line numbers when containing cell becomes active.
  lineNumbers: false,

  indentUnit: 4,
  lineWrapping: false,

  // Note: themes require additional css imports containing the CodeMirror syntax css rules.
  theme: 'quantum-light',

  // Language mode requires additional assets be requested via amd-dependency.
  mode: {
    name: "python", //TODO (rnabel) find out whether still needed
  },

  // Options below require addons to be loaded via amd-dep as well.
  matchBrackets: true,
};

/**
 * Defines the shape of the directive scope.
 */
interface CodeEditorScope extends ng.IScope {
  /**
   * The source content for the editor (i.e., the displayed text)
   */
  source: string;

  /**
   * Boolean to indicate whether the this editor instance is currently active.
   *
   * A user of this component (e.g., an enclosing directive, template, controller, etc.) can
   * programmatically give focus to the editor element by setting the scope.active attribute to
   * true.
   *
   * Likewise, this also works in the reverse direction. If a user focuses the editor element,
   * the scope.active attribute becomes true and external components that are bound to this value
   * will be updated/notified.
   */
  active: boolean;

  /**
   * Getter for the mapping of key commands to callbacks.
   *
   * The set of valid keys and key/modifier combinations is dictated by CodeMirror.
   * For details, see: https://codemirror.net/doc/manual.html#keymaps
   *
   * For example:
   * keymap = {
   *   'Shift+Enter': <callback for Shift+Enter>
   *   'Tab': <callback for Tab>,
   *   // etc.
   * }
   */
  getKeymap: Function;

  /**
   * Getter for the mapping of editor region DOM events to callbacks.
   *
   * An example of a valid DOM event would be 'focus', 'mouseover', etc.
   */
  getActionHandlers: Function;

  mode: string;
  linewrap: boolean;
}

/**
 * Sets up the event handlers to link the directive scope to the external world.
 *
 * @param scope the directive's (isolate) scope
 * @param element the jqLite-selected directive element
 * @param attrs
 */
// creates event listener
function codeEditorDirectiveLink(
    scope: CodeEditorScope,
    element: ng.IAugmentedJQuery,
    attrs: any )
    : void {

  var cmContainer = element[0];

  // find correct highlighting mode, and set it
  codeMirrorOptions.mode.name = highlighting.magicDetector(scope.source, scope.mode);

  // find type
  codeMirrorOptions.lineWrapping = scope.linewrap;

  var cmInstance: CodeMirror.Editor = codeMirror(cmContainer, codeMirrorOptions);
  cmInstance.addKeyMap(scope.getKeymap());

  // Sets the inital code editor content equal to the linked template attribute value.
  // The 'code' element attribute will point to a value in the parent scope/controller.
  cmInstance.setValue(scope.source);

  // Watch the scope for new source content values and publish them into the CodeMirror instance.
  scope.$watch('source', (newValue: any, oldValue: any) => {
    // Guard against cyclical updates when editing cells.
    // i.e., cm.changed -> scope.changed -> cm.changed loops, due to watching the scope.
    if (cmInstance.getValue() != newValue) {
      // Overwrite the previous editor contents with the updated version.
      //
      // Note: this will kill any "dirty" changes that haven't been persisted,
      // but this is only a concern in multi-writer environments (unsupported currently) where multiple
      // users are editting the same cell's content. One approach to avoid needing within-cell content
      // resolution under multiple writers is to effectively lock a cell for a given user whenever said
      // user focuses the cell, disallowing any competing edits from other users. Will need UX treatment
      // to illustrate who owns a given cell (e.g., a cell level user "cursor", maybe based upon the cell
      // border color or something).
      cmInstance.setValue(newValue);
    }
  });

  // Registers a callback to update the scope's 'code' value when the CodeMirror content changes.
  cmInstance.on('change', (cm: CodeMirror.Editor, change: CodeMirror.EditorChange) => {

    if (cm.getValue() == scope.source) {
      // No need to publish an updated value to the scope (already in-sync)
      return;
    }

    // Wraps scope modifications in an $apply to "publish" them to the parent scope/ctrl
    scope.$apply(() => {
      scope.source = cm.getValue();
    });


    var cellMode : string = highlighting.magicDetector(cmInstance.getValue(), scope.mode);
    cmInstance.setOption("mode", cellMode);
    // If limiting code editor magic detection, change object's change property is not easy to use, as it
    //  does not capture the keystroke, but the text change, which results in non-trivial detection of line breaks etc.
  });

  // Register handlers for each DOM event we're interested in exposing.
  var actions: any = scope.getActionHandlers();
  // If a focus event handler was provided, register it.
  if (actions.focus) {
    cmInstance.on('focus', (cm: CodeMirror.Editor) => {
      actions.focus(cm);
      // Mark the editor as being in "active" state if a user focuses it (e.g., by clicking within
      // the editor region).
      scope.active = true;

    });
  }

  // If the editor active property becomes true, give focus to the CodeMirror editor.
  // This allows external components to programmatically focus the editor region.
  scope.$watch('active', (isActive: boolean) => {
    if (isActive) {
      cmInstance.focus();
    }
  });
}

/**
 * Creates a code editor directive.
 *
 * @return A directive definition.
 */
function codeEditorDirective(): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      source: '=',
      active: '=',
      getKeymap: '&keymap',
      getActionHandlers: '&actions',
      linewrap: '=',
      mode: '='
    },
    link: codeEditorDirectiveLink,
  }
}

_app.registrar.directive(constants.codeEditor.directiveName, codeEditorDirective);
log.debug('Registered code editor directive');
