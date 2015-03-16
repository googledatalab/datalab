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
import util = require('../common/util');


/**
 * Name for worksheets with unspecified name.
 */
export var defaultWorksheetName = 'Untitled Worksheet';

// Starter notebook default content configuration.
var defaultCodeCellContent = '';
var defaultHeadingCellLevel = 1;
var defaultHeadingCellContent = 'This is a heading';
var defaultMarkdownCellContent = 'You **can** write markdown here';

/**
 * Appends a code cell to the default worksheet within the notebook.
 */
function appendCodeCell (notebook: app.notebooks.Notebook) {
  var cell = createCodeCell(uuid.v4(), defaultCodeCellContent);
  getDefaultWorksheet(notebook).cells.push(cell);
}

/**
 * Appends a heading cell to the default worksheet within the notebook.
 */
function appendHeadingCell (notebook: app.notebooks.Notebook) {
  var cell = createHeadingCell(uuid.v4(), defaultHeadingCellContent);
  getDefaultWorksheet(notebook).cells.push(cell);
}

/**
 * Appends a markdown cell to the default worksheet within the notebook.
 */
function appendMarkdownCell (notebook: app.notebooks.Notebook) {
  var cell = createMarkdownCell(uuid.v4(), defaultMarkdownCellContent);
  getDefaultWorksheet(notebook).cells.push(cell);
}

function createCodeCell (id: string, source: string): app.notebooks.Cell {
  return {
    id: id,
    type: cells.code,
    source: source,
    metadata: {}
  };
}

function createHeadingCell (id: string, source: string): app.notebooks.Cell {
  return {
    id: id,
    type: cells.heading,
    source: source,
    metadata: {
      level: defaultHeadingCellLevel
    }
  };
}

function createMarkdownCell (id: string, source: string): app.notebooks.Cell {
  return {
    id: id,
    type: cells.markdown,
    source: source,
    metadata: {}
  };
}

/**
 * Creates a cell of the specified type with given content.
 *
 * Throws an Error if the given cell type is unsupported.
 */
export function createCell (type: string, id: string, source: string) {
  var cell: app.notebooks.Cell;
  switch (type) {
    case cells.code:
      cell = createCodeCell(id, source);
      break;

    case cells.heading:
      cell = createHeadingCell(id, source);
      break;

    case cells.markdown:
      cell = createMarkdownCell(id, source);
      break;

    default:
      throw util.createError('Cannot create cell with unsupported type "%s"', type);
  }
  return cell;
}

/**
 * Creates an empty notebook with no cells.
 */
export function createEmptyNotebook (): app.notebooks.Notebook {
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

/**
 * Creates a new notebook with an initial (non-empty) set of cells.
 *
 * The purpose of the initial set of cells is to provide the user with some fill-in-the-blank
 * bits to aid in getting started.
 *
 * Since most notebooks follow a similar initial cell pattern (title cell, summary text cell,
 * code), prepopulate a set of cells that matches this common pattern.
 */
export function createStarterNotebook (): app.notebooks.Notebook {
  var notebook = createEmptyNotebook();
  appendHeadingCell(notebook);
  appendMarkdownCell(notebook);
  appendCodeCell(notebook);
  return notebook;
}

/**
 * Gets the default worksheet from the notebook for appending cells.
 */
function getDefaultWorksheet (notebook: app.notebooks.Notebook): app.notebooks.Worksheet {
  if (notebook.worksheets.length === 0) {
    throw util.createError('Cannot return a default worksheet for a notebook with zero worksheets');
  }
  // Return the first worksheet by default.
  return notebook.worksheets[0];
}
