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


import actions = require('../shared/actions');
import cells = require('../shared/cells');
import nbdata = require('../shared/notebookdata');
import nbutil = require('./util');
import updates = require('../shared/updates');
import util = require('../common/util');


/**
 * Wraps raw notebook data and provides an API for applying Actions to the notebook.
 */
export class NotebookSession implements app.INotebookSession {

  _notebook: app.notebooks.Notebook;

  constructor (notebook: app.notebooks.Notebook) {
    this._notebook = notebook;
  }

  /**
   * Applies the given action to the notebook and returns and notebook model updates generated.
   */
  apply (action: app.notebooks.actions.Action): app.notebooks.updates.Update {
    // Delegate to the appropriate action handler based upon the action type.
    switch (action.name) {
      case actions.cell.clearOutput:
        return this._applyClearOutput(<app.notebooks.actions.ClearOutput>action);

      case actions.cell.update:
        return this._applyUpdateCell(<app.notebooks.actions.UpdateCell>action);

      case actions.notebook.clearOutputs:
        return this._applyClearOutputs(<app.notebooks.actions.ClearOutputs>action);

      case actions.worksheet.addCell:
        return this._applyAddCell(<app.notebooks.actions.AddCell>action);

      case actions.worksheet.deleteCell:
        return this._applyDeleteCell(<app.notebooks.actions.DeleteCell>action);

      case actions.worksheet.moveCell:
        return this._applyMoveCell(<app.notebooks.actions.MoveCell>action);

      default:
        throw util.createError('Unsupported action "%s" cannot be applied', action.name);
    }
  }

  /**
   * Gets a data-only notebook object suitable for JSON serialization.
   *
   * Specifically, gets a reference to (not copy of!) the underlying notebook data managed by
   * this instance.
   *
   * Note that the caller should consider the notebook data returned as read-only (cannot
   * programmatically enforce this at compile- or run-time unfortunately). Current use cases
   * are getting the data for serialization to the persistence layer and for transmission as a
   * snapshot to clients. Making deep copies of notebook data can be prohibitively expensive
   * when large amounts of data or high-resolution graphics are embedded, so opting to return
   * a reference for now since all current use cases are read-only.
   */
  getNotebookData (): app.notebooks.Notebook {
    return this._notebook;
  }

  /**
   * Gets a reference to the specified cell.
   *
   * The caller should consider the returned cell to be read-only.
   *
   * Throws an error if the specified cell does not exist in the given worksheet.
   */
  getCellOrThrow (cellId: string, worksheetId: string) {
    return nbdata.getCellOrThrow(cellId, worksheetId, this._notebook);
  }

  /**
   * Applies the AddCell action to the current notebook model.
   */
  _applyAddCell (action: app.notebooks.actions.AddCell): app.notebooks.updates.AddCell {
    // Get the worksheet where the cell should be added
    var worksheet = nbdata.getWorksheetOrThrow(action.worksheetId, this._notebook);
    // Create a cell to insert
    var cell = nbutil.createCell(action.type, action.cellId, action.source);

    // If an insertion point was defined, verify the given cell id exists within the worksheet
    var insertIndex: number;
    if (action.insertAfter) {
      // Find the cell to insert after in the worksheet
      insertIndex = nbdata.getCellIndexOrThrow(action.insertAfter, worksheet);
      // Increment the index because we want to insert after the "insertAfter" cell id
      ++insertIndex;
    } else {
      // Prepend the cell to the beginning of the worksheet
      insertIndex = 0;
    }
    // Insert the cell at the insert index;
    worksheet.cells.splice(insertIndex, 0, cell);

    // Create and return the update message
    return {
      name: updates.worksheet.addCell,
      worksheetId: worksheet.id,
      cell: cell,
      insertAfter: action.insertAfter
    }
  }

  /**
   * Applies the ClearOutput action (single cell) to the current notebook model.
   */
  _applyClearOutput (action: app.notebooks.actions.ClearOutput): app.notebooks.updates.CellUpdate {
    return this._clearCellOutput(action.cellId, action.worksheetId);
  }

  /**
   * Applies the ClearOutputs action (all cells) to the current notebook model.
   */
  _applyClearOutputs (action: app.notebooks.actions.ClearOutputs): app.notebooks.updates.Composite {
    // Create a composite update message in which the per-cell updates will be bundled.
    var update: app.notebooks.updates.Composite = {
      name: updates.composite,
      subUpdates: []
    }

    // Iterate through each worksheet within the notebook.
    this._notebook.worksheets.forEach((worksheet) => {
      // Clear each cell within the worksheet.
      worksheet.cells.forEach((cell: app.notebooks.Cell) => {
        if (cell.type == cells.code) {
          var cellUpdate = this._clearCellOutput(cell.id, worksheet.id);
          // Add an update for the cleared cell.
          update.subUpdates.push(cellUpdate);
        }
      }, this);
    }, this);

    return update;
  }

