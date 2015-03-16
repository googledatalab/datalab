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
 * Transformation functions from .ipynb-formatted objects to datalab in-memory notebook types.
 */
/// <reference path="../../../../../../../../externs/ts/node/node-uuid.d.ts" />
import nbutil = require('../../util');
import util = require('../../../common/util');
import uuid = require('node-uuid');


/**
 * Creates an internal format code cell from the .ipynb v3 code cell.
 */
export function fromIPyCodeCell (ipyCell: app.ipy.CodeCell): app.notebooks.Cell {
  var cell = _createCell('code', ipyCell.input.join(''));
  cell.metadata = ipyCell.metadata || {};
  cell.metadata['language'] = ipyCell['language'];
  cell.outputs = [];
  cell.prompt = (ipyCell.prompt_number && ipyCell.prompt_number.toString()) || undefined;

  // Now handle the deserialization of any outputs for the code cell.
  ipyCell.outputs.forEach((ipyOutput) => {
    switch (ipyOutput.output_type) {
      case 'display_data': // Fall-through (equivalent to pyout case).
      case 'pyout':
        cell.outputs.push(fromIPyRichOutput(ipyOutput));
        break;

      case 'stream':
        cell.outputs.push(fromIPyStreamOutput(ipyOutput));
        break;

      case 'pyerr':
        cell.outputs.push(fromIPyErrorOutput(ipyOutput));
        break;

      default:
        throw util.createError('Unsupported cell output type: "%s"', ipyOutput.output_type);
    }
  });
  return cell;
}

function fromIPyErrorOutput (ipyOutput: any): app.notebooks.CellOutput {
  return util.createErrorOutput(
      ipyOutput.ename, ipyOutput.evalue, ipyOutput.traceback);
}

function fromIPyStreamOutput (ipyOutput: any): app.notebooks.CellOutput {
  return {
    type: ipyOutput.stream,
    mimetypeBundle: {
      'text/plain': ipyOutput.text.join('')
    },
    metadata: ipyOutput.metadata || {}
  }
}

function fromIPyRichOutput (ipyOutput: any): app.notebooks.CellOutput {
  var output: app.notebooks.CellOutput = {
    type: 'result',
    mimetypeBundle: {},
    metadata: ipyOutput.metadata || {}
  };

  Object.keys(ipyOutput).forEach((key) => {
    switch(key) {
      case 'html':
        output.mimetypeBundle[mimetypes.html] = ipyOutput.html.join('');
        break;

      case 'javascript':
        output.mimetypeBundle[mimetypes.javascript] = ipyOutput.javascript.join('');
        break;

      case 'jpeg':
        // The base64-encoded jpeg data is the value of the property.
        output.mimetypeBundle[mimetypes.jpeg] = ipyOutput.jpeg;
        break;

      case 'json':
        output.mimetypeBundle[mimetypes.json] = ipyOutput.json.join('');
        break;

      case 'latex':
        output.mimetypeBundle[mimetypes.latex] = ipyOutput.latex.join('');
        break;

      case 'pdf':
        output.mimetypeBundle[mimetypes.pdf] = ipyOutput.pdf;
        break;

      case 'png':
        // The base64-encoded png data is the value of the property.
        output.mimetypeBundle[mimetypes.png] = ipyOutput.png;
        break;

      case 'svg':
        output.mimetypeBundle[mimetypes.svg] = ipyOutput.svg.join('');
        break;

      case 'text':
        output.mimetypeBundle[mimetypes.text] = ipyOutput.text.join('');
        break;

      // Non-mimetype properties that can exist within the object are skipped.
      case 'metadata':
      case 'output_type':
      case 'prompt_number':
        break;

      default:
        throw util.createError('Unsupported output mimetype: "%s"', key);
    }
  });

  return output;
}

var DEFAULT_HEADING_LEVEL = 1;
/**
 * Creates an internal format heading cell from the .ipynb v3 heading cell.
 */
export function fromIPyHeadingCell (ipyCell: app.ipy.HeadingCell): app.notebooks.Cell {
  var cell = _createCell('heading', ipyCell.source.join(''));
  cell.metadata = ipyCell.metadata || {};
  cell.metadata['level'] = ipyCell.level || DEFAULT_HEADING_LEVEL;
  return cell;
}

/**
 * Creates an internal format markdown cell from the .ipynb v3 markdown cell.
 */
export function fromIPyMarkdownCell (ipyCell: app.ipy.MarkdownCell): app.notebooks.Cell {
  var cell = _createCell('markdown', ipyCell.source.join(''));
  cell.metadata = ipyCell.metadata || {};
  return cell;
}

/**
 * Creates an internal format raw cell from the .ipynb v3 raw cell.
 */
export function fromIPyRawCell (ipyCell: app.ipy.RawCell): app.notebooks.Cell {
  var cell = _createCell('raw', ipyCell.source.join(''));
  cell.metadata = ipyCell.metadata || {};
  return cell;
}

