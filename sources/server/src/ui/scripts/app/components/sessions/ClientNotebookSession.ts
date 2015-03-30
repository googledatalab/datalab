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


/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
import actions = require('app/shared/actions');
import cells = require('app/shared/cells');
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import updates = require('app/shared/updates');
import nbdata = require('app/shared/notebookdata');
import uuid = require('app/common/uuid');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.clientNotebookSession);

/**
 * An instance of this class manages a single notebook's data, client-side. Handles updating the
 * notebook data model whenever update events are published from the notebook server.
 *
 * It should be considered a read-only view of the authoritative notebook data stored on the
 * server. Any local modifications to the notebook model should be predictive of eminent updates
 * that will be published from the server and should never corrupt the notebook state such that
 * a notebook data update cannot cause the client-side and server-side notebook data models
 * to diverge.
 *
 * For example, if the user inserts a new cell within a notebook worksheet, a "new cell action"
 * is sent to the server, and a corresponding update broadcast to all clients. The client that
 * performed the cell insert action should ideally see the new cell appear immediately (responsive)
 * but appending the cell locally, rather than waiting for the server to broadcast the update, has
 * the danger of causing local and server states to diverge. Thus, any local modifications to the
 * notebook model for responsiveness purposes need to be handled with great caution.
 */
class ClientNotebookSession implements app.IClientNotebookSession {

  activeCell: app.notebooks.Cell;
  activeWorksheet: app.notebooks.Worksheet;
  notebook: app.notebooks.Notebook;

  _rootScope: ng.IRootScopeService;
  _sce: ng.ISCEService;

  static $inject = ['$rootScope', '$sce'];

  /**
   * Constructor.
   *
   * @param rootScope Angular's $rootScope service.
   * @param sce Angular's $sce (strict contextual escaping) service.
   */
  constructor(rootScope: ng.IRootScopeService, sce: ng.ISCEService) {
    this._rootScope = rootScope;
    this._sce = sce;

    this._registerEventHandlers();
  }

  /**
   * Sets the given cell to be active.
   *
   * There can only be a single active cell within a notebook at any time; equivalent to the
   * notion of DOM element focus.
   *
   * @param cell The cell to select.
   */
  selectCell(cell: app.notebooks.Cell) {
    this.activeCell = cell;
  }


  // TODO(bryantd): decide if we want a local "predictive modification" for the various insert functions
  // to make the UI more responsive given the latency in getting back a server response for any of the
  // notebook modification operations (e.g., add/delete/move cell).

  /**
   * Adds a cell of the given type to the worksheet.
   *
   * @param cellType The type of cell to add (e.g., 'markdown').
   * @param worksheetId The worksheet into which the cell should be inserted.
   * @param insertAfterCellId The cell id after which the cell should be inserted. A value of null
   *     indicates that the cell should be insert at the head of the worksheet.
   */
  addCell(cellType: string, worksheetId: string, insertAfterCellId: string) {
    // Create a placeholder source string for document cells.
    var source: string;
    switch (cellType) {
      case cells.markdown:
        source = placeholderMarkdownCellSource;
        break;

      case cells.heading:
        source = placeholderHeadingCellSource;
        break;

      default:
        source = ''
    }

    var addCellAction: app.notebooks.actions.AddCell = {
      name: actions.worksheet.addCell,
      worksheetId: worksheetId,
      cellId: uuid.v4(),
      type: cellType,
      source: source,
      insertAfter: insertAfterCellId
    };
    this._emitAction(addCellAction)
  }

  /**
   * Clears the output of the specified cell.
   *
   * @param cellId The id of the cell to clear.
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  clearOutput(cellId: string, worksheetId: string) {
    var clearOutputAction: app.notebooks.actions.ClearOutput = {
      name: actions.cell.clearOutput,
      worksheetId: worksheetId,
      cellId: cellId
    };
    this._emitAction(clearOutputAction);
  }

  /**
   * Clears all cell outputs within the notebook.
   */
  clearOutputs() {
    var clearOutputsAction: app.notebooks.actions.ClearOutputs = {
      name: actions.notebook.clearOutputs
    };
    this._emitAction(clearOutputsAction);
  }

  /**
   * Deletes the specified cell.
   *
   * @param cellId The id of the cell to delete.
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  deleteCell(cellId: string, worksheetId: string) {
    var deleteCellAction: app.notebooks.actions.DeleteCell = {
      name: actions.worksheet.deleteCell,
      cellId: cellId,
      worksheetId: worksheetId
    }
    this._emitAction(deleteCellAction);
  }

  /**
   * Deselects the currently active cell.
   *
   * No-op if there is no active cell.
   */
  deselectCell() {
    this.activeCell = undefined;
  }

