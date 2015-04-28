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
 * Directive controller for document-based cells (markdown and heading).
 */
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <amd-dependency path="app/components/sessions/ClientNotebookSession" />
/// <reference path="../../common/Interfaces.ts" />
import constants = require('app/common/Constants');


export class DocumentCellController implements app.ICellController {

  _clientNotebookSession: app.IClientNotebookSession;
  _rootScope: ng.IRootScopeService;
  _scope: app.CellScope;

  showEditRegion: boolean;
  showPreviewRegion: boolean;

  static $inject: string[] = ['$scope', '$rootScope', constants.clientNotebookSession.name];

  /**
   * Constructor.
   *
   * @param scope The directive scope.
   * @param rootScope The root scope for the page.
   * @param clientNotebookSession The client's notebook session.
   */
  constructor(
      scope: app.CellScope,
      rootScope: ng.IRootScopeService,
      clientNotebookSession: app.IClientNotebookSession) {

    this._clientNotebookSession = clientNotebookSession;
    this._rootScope = rootScope;
    this._scope = scope;

    scope.keymap = this._createKeymap();
    scope.ctrl = this;

    // Show the rendered preview of the heading cell by default.
    this.showPreviewRegion = true;
    // Hide the edit region until the cell is put in edit mode.
    this.showEditRegion = false;
  }

  /**
   * Switches the cell to edit mode.
   */
  switchToEditMode() {
    var that = this;
    this._rootScope.$evalAsync(() => {
      that.showEditRegion = true;
      that.showPreviewRegion = false;
    });
  }

  /**
   * Switches the cell to view-only mode (no editor shown).
   */
  switchToViewMode() {
    var that = this;
    this._rootScope.$evalAsync(() => {
      that.showEditRegion = false;
      that.showPreviewRegion = true;
    });
  }

  /**
   * Creates a map of key stroke to callback for handling key stroke events on the code editor.
   */
  _createKeymap(): app.Map<Function> {
    return {
      'Shift-Enter': this._handleFinishedEditing.bind(this)
    }
  }

  /**
   * Switches the cell to view mode and issues an update for the modified cell content.
   */
  _handleFinishedEditing() {
    this._clientNotebookSession.updateCell(this._scope.cell, this._scope.worksheetId);
    this.switchToViewMode();
  }
}
