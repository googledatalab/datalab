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


describe('IPython .ipynb v3 format serialization of code cells', () => {
  var ipyCodeCell: app.ipy.CodeCell;
  var cell: app.notebook.Cell;

  beforeEach(() => {
    ipyCodeCell = {
      "cell_type": "code",
      "collapsed": false,
      "input": [
       "some input"
      ],
      "language": "python",
      "metadata": {},
      "outputs": [],
      "prompt_number": 7
    };
  });

  afterEach(() => {
    ipyCodeCell = undefined;
    cell = undefined;
  });

  it('should transform from the .ipynb code cell with no outputs', () => {
    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.type).toBe(cells.code);
    expect(cell.source).toBe('some input');
    expect(cell.prompt).toBe('7');
    expect(cell.metadata).toEqual({
      language: 'python',
    });
  });


  it('should transform from the .ipynb executed code cell with multi-line input', () => {
    ipyCodeCell.input = [
       "import pandas as pd\n",
       "import numpy as np"
     ];

    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.source).toBe('import pandas as pd\nimport numpy as np');
  });

  it('should transform from the .ipynb code cell with a single-line pyout output', () => {
    ipyCodeCell.outputs = [{
      "metadata": {},
      "output_type": "pyout",
      "text": [
        "4"
      ]
    }];

    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.outputs.length).toBe(1);
    expect(cell.outputs[0]).toEqual({
      type: 'result',
      mimetypeBundle: {
        'text/plain': '4'
      },
      metadata: {}
    });
  });

  it('should transform from the .ipynb code cell with a multiline pyout output', () => {
    ipyCodeCell.outputs = [{
      "metadata": {},
      "output_type": "pyout",
      "text": [
        'first\n',
        'second\n',
        'third'
      ]
    }];

    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.outputs.length).toBe(1);
    expect(cell.outputs[0]).toEqual({
      type: 'result',
      mimetypeBundle: {
        'text/plain': 'first\nsecond\nthird'
      },
      metadata: {}
    });

  });

  it('should transform from the .ipynb code cell with multiple mimetypes in a single output', () => {
    ipyCodeCell.outputs = [{

      "html": [
        "<div><p>first line</p><p>second line</div>"
      ],

      "text": [
        "first line\n",
        "second line"
      ],

      "metadata": {},
      "output_type": "pyout"
    }];

    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.outputs.length).toBe(1);
    expect(cell.outputs[0]).toEqual({
      type: 'result',
      mimetypeBundle: {
        'text/plain': 'first line\nsecond line',
        'text/html': '<div><p>first line</p><p>second line</div>'
      },
      metadata: {}
    });

  });

  it('should transform from the .ipynb code cell with stdout stream output', () => {
    ipyCodeCell.outputs = [{
      "output_type": "stream",
      "stream": "stdout",
      "text": [
        "stdout line 1\n",
        "stdout line 2\n"
      ]
    }];

    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.outputs.length).toBe(1);
    expect(cell.outputs[0]).toEqual({
      type: 'stdout',
      mimetypeBundle: {
        'text/plain': 'stdout line 1\nstdout line 2\n'
      },
      metadata: {}
    });
  });

  it('should transform from the .ipynb code cell with display data output', () => {
    ipyCodeCell.outputs = [{
       "output_type": "display_data",
       "png": "png base64 encoded content here",
       "text": [
         "<matplotlib.figure.Figure at 0x10669a310>"
       ]
    }];

    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.outputs.length).toBe(1);
    expect(cell.outputs[0]).toEqual({
      type: 'result',
      mimetypeBundle: {
        'text/plain': '<matplotlib.figure.Figure at 0x10669a310>',
        'image/png': 'png base64 encoded content here'
      },
      metadata: {}
    });
  });

  it('should transform from the .ipynb code cell with error output', () => {
    ipyCodeCell.outputs = [{
      "ename": "NameError",
      "evalue": "name 'asdf' is not defined",
      "output_type": "pyerr",
      "traceback": [
        "tb line 1\n",
        "tb line 2\n"
      ]
    }];

    cell = xforms.fromIPyCodeCell(ipyCodeCell);

    expect(cell.outputs.length).toBe(1);
    expect(cell.outputs[0]).toEqual({
      type: 'error',
      mimetypeBundle: {
        'text/plain': "NameError: name 'asdf' is not defined"
        // TODO(bryantd): validate content of html traceback once the ansi color code and format
        // are translated to html with appropriate css classes
      },
      metadata: {
        errorDetails: {
          errorName: 'NameError',
          errorMessage: "name 'asdf' is not defined",
          traceback: [
            "tb line 1\n",
            "tb line 2\n"
          ]
        }
      }
    });
  });

});