  /**
   * Evaluates the specified cell source.
   *
   * Emits a composite action with both update+execute
   *
   * In the case of non-code cells, only an update action will be emitted
   *
   * @param cell The cell to evaluate (i.e., source update + execute).
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  evaluateCell(cell: app.notebooks.Cell, worksheetId: string) {
    if (cell.type != cells.code) {
      // Then we can simply send an update cell action
      this.updateCell(cell, worksheetId);
      return;
    }

    var compositeAction: app.notebooks.actions.Composite = {
      name: actions.composite,
      subActions: [
        this._createUpdateCellAction(cell, worksheetId),
        this._createExecuteCellAction(cell.id, worksheetId)
      ]
    }
    this._emitAction(compositeAction);
  }

  /**
   * Executes the specified cell source without updating.
   *
   * @param cell The cell to execute (i.e., execute-only, no source update).
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  executeCell(cell: app.notebooks.Cell, worksheetId: string) {
    if (cell.type != cells.code) {
      // Then this is a no-op. Nothing to execute for non-code cells currently.
      return;
    }
    // Emit an execute action without a corresponding source update.
    this._emitAction(this._createExecuteCellAction(cell.id, worksheetId));
  }

  /**
   * Executes all code cells within the notebook.
   */
  executeCells() {
    var executeCellsAction: app.notebooks.actions.ExecuteCells = {
      name: actions.notebook.executeCells
    };
    this._emitAction(executeCellsAction);
  }

  /**
   * Moves the current cell either up or down in the worksheet.
   *
   * @param cellId The id of the cell to move.
   * @param worksheetId The id of the worksheet containing the specified cell.
   * @param insertAfterCellId The cell id after which the cell should be inserted. A value of
   *     null indicates that the cell should be insert at the head of the worksheet.
   */
  moveCell(cellId: string, worksheetId: string, insertAfterCellId: string) {
    var moveCellAction: app.notebooks.actions.MoveCell = {
      name: actions.worksheet.moveCell,
      cellId: cellId,
      sourceWorksheetId: worksheetId,
      destinationWorksheetId: worksheetId,
      insertAfter: insertAfterCellId
    };
    this._emitAction(moveCellAction);
  }

  /**
   * Moves a cell down (towards tail) within the current worksheet.
   *
   * @param cellId The id of the cell to move.
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  moveCellDown(cellId: string, worksheetId: string) {
    var worksheet = nbdata.getWorksheetOrThrow(worksheetId, this.notebook);
    var cellIndexToMove = nbdata.getCellIndexOrThrow(cellId, worksheet);

    if (cellIndexToMove == (worksheet.cells.length - 1)) {
      // Then this the cell to move is already last, so no-op
      return;
    }

    // Insert the current cell after the next cell
    var insertAfterCell = worksheet.cells[cellIndexToMove + 1];
    this.moveCell(cellId, worksheetId, insertAfterCell.id);
  }

  /**
   * Moves a cell up (towards head) within the current worksheet.
   *
   * @param cellId The id of the cell to move.
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  moveCellUp(cellId: string, worksheetId: string) {
    var worksheet = nbdata.getWorksheetOrThrow(worksheetId, this.notebook);
    var cellIndexToMove = nbdata.getCellIndexOrThrow(cellId, worksheet);

    switch (cellIndexToMove) {
      case 0:
        // Cannot move cell up, already at top of worksheet (no-op)
        return;
      case 1:
        // Move the cell to the top of the worksheet.
        // Because there is not currently an insertBefore option for the move cell action
        // a insertAfter value of null is used to indicate inserting at the head of the worksheet
        this.moveCell(cellId, worksheetId, null);
      break;
      default:
        // Given worksheet cell ids [A, B, C, D], if we want to move C "up" (towards beginning of
        // worksheet), we want to insert cell C after cell A, which is two before cell C
        var insertAfterCell = worksheet.cells[cellIndexToMove - 2];
        this.moveCell(cellId, worksheetId, insertAfterCell.id);
    }
  }

  /**
   * Selects the specified cell.
   *
   * @param worksheetId The id of the worksheet to select.
   */
  selectWorksheet(worksheetId: string) {
    var worksheet = nbdata.getWorksheetOrThrow(worksheetId, this.notebook);
    this.activeWorksheet = worksheet;
  }

