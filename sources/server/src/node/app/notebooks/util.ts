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
 * Common utility functions and constants for working with notebook data.
 */
/// <reference path="../../../../../../externs/ts/node/node-uuid.d.ts" />
import uuid = require('node-uuid');
import cells = require('../shared/cells');


/**
 * Name for worksheets with unspecified name.
 */
export var defaultWorksheetName = 'Untitled Worksheet';

/**
 * Creates an empty notebook with no cells.
 */
export function createEmptyNotebook (): app.notebook.Notebook {
  return {
    id: uuid.v4(),
    metadata: {},
    worksheets: [{
      id: uuid.v4(),
      name: defaultWorksheetName,
      metadata: {},
      cells: []
    }]
  };
}
