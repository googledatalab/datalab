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
 * Constants used to label notebook updates types.
 */

// All update event/message types are bucketed under this label.
export var label = 'update'

// Composite update (sequence of updates).
export var composite = 'update.composite';

// Notebook-level updates.
export var notebook = {
  snapshot: 'update.notebook.snapshot',
  metadata: 'update.notebook.metadata',
  sessionStatus: 'update.notebook.sessionStatus'
};

// Worksheet-level updates.
export var worksheet = {
  addCell: 'action.worksheet.addCell',
  deleteCell: 'action.worksheet.deleteCell',
  moveCell: 'action.worksheet.moveCell'
}

// Cell-level updates.
export var cell = {
  update: 'action.cell.update'
}