describe('IPython .ipynb v3 format serialization of markdown cells', () => {

  var ipyMarkdownCell: app.ipy.MarkdownCell;
  var cell: app.notebook.Cell;

  beforeEach(() => {
    ipyMarkdownCell = {
      "cell_type": "markdown",
      "metadata": {},
      "source": [
        "# Some markdown heading\n",
        "\n",
        "This notebook demonstrates...\n",
      ]
    };
  });

  afterEach(() => {
    ipyMarkdownCell = undefined;
    cell = undefined;
  });

  it('should transform from the .ipynb Markdown cell', () => {
    cell = xforms.fromIPyMarkdownCell(ipyMarkdownCell);

    expect(cell.type).toBe(cells.markdown);
    expect(cell.metadata).toEqual({});
    expect(cell.source).toBe(
      '# Some markdown heading\n\nThis notebook demonstrates...\n');
  });

});


describe('IPython .ipynb v3 format serialization of heading cells', () => {

  var ipyHeadingCell: app.ipy.HeadingCell;
  var cell: app.notebook.Cell;

  beforeEach(() => {
    ipyHeadingCell = {
      "cell_type": "heading",
      "metadata": {},
      "source": [
        "this is a heading"
      ],
      level: 1
    };
  });

  afterEach(() => {
    ipyHeadingCell = undefined;
    cell = undefined;
  });

  it('should transform from the .ipynb heading cell (level 1)', () => {
    cell = xforms.fromIPyHeadingCell(ipyHeadingCell);

    expect(cell.type).toBe(cells.heading);
    expect(cell.metadata).toEqual({
      level: 1
    });
    expect(cell.source).toBe('this is a heading');
  });

  it('should transform from the .ipynb heading cell (level 2)', () => {
    ipyHeadingCell.level = 2;

    cell = xforms.fromIPyHeadingCell(ipyHeadingCell);

    expect(cell.type).toBe(cells.heading);
    expect(cell.metadata).toEqual({
      level: 2
    });
    expect(cell.source).toBe('this is a heading');
  });

});


describe('IPython .ipynb v3 format serialization of notebook metadata', () => {
  var ipyNotebook: app.ipy.Notebook;
  var notebook: app.notebook.Notebook;

  beforeEach(() => {
    ipyNotebook = {
      "metadata": {
        "signature": "sha256 hash"
      },
      "nbformat": 3,
      "nbformat_minor": 0,
      "worksheets": []
    }
  });

  afterEach(() => {
    ipyNotebook = undefined;
    notebook = undefined;
  });

  it('should transform from the .ipynb notebook with zero worksheets', () => {
    notebook = xforms.fromIPyNotebook(ipyNotebook);
    // There should be a single empty worksheet
    expect(notebook.worksheetIds.length).toBe(1);
    var worksheet = notebook.worksheets[notebook.worksheetIds[0]];
    expect(worksheet.cells.length).toBe(0);
  });

  it('should transform from the .ipynb notebook with one worksheet having zero cells', () => {
    ipyNotebook.worksheets.push({
      metadata: {foo: 'bar'},
      cells: []
    });

    notebook = xforms.fromIPyNotebook(ipyNotebook);

    expect(notebook.worksheetIds.length).toBe(1);
    var worksheet = notebook.worksheets[notebook.worksheetIds[0]];
    expect(worksheet.metadata).toEqual({foo: 'bar'});
    expect(worksheet.cells).toEqual([]);
  });

  it('should transform from the .ipynb notebook with one worksheet having non-zero cells', () => {
    ipyNotebook.worksheets.push({
      metadata: {baz: 'quux'},
      cells: [{
        cell_type: 'markdown',
        source: ['md text'],
        metadata: {foo: 'bar'}
      }]
    });

    notebook = xforms.fromIPyNotebook(ipyNotebook);

    expect(notebook.worksheetIds.length).toBe(1);

    var worksheet = notebook.worksheets[notebook.worksheetIds[0]];
    expect(worksheet.cells.length).toBe(1);
    expect(worksheet.metadata).toEqual({baz: 'quux'});

    var cell = worksheet.cells[0];
    expect(cell.type).toBe(cells.markdown);
    expect(cell.source).toBe('md text');
    expect(cell.metadata).toEqual({foo: 'bar'});
    expect(cell.id).toBeDefined();
  });

});
