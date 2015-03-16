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
 * Constants used to label notebook actions.
 */

// All of the action types are bucketed under this event/message label.
export var label = 'action'

// Composite action (set of primitive actions).
export var composite = 'action.composite';

// Notebook-level actions.
export var notebook = {
  clearOutputs: 'action.notebook.clearOutputs',
  executeCells: 'action.notebook.executeCells',
  rename: 'action.notebook.rename'
};

// Worksheet-level actions.
export var worksheet = {
  addCell: 'action.worksheet.addCell',
  deleteCell: 'action.worksheet.deleteCell',
  moveCell: 'action.worksheet.moveCell'
};

// Cell-level actions.
export var cell = {
  clearOutput: 'action.cell.clearOutput',
  update: 'action.cell.update',
  execute: 'action.cell.execute'
};
