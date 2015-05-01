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


/// <reference path="../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../shared/interfaces.d.ts" />
/// <reference path="../shared/requests.d.ts" />
// TODO(bryantd): change the namespace from 'app' to 'datalab' to avoid colliding with
// the ever present app module (app.App) (or change the app module name...)
declare module app {

  interface CellScope extends ng.IScope {
    cell: any;
    worksheetId: string;
    keymap: any;
    ctrl: ICellController;
  }

  interface ILogger {
    debug(...objects: Object []): void;
    info(...objects: Object []): void;
    warn(...objects: Object []): void;
    error(...objects: Object []): void;
  }

  interface ICellController {
    showEditRegion: boolean;
    showPreviewRegion: boolean;
    switchToEditMode(): void;
  }

  /**
   * Manages a client's view of a single notebook's data and provides an modification API.
   */
  interface IClientNotebookSession {
    /**
     * A reference to the currently active cell.
     *
     * If no cell is currently active, this attribute will have value === undefined.
     */
    activeCell: app.notebooks.Cell;

    /**
     * A reference to the currently active worksheet.
     */
    activeWorksheet: app.notebooks.Worksheet;

    /**
     * A reference to the current notebook data model.
     */
    notebook: app.notebooks.Notebook;

    /**
     * A reference to the current notebook path.
     */
    notebookPath: string;

    /**
     * Adds a cell of the given type to the worksheet.
     *
     * @param cellType The type of cell to add (e.g., 'markdown').
     * @param worksheetId The worksheet into which the cell should be inserted.
     * @param insertAfterCellId The cell id after which the cell should be inserted. A value of
     *     null indicates that the cell should be insert at the head of the worksheet.
     */
    addCell(cellType: string, worksheetId: string, insertAfterCellId: string): void;

    /**
     * Clears the output of the specified cell.
     *
     * @param cellId The id of the cell to clear.
     * @param worksheetId The id of the worksheet containing the specified cell.
     */
    clearOutput(cellId: string, worksheetId: string): void;

    /**
     * Clears all cell outputs within the notebook.
     */
    clearOutputs(): void;

    /**
     * Deletes the specified cell.
     *
     * @param cellId The id of the cell to delete.
     * @param worksheetId The id of the worksheet containing the specified cell.
     */
    deleteCell(cellId: string, worksheetId: string): void;

    /**
     * Deselects the currently active cell.
     *
     * No-op if there is no active cell.
     */
    deselectCell(): void;

    /**
     * Evaluates the specified cell source.
     *
     * In the case of all cell types, this implies updating the cell source value.
     *
     * In the case of code cells, this additionally implies kernel execution of the source.
     *
     * @param cell The cell to evaluate (update + execute).
     * @param worksheetId The id of the worksheet containing the specified cell.
     */
    evaluateCell(cell: notebooks.Cell, worksheetId: string): void;

    /**
     * Executes the specified cell source without updating.
     *
     * @param cell The cell to execute (i.e., execute-only, no source update).
     * @param worksheetId The id of the worksheet containing the specified cell.
     */
    executeCell(cell: notebooks.Cell, worksheetId: string): void;

    /**
     * Executes all code cells within the notebook.
     */
    executeCells(): void;

    /**
     * Moves the current cell either up or down in the worksheet.
     *
     * @param cellId The id of the cell to move.
     * @param worksheetId The id of the worksheet containing the specified cell.
     * @param insertAfterCellId The cell id after which the cell should be inserted. A value of
     *     null indicates that the cell should be insert at the head of the worksheet.
     */
    moveCell(cellId: string, worksheetId: string, insertAfterCellId: string): void;

    /**
     * Moves a cell down (towards tail) within the current worksheet.
     *
     * @param cellId The id of the cell to move.
     * @param worksheetId The id of the worksheet containing the specified cell.
     */
    moveCellDown(cellId: string, worksheetId: string): void;

    /**
     * Moves a cell up (towards head) within the current worksheet.
     *
     * @param cellId The id of the cell to move.
     * @param worksheetId The id of the worksheet containing the specified cell.
     */
    moveCellUp(cellId: string, worksheetId: string): void;

    /**
     * Selects the specified cell.
     */
    selectCell(cell: app.notebooks.Cell): void;

    /**
     * Selects the specified worksheet.
     */
    selectWorksheet(workhsheetId: string): void;

    /**
     * Updates the specified cell.
     *
     * @param cellId The id of the cell to update.
     * @param worksheetId The id of the worksheet containing the specified cell.
     */
    updateCell(cell: app.notebooks.Cell, worksheetId: string): void;
  }

  interface IContentService {
    list(item: string) : ng.IPromise<app.requests.ListContentResponse>;
    delete(item: string) : ng.IPromise<string>;
    update(item: string, data: string) : ng.IPromise<string>;
    move(item: string, newPath: string) : ng.IPromise<string>;
    create(item: string, data: string) : ng.IPromise<string>;
  }

  interface IRegistrar {
    controller(name: string, constructor: Function): void;
    directive(name: string, directiveFactory: Function): void;
    service(name: string, constructor: Function): void;
    factory(name: string, serviceFactory: Function): void;
    constant(name: string, value: any): void;
    value(name: string, value: any): void;
    decorator(name: string, decorator: Function): void;
    filter(name: string, filterFactory: Function): void;
  }

  interface ISessionConnection {
    on(messageType: string, callback: SessionMessageHandler): void;
    emit(messageType: string, message: any): void;
  }

  interface ISessionEventDispatcher {}

  interface SessionMessageHandler {
    (message: any): void;
  }

  interface ISessionService {
    create(item: string) : ng.IPromise<string>;
    list() : ng.IPromise<app.requests.ListSessionsResponse>;
    reset(item: string) : ng.IPromise<string>;
    shutdown(item: string) : ng.IPromise<string>;
  }

  // UI-specific extensions to the datalab notebook types.
  module notebooks {
    interface AugmentedCellOutput extends notebooks.CellOutput {
      preferredMimetype?: string;
      trustedHtml?: string;
    }
  }

}