  /**
   * Updates the specified cell.
   *
   * @param cellId The id of the cell to update.
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  updateCell(cell: app.notebooks.Cell, worksheetId: string) {
    this._emitAction(this._createUpdateCellAction(cell, worksheetId));
  }

  /**
   * Creates an Action message for executing a cell.
   *
   * @param cellId The id of the cell to execute.
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  _createExecuteCellAction(
      cellId: string,
      worksheetId: string
      ): app.notebooks.actions.ExecuteCell {

    return {
      name: actions.cell.execute,
      worksheetId: worksheetId,
      cellId: cellId
    }
  }

  /**
   * Creates an Action message for updating a cell.
   *
   * The action message constructed will synchronize the authoritative cell model with this
   * client's cell attributes. The update will also remove derived attributes such as cell outputs.
   *
   * @param cellId The id of the cell to update.
   * @param worksheetId The id of the worksheet containing the specified cell.
   */
  _createUpdateCellAction(
      cell: app.notebooks.Cell,
      worksheetId: string
      ): app.notebooks.actions.UpdateCell {

    return {
      name: actions.cell.update,
      worksheetId: worksheetId,
      cellId: cell.id,
      source: cell.source,
      outputs: [],
      replaceOutputs: true,
      metadata: cell.metadata,
      replaceMetadata: true
    }
  }

  /**
   * Emits an Action to the client-side event system.
   *
   * @param action The Action message to emit as an event.
   */
  _emitAction(action: app.notebooks.actions.Action) {
    this._rootScope.$emit(action.name, action);
  }

  /**
   * Finds the preferred mimetype from the options available in a given mimetype bundle.
   *
   * The preferred mimetype for displaying a given output is modeled on IPython's preference list.
   *
   * @param mimetypeBundle A map of mime-type string (e.g., 'text/html') to a content string.
   * @return Null if none of the preferred mimetypes are available within the bundle.
   */
  _findPreferredMimetype(mimetypeBundle: app.Map<string>) {
    for (var i = 0; i < preferredMimetypes.length; ++i) {
      var mimetype = preferredMimetypes[i];
      if (mimetypeBundle.hasOwnProperty(mimetype)) {
        return mimetype;
      }
    }
    return null;
  }

  /**
   * Adds a cell to the notebook.
   *
   * @param update An AddCell Update message containing the cell and where it should be inserted.
   */
  _handleAddCell(update: app.notebooks.updates.AddCell) {
    var worksheet = nbdata.getWorksheetOrThrow(update.worksheetId, this.notebook);
    // If an insertion point was defined, verify the given cell id exists within the worksheet
    var insertIndex: number;
    if (update.insertAfter) {
      // Find the cell to insert after in the worksheet
      insertIndex = nbdata.getCellIndexOrThrow(update.insertAfter, worksheet);
      // Increment the index because we want to insert after the "insertAfter" cell id
      ++insertIndex;
    } else {
      // Prepend the cell to the beginning of the worksheet
      insertIndex = 0;
    }
    // Insert the cell at the insert index;
    worksheet.cells.splice(insertIndex, 0, update.cell);
  }

  /**
   * Updates the cell specified in the message.
   *
   * @param update A CellUpdate Update message.
   */
  _handleCellUpdate(update: app.notebooks.updates.CellUpdate) {
    var cell = nbdata.getCellOrThrow(update.cellId, update.worksheetId, this.notebook);

    // Update the source content if it was provided in the update.
    if (update.source || update.source === '') {
      cell.source = update.source;
    }

    // Add any outputs provided in the update.
    if (update.outputs) {
      // Select mimetypes and mark html content as trusted.
      update.outputs.forEach(this._selectMimetype.bind(this));

      if (update.replaceOutputs) {
        // Replace the outputs with the list provided in the update.
        cell.outputs = update.outputs;
      } else {
        // Append the update's outputs to the current cell's outputs.
        cell.outputs = cell.outputs.concat(update.outputs);
      }
    }

    // Update the cell metadata.
    if (update.metadata) {
      if (update.replaceMetadata) {
        // Fully replace the cell metadata with the value in the update.
        cell.metadata = update.metadata;
      } else {
        // Merge the update metadata properties with the cell's current metadata.
        //
        // If both the current cell and the update have a given metadata property,
        // the update's value will overwrite the current cell's value.
        Object.keys(update.metadata).forEach((property) => {
          cell.metadata[property] = update.metadata[property];
        });
      }
    }
  }

  /**
   * Handles a Composite Update message by handling each sub-message in the composite.
   *
   * @param update A Composite Update message.
   */
  _handleCompositeUpdate(update: app.notebooks.updates.Composite) {
    update.subUpdates.forEach((update) => {
      switch (update.name) {
        case updates.cell.update:
          this._handleCellUpdate(<app.notebooks.updates.CellUpdate>update);
        break;

        default:
          throw new Error('Composite update containing type "'+update.name+'" is not supported');
      }
    });
  }

