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
 * Update message typedefs that define the client-server websocket protocol.
 *
 * Updates are server messages that propagate notebook model changes to clients participating
 * in a given notebook editing session.
 */
declare module app {
  module notebooks {
    module updates {

      /**
       * Common fields for all update messages.
       *
       * The update label allows for type identification at runtime (when type information has
       * been lost).
       */
      interface Update {
        name: string; // A name for the type of update message type.
      }

      /**
       * Bundle for multiple updates that should be applied in a single transaction.
       *
       * name == 'composite'
       */
      interface Composite extends Update {
        subUpdates: Update[];
      }

      /**
       * A snapshot of the notebook data.
       *
       * name == 'notebook.snapshot'
       */
      interface Snapshot extends Update {
        notebook: Notebook;
      }

      /* Notebook-level updates */

      /**
       * Update the notebook metadata to have the provided fields.
       *
       * name == 'notebook.metadata'
       */
      interface NotebookMetadata extends Update {
        path: string; // This is a notebook path.
      }

      /**
       * Update the known status of the notebook's kernel process.
       *
       * name == 'notebook.sessionStatus'
       */
      interface SessionStatus extends Update {
        kernelState: string; // State includes: 'starting' | 'idle' | 'busy'
        kernelName: string; // A string that identifies a kernel flavor; e.g., 'Python 2.7'.
      }

      /* Worksheet-level updates */

      /**
       * The given cell has been added to the specified worksheet.
       *
       * name == 'worksheet.addCell'
       */
      interface AddCell extends Update {
        worksheetId: string;
        cell: Cell;
        insertAfter: string; // The cell id to insert after.
      }

      /**
       * The given cell has been deleted from the specified worksheet.
       *
       * name == 'worksheet.deleteCell'
       */
      interface DeleteCell extends Update {
        worksheetId: string;
        cellId: string;
      }

      /**
       * The given cell has been moved between worksheets.
       *
       * Note: source and destination worksheets may be the same for the case of intra-worksheet
       * movements.
       *
       * name == 'worksheet.moveCell'
       */
      interface MoveCell extends Update {
        sourceWorksheetId: string;
        destinationWorksheetId: string;
        cellId: string;
        insertAfter: string; // The cell ID after which to insert the moved cell.
      }

      /* Cell-level updates */

      /**
       * Update the specified cell with the provided fields.
       *
       * name == 'cell.update'
       */
      interface CellUpdate extends Update {
        worksheetId: string;
        cellId: string;

        source?: string; // The new source string value for the cell.

        outputs?: CellOutput[];
        // Flag determines whether the above list of outputs is appended or replaces existing
        // output list within the cell (false => append; true => replace).
        replaceOutputs?: boolean;

        metadata?: app.Map<any>;
        // Flag to indicate whether the metadata dict should be merged with existing metadata
        // on the client or fully replace it (false => merge; true => replace).
        replaceMetadata?: boolean;
      }
    }
  }
}