/**
 * Creates an internal format notebook from the .ipynb v3 notebook.
 */
export function fromIPyNotebook (ipyNotebook: app.ipy.Notebook): app.notebooks.Notebook {
  var notebook = nbutil.createEmptyNotebook();
  // Copy over the notebook-level metadata if it was defined,
  notebook.metadata = ipyNotebook.metadata || {};
  // Remove the sha-256 signature field if it is defined (it's no longer valid),
  delete notebook.metadata['signature'];

  // Notebooks created by IPython in v3 format will have zero or one worksheet(s)
  // because no existing IPython tools are capable of creating/reading multiple worksheets.
  //
  // As part of multi-worksheet support, we *could* export a multi-worksheet .ipynb
  // but this is unlikely since no other tools will be able to read beyond the first worksheet.
  //
  // So, assume zero or one worksheet, but throw an informative error if these expectations are
  // not met.
  if (ipyNotebook.worksheets.length === 0) {
    // We're done converting the notebook content since there are no worksheets.
    return notebook;
  } else if (ipyNotebook.worksheets.length > 1) {
    // Multiple worksheets were found (not supported).
    throw util.createError('Multi-worksheet .ipynb notebooks are not currently supported');
  }

  // We've determined that the .ipynb notebook has a single worksheet.
  var ipynbWorksheet = ipyNotebook.worksheets[0];

  // Get a reference to the first worksheet in the converted notebook.
  var worksheet = notebook.worksheets[0];
  worksheet.metadata = ipynbWorksheet.metadata || {};

  ipynbWorksheet.cells.forEach(function (ipyCell: any) {
    var cell: app.notebooks.Cell;
    switch (ipyCell.cell_type) {
      case 'code':
        cell = fromIPyCodeCell(<app.ipy.CodeCell>ipyCell);
        break;
      case 'heading':
        cell = fromIPyHeadingCell(<app.ipy.HeadingCell>ipyCell);
        break;
      case 'markdown':
        cell = fromIPyMarkdownCell(<app.ipy.MarkdownCell>ipyCell);
        break;
      case 'raw':
        cell = fromIPyRawCell(<app.ipy.RawCell>ipyCell);
        break;
      default:
        throw util.createError('Unsupported cell type "%s"', ipyCell.cell_type);
    }
    // Attach the converted cell to the worksheet.
    worksheet.cells.push(cell);
  });

  return notebook;
}

/**
 * Creates an .ipynb v3 code cell from the internal format code cell
 */
export function toIPyCodeCell (cell: app.notebooks.Cell): app.ipy.CodeCell {
  var ipyCell: app.ipy.CodeCell = {
    cell_type: 'code',
    input: stringToLineArray(cell.source),
    collapsed: false,
    // Remove 'language' from the metadata dict (promoted to cell-level attribute)
    metadata: shallowCopy(cell.metadata || {}, 'language'),
    // Attempt to set the language for the cell if defined; if not, leave undefined.
    language: (cell.metadata && cell.metadata['language']) || undefined,
    // Set the prompt number if the value is numeric; otherwise leave undefined.
    prompt_number: parseInt(cell.prompt) || undefined,
    outputs: []
  };

  cell.outputs.forEach((output) => {
    switch (output.type) {
      case 'result':
        ipyCell.outputs.push(toIPyDisplayDataOutput(output));
        break;

      case 'error':
        ipyCell.outputs.push(toIPyErrorOutput(output));
        break;

      case 'stdout':
      case 'stderr':
        ipyCell.outputs.push(toIPyStreamOutput(output));
        break;

      default:
        throw util.createError(
          'Unsupported output type for conversion to IPython cell output: "%s"', output.type);
    }
  });

  return ipyCell;
}

function toIPyDisplayDataOutput (output: app.notebooks.CellOutput): app.ipy.DisplayDataOutput {
  var ipyOutput: app.ipy.DisplayDataOutput = {
    output_type: 'display_data',
    metadata: output.metadata || {}
  };

  // For each mimetype, map it to the corresponding ipy property
  Object.keys(output.mimetypeBundle).forEach((mimetype) => {
    var data = output.mimetypeBundle[mimetype];
    switch (mimetype) {

      case mimetypes.html:
        ipyOutput.html = stringToLineArray(data);
        break;

      case mimetypes.javascript:
        ipyOutput.javascript = stringToLineArray(data);
        break;

      case mimetypes.jpeg:
        ipyOutput.jpeg = data;
        break;

      case mimetypes.json:
        ipyOutput.json = stringToLineArray(data);
        break;

      case mimetypes.latex:
        ipyOutput.latex = stringToLineArray(data);
        break;

      case mimetypes.pdf:
        ipyOutput.pdf = stringToLineArray(data);
        break;

      case mimetypes.png:
        ipyOutput.png = data;
        break;

      case mimetypes.svg:
        ipyOutput.svg = stringToLineArray(data);
        break;

      case mimetypes.text:
        ipyOutput.text = stringToLineArray(data);
        break;

      default:
        throw util.createError(
          'Unsupported mimetype for conversion to ipynb cell output "%s"', mimetype);
    }
  });

  return ipyOutput;
}

