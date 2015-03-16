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


/// <reference path="../../../../../externs/ts/jasmine.d.ts"/>
import xforms = require('../app/notebooks/serializers/ipynbv3/transforms');
import cells = require('../app/shared/cells');


describe('Code cell', () => {
  var ipyCodeCell: app.ipy.CodeCell;
  var cell: app.notebooks.Cell;

  beforeEach(() => {
    cell = {
      id: 'foo',
      type: cells.code,
      metadata: {
        foo: 'bar'
      },
      source: 'some source',
      outputs: []
    }
  });

  afterEach(() => {
    ipyCodeCell = undefined;
    cell = undefined;
  });

  it('should transform to the .ipynb code cell with no outputs', () => {
    ipyCodeCell = xforms.toIPyCodeCell(cell);

    expect(ipyCodeCell.cell_type).toBe(cells.code);
    expect(ipyCodeCell.metadata).toEqual({
      foo: 'bar'
    });
    expect(ipyCodeCell.input).toEqual([
      'some source'
    ]);
    expect(ipyCodeCell.outputs).toEqual([]);
  });


  it('should transform to the .ipynb executed code cell with multi-line input', () => {
    cell.source = "import pandas as pd\nimport numpy as np";

    ipyCodeCell = xforms.toIPyCodeCell(cell);
    expect(ipyCodeCell.input).toEqual([
      "import pandas as pd\n",
      "import numpy as np"
    ]);
  });

  it('should transform to the .ipynb code cell with a single-line display_data output', () => {
    cell.outputs.push({
      type: 'result',
      mimetypeBundle: {
        'text/plain': '4'
      }
    });

    ipyCodeCell = xforms.toIPyCodeCell(cell);

    expect(ipyCodeCell.outputs.length).toBe(1);
    var output = <app.ipy.DisplayDataOutput>ipyCodeCell.outputs[0];
    expect(output.output_type).toBe('display_data');
    expect(output.text).toEqual(['4']);
  });

  it('should transform to the .ipynb code cell with a multiline display_data output', () => {
    cell.outputs = [{
      type: 'result',
      mimetypeBundle: {
        'text/plain': 'first line\nsecond line\nthird line'
      }
    }];

    ipyCodeCell = xforms.toIPyCodeCell(cell);

    expect(ipyCodeCell.outputs.length).toBe(1);
    var output = <app.ipy.DisplayDataOutput>ipyCodeCell.outputs[0];
    expect(output.output_type).toBe('display_data');
    expect(output.text).toEqual([
      'first line\n',
      'second line\n',
      'third line'
    ]);
  });

  it('should transform to the .ipynb code cell with multiple mimetypes in a single output', () => {
    cell.outputs.push({
      type: 'result',
      mimetypeBundle: {
        'text/plain': 'first line\nsecond line',
        'text/html': '<div><p>first line</p><p>second line</div>'
      }
    });

    ipyCodeCell = xforms.toIPyCodeCell(cell);

    expect(ipyCodeCell.outputs.length).toBe(1);
    var output = <app.ipy.DisplayDataOutput>ipyCodeCell.outputs[0];
    expect(output.output_type).toBe('display_data');
    expect(output.text).toEqual([
      'first line\n',
      'second line'
    ]);
    expect(output.html).toEqual([
      "<div><p>first line</p><p>second line</div>"
    ]);
  });

  it('should transform to the .ipynb code cell with stdout stream output', () => {
    cell.outputs.push({
      type: 'stdout',
      mimetypeBundle: {
        'text/plain': 'stdout line 1\nstdout line 2'
      }
    });

    ipyCodeCell = xforms.toIPyCodeCell(cell);

    expect(ipyCodeCell.outputs.length).toBe(1);
    expect(ipyCodeCell.outputs[0]).toEqual({
      "output_type": "stream",
      "stream": "stdout",
      "text": [
        "stdout line 1\n",
        "stdout line 2"
      ],
      "metadata": {}
    });
  });

  it('should transform to the .ipynb code cell with display data output', () => {
    cell.outputs.push({
      type: 'result',
      mimetypeBundle: {
        'text/plain': '<matplotlib.figure.Figure at 0x10669a310>',
        'image/png': 'png base64 encoded content here'
      }
    });

    ipyCodeCell = xforms.toIPyCodeCell(cell);

    expect(ipyCodeCell.outputs.length).toBe(1);
    expect(ipyCodeCell.outputs[0]).toEqual({
       "output_type": "display_data",
       "png": "png base64 encoded content here",
       "text": [
         "<matplotlib.figure.Figure at 0x10669a310>"
       ],
       "metadata": {}
    });
  });

  it('should transform to the .ipynb code cell with error output', () => {
    cell.outputs.push({
      type: 'error',
      mimetypeBundle: {
        'text/plain': "NameError: name 'asdf' is not defined"
        // TODO(bryantd): validate content of html traceback once the ansi color code and format
        // are translated to html with appropriate css classes.
      },
      metadata: {
        errorDetails: {
          errorName: "NameError",
          errorMessage: "name 'asdf' is not defined",
          traceback: [
            "tb line 1",
            "tb line 2"
          ]
        }
      }
    });

    ipyCodeCell = xforms.toIPyCodeCell(cell);

    expect(ipyCodeCell.outputs.length).toBe(1);
    expect(ipyCodeCell.outputs[0]).toEqual({
      "ename": "NameError",
      "evalue": "name 'asdf' is not defined",
      "output_type": "pyerr",
      "traceback": [
        "tb line 1",
        "tb line 2"
      ],
      "metadata": {}
    });
  });

});

