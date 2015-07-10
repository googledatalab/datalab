/*
 * Copyright 2015 Google Inc. All rights reserved.
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


/// <reference path="../../../../../../externs/ts/jasmine.d.ts"/>
/// <reference path="../../../../../../externs/ts/angularjs/angular.d.ts"/>
/// <reference path="../../../../../../externs/ts/angularjs/angular-mocks.d.ts"/>
/// <amd-dependency path="angularMocks" />
import actions = require('app/shared/actions');
import clientNotebook = require('app/components/sessions/ClientNotebook');
import mocks = require('tests/mocks');
import update = require('app/shared/updates');
import util = require('tests/util');


// Declare the interfaces for internal methods to be tested.
interface IClientNotebookInternal extends app.IClientNotebook {
  _findPreferredMimetype(mimetypeBundle: app.Map<string>): string;
  _handleAddCell(update: app.notebooks.updates.AddCell): void;
  _handleCellUpdate(update: app.notebooks.updates.CellUpdate): void;
  _handleCompositeUpdate(update: app.notebooks.updates.Composite): void;
  _handleDeleteCell(update: app.notebooks.updates.DeleteCell): void;
  _selectMimetype(output: app.notebooks.AugmentedCellOutput): void;
  _selectMimetypes(notebook: app.notebooks.Notebook): void;
  _setNotebook(snapshot: app.notebooks.updates.Snapshot): void;
}

describe('Client notebook', () => {
  var scope: ng.IRootScopeService;
  var route: ng.route.IRouteService;
  var nb: IClientNotebookInternal;
  var nbdata: app.notebooks.Notebook;
  var headingCell: app.notebooks.Cell;
  var markdownCell: app.notebooks.Cell;
  var codeCell: app.notebooks.Cell;

  beforeEach(inject(($rootScope: ng.IRootScopeService) => {
    scope = $rootScope;
  }));

  beforeEach(() => {
    var route = util.clone(mocks.routeService);

    nb = new clientNotebook.ClientNotebook(scope, route);

    headingCell = {
      id: 'heading-cell',
      type: 'heading',
      source: 'A heading.',
      metadata: {level: 1}
    };

    markdownCell = {
      id: 'markdown-cell',
      type: 'markdown',
      source: '# Markdown content',
      metadata: {}
    };

    codeCell = {
      id: 'code-cell',
      type: 'code',
      source: 'source code',
      metadata: {},
      outputs: [
        {
          type: 'result',
          mimetypeBundle: {
            'text/html': 'html content',
            'text/plain': 'plain text content'
          },
          metadata: {}
        },
        {
          type: 'stdout',
          mimetypeBundle: {
            'text/plain': 'plain text content'
          },
          metadata: {}
        },
        {
          type: 'stderr',
          mimetypeBundle: {
            'text/plain': 'plain text content'
          },
          metadata: {}
        },
        {
          type: 'result',
          mimetypeBundle: {
            'image/png': 'png content',
            'text/plain': 'plain text content'
          },
          metadata: {}
        }
      ]
    };

    nbdata = {
      id: "nb-id",
      metadata: {},
      worksheets: [
        {
          id: 'ws1-id',
          name: 'worksheet 1',
          metadata: {},
          cells: [headingCell, markdownCell, codeCell]
        }
      ]
    };
  });

  // Validate the initial state of the notebook session.
  it('creates a notebook session for the specified notebook path.', () => {
    expect(nb.notebookPath).toBe('/fake-path.ipynb');
    expect(nb.notebook).toBeUndefined();
    expect(nb.activeWorksheet).toBeUndefined();
    expect(nb.activeCell).toBeUndefined();
  });

  describe('worksheet selection', () => {
    beforeEach(() => {
      nbdata.worksheets.push({
        id: 'ws2-id',
        name: 'worksheet 2',
        metadata: {},
        cells: []
      });

      nb._setNotebook({
        name: update.notebook.snapshot,
        notebook: nbdata
      });
    });

    it('selects the second worksheet', () => {
      expect(nb.activeWorksheet.name).toBe('worksheet 1');
      nb.selectWorksheet('ws2-id');
      expect(nb.activeWorksheet.name).toBe('worksheet 2');
    });

    it('fails to select a non-existent worksheet', () => {
      expect(nb.selectWorksheet.bind(null, 'non-existent')).toThrow();
    });
  });

  describe('cell selection', () => {
    beforeEach(() => {
      nb._setNotebook({
        name: update.notebook.snapshot,
        notebook: nbdata
      });
    });

    it('changes the active cell to code-cell', () => {
      expect(nb.activeCell).toBeFalsy();
      nb.selectCell(codeCell);
      expect(nb.activeCell).toBe(codeCell);
    });

    it('deselects the active cell', () => {
      nb.selectCell(codeCell);
      expect(nb.activeCell).toBe(codeCell);
      nb.deselectCell();
      expect(nb.activeCell).toBeFalsy();
    });
  });

  describe('notebook snapshot update', () => {
    it('updates the client notebook to a new notebook snapshot value', () => {
      nb._setNotebook({
        name: update.notebook.snapshot,
        notebook: nbdata
      });

      expect(nb.notebook).toBeDefined();
      expect(nb.notebook.id).toBe('nb-id');
      expect(nb.activeWorksheet).toBe(nbdata.worksheets[0]);
      expect(nb.activeCell).toBeUndefined();
    });

    it('triggers a notebook snapshot updates the client notebook to the new snapshot value', () => {
      scope.$emit(update.notebook.snapshot, {
        name: update.notebook.snapshot,
        notebook: nbdata
      });

      // Important: because registerEventHandler triggers the callback via $evalAsync, the callback
      // will not be fired until a digest cycle completes; thus, trigger a digest manually.
      scope.$digest();

      expect(nb.notebook).toBeDefined();
      expect(nb.notebook.id).toBe('nb-id');
      expect(nb.activeWorksheet).toBe(nbdata.worksheets[0]);
      expect(nb.activeCell).toBeUndefined();
    });

    it('updates the client notebook to a new notebook snapshot value with zero cells', () => {
      // Clear the worksheet so that it contains zero cells; check that nothing fails in this case.
      nbdata.worksheets[0].cells = [];

      nb._setNotebook({
        name: update.notebook.snapshot,
        notebook: nbdata
      });

      expect(nb.notebook).toBeDefined();
      expect(nb.notebook.id).toBe('nb-id');
      expect(nb.activeWorksheet).toBe(nbdata.worksheets[0]);
      expect(nb.activeCell).toBeUndefined();
      expect(nb.activeWorksheet.cells.length).toBe(0);
    });
  });

  describe('cell output MIME type selection', () => {
    it('finds the preferred MIME type from a cell output bundle', () => {
      var mimetypeBundle: app.Map<string> = {
        'text/html': 'html content',
        'text/plain': 'plain text content',
        'image/png': 'png content',
        'image/jpeg': 'jpeg content'
      };

      expect(nb._findPreferredMimetype(mimetypeBundle)).toBe('text/html');
    });

    it('augments the cell output with the preferred MIME type', () => {
      var output: app.notebooks.AugmentedCellOutput = {
        type: 'result',
        mimetypeBundle: {
          'text/html': 'html content',
          'text/plain': 'plain text content'
        },
        metadata: {}
      };

      nb._selectMimetype(output);
      expect(output.preferredMimetype).toBe('text/html');
    });

    it('adds preferred MIME types for all cell outputs within the notebook', () => {
      nb._selectMimetypes(nbdata);

      expect((<app.notebooks.AugmentedCellOutput>codeCell.outputs[0]).preferredMimetype)
          .toBe('text/html');
      expect((<app.notebooks.AugmentedCellOutput>codeCell.outputs[1]).preferredMimetype)
          .toBe('text/plain');
      expect((<app.notebooks.AugmentedCellOutput>codeCell.outputs[2]).preferredMimetype)
          .toBe('text/plain');
      expect((<app.notebooks.AugmentedCellOutput>codeCell.outputs[3]).preferredMimetype)
          .toBe('image/png');
    });
  });

  describe('updates', () => {
    beforeEach(() => {
      // Initialize the notebook content.
      nb._setNotebook({
        name: update.notebook.snapshot,
        notebook: nbdata
      });
    });

    describe('add cell update', () => {
      var addCellUpdate: app.notebooks.updates.AddCell;
      var newCell: app.notebooks.Cell;

      beforeEach(() => {
        var newCell = util.clone(codeCell);
        newCell.id = 'new-cell';

        addCellUpdate = {
          name: update.worksheet.addCell,
          worksheetId: 'ws1-id',
          cell: newCell,
          insertAfter: 'markdown-cell'
        };
      });

      it('directly adds a new cell to the notebook', () => {
        nb._handleAddCell(addCellUpdate);

        expect(nb.activeWorksheet.cells.length).toBe(4);
        expect(nb.activeWorksheet.cells[2].id).toBe('new-cell');
      });

      it('fails to add a new cell to a non-existent worksheet within the notebook', () => {
        addCellUpdate.worksheetId = 'non-existent worksheet';

        expect(nb._handleAddCell.bind(null, addCellUpdate)).toThrow();
      });

      it('fails to add a new cell after a non-existent cell within the notebook', () => {
        addCellUpdate.insertAfter = 'non-existent cell';

        expect(nb._handleAddCell.bind(null, addCellUpdate)).toThrow();
      });

      it('triggers an update.worksheet.addCell event', () => {
        var newCell = util.clone(codeCell);
        newCell.id = 'new-cell';

        scope.$emit(update.worksheet.addCell, addCellUpdate);
        scope.$digest();

        expect(nb.activeWorksheet.cells.length).toBe(4);
        expect(nb.activeWorksheet.cells[2].id).toBe('new-cell');
      });
    });

    describe('delete cell update', () => {
      var deleteCellUpdate: app.notebooks.updates.DeleteCell;

      beforeEach(() => {
        deleteCellUpdate = {
          name: update.worksheet.deleteCell,
          worksheetId: 'ws1-id',
          cellId: null
        }
      });

      it('directly deletes the first cell from the notebook', () => {
        deleteCellUpdate.cellId = 'heading-cell';
        nb._handleDeleteCell(deleteCellUpdate);

        expect(nb.activeWorksheet.cells.length).toBe(2);
        ['markdown-cell', 'code-cell'].forEach((id, i) => {
          expect(nb.activeWorksheet.cells[i].id).toBe(id);
        });
      });

      it('directly deletes an inner cell from the notebook', () => {
        deleteCellUpdate.cellId = 'markdown-cell';
        nb._handleDeleteCell(deleteCellUpdate);

        expect(nb.activeWorksheet.cells.length).toBe(2);
        ['heading-cell', 'code-cell'].forEach((id, i) => {
          expect(nb.activeWorksheet.cells[i].id).toBe(id);
        });
      });

      it('directly deletes the last cell from the notebook', () => {
        deleteCellUpdate.cellId = 'code-cell';
        nb._handleDeleteCell(deleteCellUpdate);

        expect(nb.activeWorksheet.cells.length).toBe(2);
        ['heading-cell', 'markdown-cell'].forEach((id, i) => {
          expect(nb.activeWorksheet.cells[i].id).toBe(id);
        });
      });

      it('fails to delete a non-existent cell from the notebook', () => {
        deleteCellUpdate.cellId = 'non-existent id';
        expect(nb._handleDeleteCell.bind(null, deleteCellUpdate)).toThrow();
      });

      it('fails to delete a cell from a non-existent worksheet', () => {
        deleteCellUpdate.cellId = 'code-cell';
        deleteCellUpdate.worksheetId = 'non-existent id';
        expect(nb._handleDeleteCell.bind(null, deleteCellUpdate)).toThrow();
      });

      it('triggers an update.worksheet.deleteCell event', () => {
        deleteCellUpdate.cellId = 'markdown-cell';

        scope.$emit(update.worksheet.deleteCell, deleteCellUpdate);
        scope.$digest();

        expect(nb.activeWorksheet.cells.length).toBe(2);
        ['heading-cell', 'code-cell'].forEach((id, i) => {
          expect(nb.activeWorksheet.cells[i].id).toBe(id);
        });
      });
    });

    describe('composite update', () => {
      var composite: app.notebooks.updates.Composite;

      beforeEach(() => {
        composite = {
          name: update.composite,
          subUpdates: []
        }
      });

      it('updates the markdown and heading cell sources', () => {
        composite.subUpdates.push({
          name: update.cell.update,
          worksheetId: 'ws1-id',
          cellId: 'heading-cell',
          source: 'new heading source'
        });
        composite.subUpdates.push({
          name: update.cell.update,
          worksheetId: 'ws1-id',
          cellId: 'markdown-cell',
          source: 'new markdown source'
        });

        nb._handleCompositeUpdate(composite);

        expect(markdownCell.source).toBe('new markdown source');
        expect(headingCell.source).toBe('new heading source');
      });
    });

    describe('cell update', () => {
      var cellUpdate: app.notebooks.updates.CellUpdate;

      beforeEach(() => {
        cellUpdate = {
          name: update.cell.update,
          worksheetId: 'ws1-id',
          cellId: 'code-cell',
        }
      });

      it('replaces the source', () => {
        cellUpdate.source = 'new source';

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.source).toBe('new source');
      });

      it('clears the source', () => {
        cellUpdate.source = '';

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.source).toBe('');
      });

      it('leaves the source as-is', () => {
        var initialSource = codeCell.source;
        cellUpdate.source = null;

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.source).toBe(initialSource);
      });

      it('changes the state', () => {
        cellUpdate.state = 'executing';

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.state).toBe('executing');
      });

      it('clears the cell outputs', () => {
        cellUpdate.outputs = [];
        cellUpdate.replaceOutputs = true;

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.outputs).toEqual([]);
      });

      it('appends a cell output', () => {
        cellUpdate.outputs = [{
          type: 'stdout',
          mimetypeBundle: {
            'text/plain': 'new output'
          },
          metadata: {}
        }];

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.outputs.length).toBe(5);
        expect(codeCell.outputs[4].mimetypeBundle['text/plain']).toBe('new output');
      });

      it('replaces the cell outputs', () => {
        cellUpdate.outputs = [{
          type: 'stdout',
          mimetypeBundle: {
            'text/plain': 'new output'
          },
          metadata: {}
        }];
        cellUpdate.replaceOutputs = true;

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.outputs.length).toBe(1);
        expect(codeCell.outputs[0].mimetypeBundle['text/plain']).toBe('new output');
      });

      it('replaces the cell metadata', () => {
        codeCell.metadata = {key: 'value'};
        cellUpdate.metadata = {foo: 'bar'};
        cellUpdate.replaceMetadata = true;

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.metadata['foo']).toBe('bar');
        expect(codeCell.metadata['key']).toBeUndefined();
      });

      it('augments the cell metadata', () => {
        codeCell.metadata = {key: 'value'};
        cellUpdate.metadata = {foo: 'bar'};
        cellUpdate.replaceMetadata = false;

        nb._handleCellUpdate(cellUpdate);

        expect(codeCell.metadata['foo']).toBe('bar');
        expect(codeCell.metadata['key']).toBe('value');
      });

      it('triggers an update.cell.update event', () => {
        cellUpdate.source = 'new source';

        scope.$emit(update.cell.update, cellUpdate);
        scope.$digest();

        expect(codeCell.source).toBe('new source');
      });

    });

  });

});
