/*
 * Copyright 2017 Google Inc. All rights reserved.
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

window.addEventListener('WebComponentsReady', () => {
  describe('<notebook-preview>', () => {
    const testFixture = fixture('notebook-preview-fixture');
    const mockNotebookCells = [{
        cell_type: 'markdown',
        metadata: {},
        source: ['first markdown cell']
      }, {
        cell_type: 'markdown',
        metadata: {},
        source: ['second markdown cell']
      }, {
        cell_type: 'code',
        metadata: {},
        source: ['first code cell']
      }, {
        cell_type: 'code',
        metadata: {},
        source: ['second code cell']
      }, {
        cell_type: 'code',
        metadata: {},
        source: ['third code cell']
      }
    ];

    function cellsToNotebook(cells: any) {
      return JSON.stringify({
        cells,
        nbformat: 4,
        nbformat_minor: 2
      });
    }

    const mockFileManager = new MockFileManager();
    FileManagerFactory.getInstance = () => mockFileManager;
    FileManagerFactory.getInstanceForType = (_) => mockFileManager;

    it('shows default status string if no file is provided', () => {
      assert(testFixture.$.message.innerText === NotebookPreviewElement._noFileMessage,
          'status message not shown correctly');
      assert(testFixture.$.previewHtml.innerText === '',
          'preview HTML not shown correctly');
    });

    it('shows no preview for non-notebook files', () => {
      testFixture.file = new MockFile('test', '', DatalabFileType.DIRECTORY);
      assert(testFixture.$.message.innerText === NotebookPreviewElement._noFileMessage,
          'status message not shown correctly');
      assert(testFixture.$.previewHtml.innerText === '',
          'preview HTML not shown correctly');

      testFixture.file = new MockFile('test', '', DatalabFileType.FILE);
      assert(testFixture.$.message.innerText === NotebookPreviewElement._noFileMessage,
          'status message not shown correctly');
      assert(testFixture.$.previewHtml.innerText === '',
          'preview HTML not shown correctly');
    });

    it('shows empty status string for empty notebooks', async () => {
      mockFileManager.getStringContent = () => Promise.resolve(cellsToNotebook([]));
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);

      const result = await TestUtils.waitUntilTrue(() => {
        return testFixture.$.message.innerText === NotebookPreviewElement._emptyNotebookMessage &&
              testFixture.$.previewHtml.innerText === '';
      }, 2000);
      assert(result, 'status message not shown correctly');
    });

    it('shows first 2 markdown cells as preview for notebook with 2 markdown + 3 code cells',
        async () => {
      mockFileManager.getStringContent = () =>
          Promise.resolve(cellsToNotebook(mockNotebookCells));
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);

      const result = await TestUtils.waitUntilTrue(() => {
        return testFixture.$.message.innerText ===
              ' Notebook with 5 cells. ' + NotebookPreviewElement._longNotebookMessage &&
              testFixture.$.previewHtml.innerHTML ===
              '<p>first markdown cell</p>\n<p>second markdown cell</p>\n';
      }, 2000);
      assert(result, 'status message not shown correctly');
    });

    it('shows first markdown cell as preview for notebook with 1 markdown + 3 code cells',
        async () => {
      mockFileManager.getStringContent = () =>
          Promise.resolve(cellsToNotebook(mockNotebookCells.slice(1)));
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);

      const result = await TestUtils.waitUntilTrue(() => {
        return testFixture.$.message.innerText ===
              ' Notebook with 4 cells. ' + NotebookPreviewElement._longNotebookMessage &&
              testFixture.$.previewHtml.innerHTML ===
              '<p>second markdown cell</p>\n';
      }, 2000);
      assert(result, 'status message not shown correctly');
    });

    it('shows no markdown as preview for notebook with 2 code cells only',
        async () => {
      mockFileManager.getStringContent = () =>
          Promise.resolve(cellsToNotebook(mockNotebookCells.slice(2, 4)));
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);

      const result = await TestUtils.waitUntilTrue(() => {
        return testFixture.$.message.innerText === ' Notebook with 2 cells. ' &&
              testFixture.$.previewHtml.innerHTML === '';
      }, 2000);
      assert(result, 'status message not shown correctly');
    });

    it('shows no markdown as preview for notebook with 3 code cells only',
        async () => {
      mockFileManager.getStringContent = () =>
          Promise.resolve(cellsToNotebook(mockNotebookCells.slice(2)));
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);

      const result = await TestUtils.waitUntilTrue(() => {
        return testFixture.$.message.innerText === ' Notebook with 3 cells. ' &&
              testFixture.$.previewHtml.innerHTML === '';
      }, 2000);
      assert(result, 'status message not shown correctly');
    });

    it('shows error status if notebook fails to load', async () => {
      mockFileManager.getStringContent = () => {
        return Promise.reject('error');
      };
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);

      const result = await TestUtils.waitUntilTrue(() => {
        return testFixture.$.message.innerText === NotebookPreviewElement._errorMessage &&
              testFixture.$.previewHtml.innerHTML === '';
      }, 2000);
      assert(result, 'status message not shown correctly');
    });

    it('shows error status if notebook cannot be parsed', async () => {
      mockFileManager.getStringContent = () => Promise.resolve('');
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);

      const result = await TestUtils.waitUntilTrue(() => {
        return testFixture.$.message.innerText === NotebookPreviewElement._errorMessage &&
              testFixture.$.previewHtml.innerHTML === '';
      }, 2000);
      assert(result, 'status message not shown correctly');
    });

    it('shows spinner while notebook is being loaded', (done) => {
      mockFileManager.getStringContent = () => new Promise((resolve) => {
        assert(!testFixture.$.loadingDiv.hidden,
            'loading message should show while loading notebook');
        assert(testFixture.$.previewDiv.hidden,
            'preview section should be hidden while loading notebook');
        resolve();
        done();
      });
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);
    });

    it('does not load the notebook if not set to active', () => {
      sinon.spy(mockFileManager, 'getStringContent');
      testFixture.active = false;
      testFixture.file = new MockFile('test', '', DatalabFileType.NOTEBOOK);
      assert((mockFileManager.getStringContent as sinon.SinonSpy).notCalled,
          'getStringContent should not be called if preview element is not active');
    });

  });
});