describe('Convert text containing newlines to IPython-style line-array', () => {

  it('should return an array with a single line', () => {
    var lines = xforms.stringToLineArray('foo bar baz');
    expect(lines).toEqual(['foo bar baz']);
  });

  it('should split the text with a newline terminating each line but the last', () => {
    var lines = xforms.stringToLineArray('foo\nbar\nbaz');
    expect(lines).toEqual(['foo\n', 'bar\n', 'baz']);
  });

  it('should return an empty array', () => {
    var lines = xforms.stringToLineArray(undefined);
    expect(lines).toEqual([]);
  });

});


describe('Markdown cell', () => {

  var ipyMarkdownCell: app.ipy.MarkdownCell;
  var cell: app.notebooks.Cell;

  beforeEach(() => {
    cell = {
      id: 'foo-id',
      type: cells.markdown,
      source: '# Some markdown heading\n\nThis notebook demonstrates...',
      metadata: {}
    };
  });

  afterEach(() => {
    ipyMarkdownCell = undefined;
    cell = undefined;
  });

  it('should transform to the .ipynb Markdown cell', () => {
    ipyMarkdownCell = xforms.toIPyMarkdownCell(cell);

    expect(ipyMarkdownCell.cell_type).toBe(cells.markdown);
    expect(ipyMarkdownCell.metadata).toEqual({});
    expect(ipyMarkdownCell.source.length).toBe(3);
    expect(ipyMarkdownCell.source).toEqual([
      "# Some markdown heading\n",
      "\n",
      "This notebook demonstrates...",
    ]);
  });

});


describe('Heading cell', () => {

  var ipyHeadingCell: app.ipy.HeadingCell;
  var cell: app.notebooks.Cell;

  beforeEach(() => {
    cell = {
      id: 'foo-id',
      type: cells.heading,
      source: 'this is a heading',
      metadata: {
        level: 1
      }
    }
  });

  afterEach(() => {
    ipyHeadingCell = undefined;
    cell = undefined;
  });

  it('should transform to the .ipynb heading cell (level 1)', () => {
    ipyHeadingCell = xforms.toIPyHeadingCell(cell);

    expect(ipyHeadingCell.cell_type).toBe(cells.heading);
    expect(ipyHeadingCell.level).toBe(1);
    expect(ipyHeadingCell.metadata).toEqual({});
    expect(ipyHeadingCell.source).toEqual(['this is a heading']);
  });

  it('should transform to the .ipynb heading cell (level 2)', () => {
    cell.metadata['level'] = 2;

    ipyHeadingCell = xforms.toIPyHeadingCell(cell);

    expect(ipyHeadingCell.cell_type).toBe(cells.heading);
    expect(ipyHeadingCell.level).toBe(2);
    expect(ipyHeadingCell.metadata).toEqual({});
    expect(ipyHeadingCell.source).toEqual(['this is a heading']);
  });

});


describe('Notebook metadata', () => {
  var ipyNotebook: app.ipy.Notebook;
  var notebook: app.notebooks.Notebook;

  beforeEach(() => {
    notebook = {
      id: 'notebook-id',
      metadata: {},
      worksheets: []
    }
  });

  afterEach(() => {
    ipyNotebook = undefined;
    notebook = undefined;
  });

  it('should transform to the .ipynb notebook with one worksheet having zero cells', () => {
    notebook.worksheets.push({
      id: 'ws-id',
      name: 'Worksheet 1',
      cells: [],
      metadata: {}
    });

    ipyNotebook = xforms.toIPyNotebook(notebook);

    expect(ipyNotebook.nbformat).toBe(3);
    expect(ipyNotebook.nbformat_minor).toBe(0);
    expect(ipyNotebook.worksheets.length).toBe(1);
    var worksheet = ipyNotebook.worksheets[0];
    expect(worksheet.cells).toEqual([]);
  });

});
