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
 * Action message typedefs that define the client-server websocket protocol.
 *
 * Actions are client requests for modifications to a notebook data model.
 */
declare module app {
  module notebook {
    module action {
      /**
       * Common fields for all action messages.
       *
       * The action label allows type identification at runtime (when type information is lost).
       */
      interface Action {
        action: string; // The name/label for the action message type.
      }

      /**
       * Bundle for multiple actions that should be applied in a single transaction.
       *
       * action == 'composite'
       */
      interface Composite extends Action {
        subActions: Action[];
      }

      /* Notebook-level actions */

      /**
       * Remove the outputs for all code cells within the notebook.
       *
       * action == 'notebook.clearOutputs'
       */
      interface ClearOutputs extends Action {
        // The action label alone carries sufficient information for processing this action.
      }

      /**
       * Execute all code cells within the notebook.
       *
       * action == 'notebook.executeCells'
       */
      interface ExecuteCells extends Action {
        // Additional flags here eventually; e.g., flag for performing a "clean run" in sandbox.
      }

      /**
       * Update the notebook path to match the given path.
       *
       * action == 'notebook.rename'
       */
      interface Rename extends Action {
        path: string; // New path for the notebook.
      }

      /* Worksheet-level actions */

      /**
       * Add a cell to the specified worksheet.
       *
       * action == 'worksheet.addCell',
       */
      interface AddCell extends Action {
        // Fields for specifying the cell insertion point within the notebook.
        worksheetId: string;
        cellId: string;

        // Configuration for the cell to add.
        type: string; // Types include: 'code' | 'md' | 'heading' | 'raw' | 'etc.'
        source: string; // Cell content string (e.g., code, text, etc.).

        // Insert the new cell immediately after this cell ID.
        //
        // If the property is undefined, insert the cell at top/head of cells list.
        insertAfter?: string;
      }

      /**
       * Delete a cell from the specified worksheet.
       *
       * action == 'worksheet.deleteCell'
       */
      interface DeleteCell extends Action {
        worksheetId: string;
        cellId: string;
      }

      /**
       * Move a cell between worksheets.
       *
       * Note: both source and destination can be the same worksheet ID for intra-worksheet
       * movement.
       *
       * action == 'worksheet.moveCell',
       */
      interface MoveCell extends Action {
        sourceWorksheetId: string;
        destinationWorksheetId: string;
        cellId: string;
        insertAfter: string; // the cell ID after which to insert the moved cell
      }

      /* Cell-level actions */

      /**
       * Remove all output from the specified cell.
       *
       * action == 'cell.clearOutput'
       */
      interface ClearOutput extends Action {
        worksheetId: string;
        cellId: string;
      }

      /**
       * Update the specified cell to have the provided fields.
       *
       * action == 'cell.update'
       */
      interface UpdateCell extends Action {
        worksheetId: string;
        cellId: string;
        source?: string; // cell content string (e.g., code, markdown, etc.)
        prompt?: string;

        metadata?: app.Map<any>;
        // Flag to indicate whether the metadata dict should be merged with existing metadata
        // on the server or fully replace it (false ⇒ merge; true ⇒ replace)
        replaceMetadata?: boolean;

        outputs?: app.notebook.CellOutput[];
        // Flag determines whether the above list of outputs is appended or replaces existing
        // output list within the cell (false ⇒ append; true ⇒ replace)
        replaceOutputs?: boolean;
      }

      /**
       * Execute the specified cell.
       *
       * action == 'cell.execute'
       */
      interface ExecuteCell extends Action {
        worksheetId: string;
        cellId: string;
      }
    }
  }
}