function toIPyErrorOutput (output: app.notebooks.CellOutput): app.ipy.ErrorOutput {
  // Copy over all metadata fields that are not part of the error details
  // (error details are captured as top-level field in ipy outputs)
  var metadata = shallowCopy(output.metadata || {}, 'errorDetails');
  var error = output.metadata['errorDetails'];
  return {
    output_type: 'pyerr',
    metadata: metadata,
    ename: error.errorName,
    evalue: error.errorMessage,
    traceback: error.traceback
  }
}

function toIPyStreamOutput (output: app.notebooks.CellOutput): app.ipy.StreamOutput {
  return {
    output_type: 'stream',
    stream: output.type,
    text: stringToLineArray(output.mimetypeBundle['text/plain']),
    metadata: output.metadata || {}
  }
}

/**
 * Converts a string containing newlines into an array of strings, while keeping newlines
 *
 * s = 'foo\nbar\nbaz' => ['foo\n', 'bar\n', 'baz']
 */
export function stringToLineArray (s: string): string[] {
  if (!s) {
    return [];
  }

  return s.split('\n').map((line, i, lines) => {
    // Avoid appending a newline to the last line
    if (i < lines.length - 1) {
      return line + '\n';
    } else {
      return line;
    }
  });
}

/**
 * Creates a shallow copy of the object that excludes the specified property.
 */
export function shallowCopy (o: any, excludedProperty: string): any {
  var copy: any = {};
  Object.keys(o).forEach((property) => {
    if (property != excludedProperty) {
      copy[property] = o[property];
    }
  });
  return copy;
}

/**
 * Creates an .ipynb v3 heading cell from the internal format heading cell.
 */
export function toIPyHeadingCell (cell: app.notebooks.Cell): app.ipy.HeadingCell {
  var metadata = shallowCopy(cell.metadata, 'level');
  return {
    cell_type: 'heading',
    source: stringToLineArray(cell.source),
    level: cell.metadata['level'],
    metadata: metadata
  };
}

/**
 * Creates an .ipynb v3 markdown cell from the internal format markdown cell.
 */
export function toIPyMarkdownCell (cell: app.notebooks.Cell): app.ipy.MarkdownCell {
  return {
    cell_type: 'markdown',
    source: stringToLineArray(cell.source),
    metadata: cell.metadata || {}
  }
}

/**
 * Creates an .ipynb v3 raw cell from the internal format raw cell.
 */
export function toIPyRawCell (cell: app.notebooks.Cell): app.ipy.RawCell {
  return {
    cell_type: 'raw',
    source: stringToLineArray(cell.source),
    metadata: cell.metadata || {}
  }
}

/**
 * Creates an .ipynb v3 notebook from the internal format notebook
 */
export function toIPyNotebook (notebook: app.notebooks.Notebook): app.ipy.Notebook {
  var ipyNotebook: app.ipy.Notebook = {
    nbformat: 3, // Indicates .ipynb v3 format.
    nbformat_minor: 0,
    metadata: notebook.metadata || {},
    worksheets: [{
      metadata: {},
      cells: []
    }]
  };

  // IPython Notebook only supports rendering/manipulating a single worksheet, so concatenate
  // the cells from each worksheet in worksheet order.
  var ipyWorksheet = ipyNotebook.worksheets[0];
  notebook.worksheets.forEach((worksheet) => {
    // TODO(bryantd): not aware of any worksheet-level metadata populated by IPython at the moment,
    // but will need to merge the per-worksheet metadata intelligently once multiple worksheets are
    // supported (and we actually store any worksheet metadata)
    worksheet.cells.forEach((cell) => {
      switch (cell.type) {
        case 'code':
          ipyWorksheet.cells.push(toIPyCodeCell(cell));
          break;

        case 'heading':
          ipyWorksheet.cells.push(toIPyHeadingCell(cell));
          break;

        case 'markdown':
          ipyWorksheet.cells.push(toIPyMarkdownCell(cell));
          break;

        case 'raw':
          ipyWorksheet.cells.push(toIPyRawCell(cell));
          break;

        default:
          throw util.createError(
            'Unsupported cell type cannot be transformed to .ipynb format: "%s"', cell.type);
      }
    });
  });

  return ipyNotebook;
}


function _createCell (cellType: string, source: string): app.notebooks.Cell {
  return {
    id: uuid.v4(),
    type: cellType,
    source: source,
    metadata: {}
  };
}

var mimetypes = {
  html: 'text/html',
  javascript: 'application/javascript',
  jpeg: 'image/jpeg',
  json: 'application/json',
  latex: 'application/x-latex',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  text: 'text/plain'
};
