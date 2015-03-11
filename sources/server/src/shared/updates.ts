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
export var composite = label + '.composite';

// Notebook-level updates.
var notebookPrefix = label + '.notebook.';
export var notebook = {
  snapshot: notebookPrefix + 'snapshot',
  metadata: notebookPrefix + 'metadata',
  sessionStatus: notebookPrefix + 'sessionStatus'
};

// Worksheet-level updates.
var worksheetPrefix = label + '.worksheet.';
export var worksheet = {
  addCell: worksheetPrefix + 'addCell',
  deleteCell: worksheetPrefix + 'deleteCell',
  moveCell: worksheetPrefix + 'moveCell'
}

// Cell-level updates.
var cellPrefix = label + '.cell.';
export var cell = {
  update: cellPrefix + 'update'
}