  /**
   * Deletes the cell specified by the Update message.
   *
   * @param update A DeleteCell Update message.
   */
  _handleDeleteCell(update: app.notebooks.updates.DeleteCell) {
    // Get the worksheet from which the cell should be deleted.
    var worksheet = nbdata.getWorksheetOrThrow(update.worksheetId, this.notebook);
    // Find the index of the cell to delete within the worksheet.
    var cellIndex = nbdata.getCellIndexOrThrow(update.cellId, worksheet);
    // Remove the cell from the worksheet.
    var removed = worksheet.cells.splice(cellIndex, 1);
    log.debug('Deleted cell from worksheet', removed);
  }

  /**
   * Moves the cell specified by the Update message.
   *
   * @param update A MoveCell Update message.
   */
  _handleMoveCell(update: app.notebooks.updates.MoveCell) {
    // Find the cell to move within the source worksheet.
    var sourceWorksheet = nbdata.getWorksheetOrThrow(update.sourceWorksheetId, this.notebook);
    var sourceIndex = nbdata.getCellIndexOrThrow(update.cellId, sourceWorksheet);

    // Find the insertion point for the cell in the destination worksheet.
    var destinationWorksheet = nbdata.getWorksheetOrThrow(update.sourceWorksheetId, this.notebook);

    // Remove the cell from the worksheet.
    var cellToMove = sourceWorksheet.cells.splice(sourceIndex, 1)[0];

    if (update.insertAfter === null) {
      // Then prepend the cell to the destination worksheet.
      destinationWorksheet.cells = [cellToMove].concat(destinationWorksheet.cells);
    } else {
      // Otherwise insert the cell after the specified insertAfter cell id.
      var destinationIndex = nbdata.getCellIndexOrThrow(update.insertAfter, sourceWorksheet);
      // The insertion index is one after the "insertAfter" cell's index.
      ++destinationIndex;
      // Insert the cell into the destination index.
      destinationWorksheet.cells.splice(destinationIndex, 0, cellToMove);
    }
  }

  /**
   * Register all callbacks for handling notebook update events.
   */
  _registerEventHandlers() {
    this._registerEventHandler(updates.cell.update, this._handleCellUpdate.bind(this));
    this._registerEventHandler(updates.composite, this._handleCompositeUpdate.bind(this));
    this._registerEventHandler(updates.notebook.snapshot, this._setNotebook.bind(this));
    this._registerEventHandler(updates.worksheet.addCell, this._handleAddCell.bind(this));
    this._registerEventHandler(updates.worksheet.deleteCell, this._handleDeleteCell.bind(this));
    this._registerEventHandler(updates.worksheet.moveCell, this._handleMoveCell.bind(this));
  }

  /**
   * Registers a single callback to process a specified event and issue async scope digest after.
   */
  _registerEventHandler(eventName: string, callback: Function) {
    var rootScope = this._rootScope;
    rootScope.$on(eventName, (event: any, message: any) => {
      rootScope.$evalAsync(() => { callback(message) });
    });
  }

  /**
   * Selects a mimetype for the cell output from available options provided by the mimetype bundle.
   */
  _selectMimetype(output: app.notebooks.AugmentedCellOutput) {
    var bundle = output.mimetypeBundle;
    if (!bundle) {
      log.warn('Received an output with no mimetype bundle: ', output);
      return;
    }
    output.preferredMimetype = this._findPreferredMimetype(bundle);

    // Bail if there isn't a preferred mimetype within the bundle.
    if (!output.preferredMimetype) {
      log.warn('Unable to select a mimetype for cell output: ', output);
      return;
    }

    // Create a trusted html wrapper for the html content so that it is display-able.
    if (output.preferredMimetype == 'text/html') {
      output.trustedHtml = this._sce.trustAsHtml(bundle['text/html']);
    }
  }

  /**
   * Overwrites the notebook state with the given notebook snapshot.
   *
   * Also sets the first worksheet to be active.
   */
  _setNotebook(snapshot: app.notebooks.updates.Snapshot) {
    log.debug('setting notebook to snapshot value');

    // Snapshots are used to fully init/overwrite the client-side notebook state.
    this.notebook = snapshot.notebook;

    // Makes the first worksheet active, if it exists.
    if (this.notebook.worksheets.length > 0) {
      this.selectWorksheet(this.notebook.worksheets[0].id);
    } else {
      log.error('Notebook snapshot update contains zero worksheets! snapshot:', snapshot);
    }
  }
}

// Newly added document cells will have the following placeholder text upon creation.
var placeholderMarkdownCellSource = 'Markdown cell';
var placeholderHeadingCellSource = 'Heading cell';

// Mimetype preference order used by IPython.
var preferredMimetypes = [
  'application/javascript',
  'text/html',
  'text/markdown',
  'text/latex',
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain'];

_app.registrar.service(constants.clientNotebookSession.name, ClientNotebookSession);
log.debug('Registered', constants.clientNotebookSession.name);