  /**
   * Applies the DeleteCell action to the current notebook model.
   */
  _applyDeleteCell (action: app.notebooks.actions.DeleteCell): app.notebooks.updates.DeleteCell {
    // Get the worksheet from which the cell should be deleted.
    var worksheet = nbdata.getWorksheetOrThrow(action.worksheetId, this._notebook);
    // Find the index of the cell to delete within the worksheet.
    var cellIndex = nbdata.getCellIndexOrThrow(action.cellId, worksheet);
    // Remove the cell from the worksheet.
    var removed = worksheet.cells.splice(cellIndex, 1);
    // Create and return the update message.
    return {
      name: updates.worksheet.deleteCell,
      worksheetId: action.worksheetId,
      cellId: action.cellId
    };
  }

  /**
   * Applies the MoveCell action to the current notebook model.
   */
  _applyMoveCell (action: app.notebooks.actions.MoveCell): app.notebooks.updates.MoveCell {
    // Find the cell to move within the source worksheet.
    var sourceWorksheet = nbdata.getWorksheetOrThrow(action.sourceWorksheetId, this._notebook);
    var sourceIndex = nbdata.getCellIndexOrThrow(action.cellId, sourceWorksheet);

    var destinationWorksheet = nbdata.getWorksheetOrThrow(action.sourceWorksheetId, this._notebook);

    // Remove the cell from the worksheet.
    var cellToMove = sourceWorksheet.cells.splice(sourceIndex, 1)[0];

    // Find the insertion point for the cell in the destination worksheet.
    if (action.insertAfter === null) {
      // Then prepend the cell to the destination worksheet.
      destinationWorksheet.cells = [cellToMove].concat(destinationWorksheet.cells);
    } else {
      // Otherwise insert the cell after the specified insertAfter cell id.
      var destinationIndex = nbdata.getCellIndexOrThrow(action.insertAfter, sourceWorksheet);
      // The insertion index is one after the "insertAfter" cell's index.
      ++destinationIndex;
      // Insert the cell into the destination index.
      destinationWorksheet.cells.splice(destinationIndex, 0, cellToMove);
    }

    // Note: the update message carries the same data as the action message, because all clients
    // need to apply the same cell movement modifications locally.
    return {
      name: updates.worksheet.moveCell,
      sourceWorksheetId: action.sourceWorksheetId,
      destinationWorksheetId: action.destinationWorksheetId,
      cellId: action.cellId,
      insertAfter: action.insertAfter // the cell ID after which to insert the moved cell
    }
  }

  /**
   * Applies the UpdateCell action to the current notebook model.
   */
  _applyUpdateCell (action: app.notebooks.actions.UpdateCell): app.notebooks.updates.CellUpdate {
    // Get the cell where the update should be applied.
    var cell = nbdata.getCellOrThrow(action.cellId, action.worksheetId, this._notebook);

    // Create the base cell update and add to it as modifications are made to the notebook model.
    var cellUpdate: app.notebooks.updates.CellUpdate = {
      name: updates.cell.update,
      worksheetId: action.worksheetId,
      cellId: action.cellId,
    };

    // Enumerate the attributes that should be updated on the cell and apply the modifications.
    if (action.source || action.source === '') {
      // Then update the cell source attribute and the update message.
      cell.source = cellUpdate.source = action.source;
    }

    if (action.outputs) {
      if (action.replaceOutputs) {
        // Simple case, replace the cell's outputs with the output list in the action message.
        cell.outputs = cellUpdate.outputs = action.outputs;
      } else {
        // Append the outputs in the action message to the cell's outputs.
        cell.outputs = cell.outputs.concat(action.outputs);
        // The update message will only carry the outputs to be appended.
        cellUpdate.outputs = action.outputs;
      }
      cellUpdate.replaceOutputs = action.replaceOutputs;
    }

    if (action.metadata) {
      if (action.replaceMetadata) {
        // Simple case, use the action message's metadata to replace the cell's.
        cell.metadata = cellUpdate.metadata = action.metadata;
      } else {
        // Merge the metadata objects, with the action overwriting existing fields on the cell.
        cellUpdate.metadata = {};
        Object.keys(action.metadata).forEach((property) => {
          cell.metadata[property] = cellUpdate.metadata[property] = action.metadata[property];
        });
      }
      cellUpdate.replaceMetadata = action.replaceMetadata;
    }

    return cellUpdate;
  }

  /**
   * Clears the outputs of a single specified cell and returns an update message.
   */
  _clearCellOutput (cellId: string, worksheetId: string): app.notebooks.updates.CellUpdate {
    // Get the cell where the outputs should be cleared
    var cell = nbdata.getCellOrThrow(cellId, worksheetId, this._notebook);
    // Clear the outputs
    cell.outputs = [];
    // Create and return the update message
    return {
      name: updates.cell.update,
      worksheetId: worksheetId,
      cellId: cellId,
      outputs: cell.outputs,
      replaceOutputs: true
    };
  }

}
