/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT W/ARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */


/**
 * Directive for creating a single editor cell.
 *
 * The input region provides and editable text region. The output region appears if there is any
 * output content, and disappears is the output content is falsey (undefined/null/empty).
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <amd-dependency path="app/components/celloutputviewer/CellOutputViewerDirective" />
/// <amd-dependency path="app/components/celltoolbar/CellToolbarDirective" />
/// <amd-dependency path="app/components/codeeditor/CodeEditorDirective" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.editorCell);

interface EditorCellScope extends ng.IScope {
  // Externally assignable scope attributes.
  cell: app.notebooks.Cell;
  enableEditRegion: boolean;
  enablePreviewRegion: boolean;
  getKeymap: Function;
  onPreviewRegionDoubleClick: Function;
  worksheetId: string;

  // Internally assigned scope attributes.
  actions?: app.Map<Function>;
  active?: boolean;
  keymap?: app.Map<Function>;
  notebook?: app.IClientNotebookSession;
}

class EditorCellController {

  _scope: EditorCellScope;

  static $inject = ['$scope', constants.clientNotebookSession.name];

  /**
   * Constructor.
   *
   * @param scope The directive's scope.
   * @param clientNotebookSession Client's notebook session object.
   */
  constructor(scope: EditorCellScope, clientNotebookSession: app.IClientNotebookSession) {
    this._scope = scope;

    scope.active = false;
    scope.actions = this._createActionHandlers();
    scope.keymap = scope.getKeymap();
    scope.notebook = clientNotebookSession;
  }

  /**
   * Creates the set of DOM event callbacks to register on the editor DOM element.
   *
   * @return Map of DOM event name to callback.
   */
  _createActionHandlers(): app.Map<Function> {
    return {
      // When the contained code editor element is focused, respond by activating this cell.
      'focus': this.activate.bind(this)
    }
  }

  /**
   * Makes this cell have the "active" status.
   */
  activate() {
    var that = this;
    this._scope.$evalAsync(() => {
      // The currently active cell is maintained by the session.
      //
      // Request that this cell become the currently selected cell, which will deselect any other
      // cell that is currently selected (i.e., cell selection is mutually exclusive).
      that._scope.notebook.selectCell(that._scope.cell);
    });
  }

  /**
   * Removes the "active" status from this cell.
   */
  deactivate() {
    // TODO(bryantd): Support programmatic cell deactivation.
    // Need to listen for blur event on the outer-most element of the editor cell
    // (the containing div) and use that event as the deactivate trigger.
    //
    // Then, invoke the nbdata.deactivateCell() method here.
    //
    // Note: a currently active cell becomes inactive whenever any other cell becomes active.
    // That is, like radio buttons, the "active" status is mutually exclusive among the cells in a
    // notebook, for a given client's notebook session.
  }

}

/**
 * Editor cell directive link function.
 *
 * @param scope Editor cell directive scope.
 * @param element Editor cell directive DOM element.
 * @param attrs The set of attributes populated on the directive.
 * @param controller Controller for the directive.
 */
function editorCellDirectiveLink(
    scope: EditorCellScope,
    element: ng.IAugmentedJQuery,
    attrs: ng.IAttributes,
    controller: EditorCellController
    ): void {

  // Watch the active cell (session global) for changes. If this cell becomes the currently
  // assigned active cell, then propagate this "active" status to the directive scope.
  scope.$watch(() => {
    var activeCell = scope.notebook.activeCell;
    // Avoid having the watch recursively compare all of the data within the cell by
    // returning the cell id as the watched value. If there is no active cell, any constant
    // sentinel value that is not also a valid cell id can be returned (using undefined here).
    return (activeCell && activeCell.id) || undefined;
  }, (activeCellId: any) => {
      // Check to see if the cell for this directive has become active and update the scope
      // with the current active/inactive status.
      scope.active = (activeCellId === scope.cell.id);
  });
}

/**
 * Creates an editor cell directive definition.
 *
 * @return A directive definition.
 */
function editorCellDirective(): ng.IDirective {
  return {
    restrict: 'E',
    scope: {
      cell: '=',
      getKeymap: '&keymap',
      enableEditRegion: '=',
      enablePreviewRegion: '=',
      onPreviewRegionDoubleClick: '&',
      worksheetId: '='
    },
    templateUrl: constants.scriptPaths.app + '/components/editorcell/editorcell.html',
    replace: true,
    controller: EditorCellController,
    link: editorCellDirectiveLink
  }
}

_app.registrar.directive(constants.editorCell.directiveName, editorCellDirective);
log.debug('Registered editor cell directive');
