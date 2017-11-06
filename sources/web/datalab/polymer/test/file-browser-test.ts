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
  class MockFile extends DatalabFile {
    constructor(name = '', path = '') {
      super({
        getInlineDetailsName: () => '',
        getPreviewName: () => '',
        icon: '',
        id: new DatalabFileId(path, FileManagerType.MOCK),
        name,
        type: DatalabFileType.DIRECTORY,
      });
    }
  }

  class MockFileManager extends BaseFileManager {
    public async getRootFile() {
      return new MockFile('root');
    }
    public pathToPathHistory(path: string): DatalabFile[] {
      return [new MockFile('', path)];
    }
  }

  describe('<file-browser>', () => {
    let testFixture: FileBrowserElement;
    const startuppath = new DatalabFileId('testpath', FileManagerType.MOCK);

    const mockFiles = [
      new MockFile('file1'),
      new MockFile('file2'),
      new MockFile('file3'),
    ];

    before(() => {
      SettingsManager.getUserSettingsAsync = (forceRefresh: boolean) => {
        assert(forceRefresh === true, 'file-browser should refresh settings on load');
        const mockSettings: common.UserSettings = {
          idleTimeoutInterval: '',
          idleTimeoutShutdownCommand: '',
          startuppath: startuppath.path,
          theme: 'light',
        };
        return Promise.resolve(mockSettings);
      };
      ApiManager.getBasePath = () => {
        return Promise.resolve('');
      };
      SessionManager.listSessionsAsync = () => {
        return Promise.resolve([]);
      };
      const mockFileManager = new MockFileManager();
      mockFileManager.list = () => {
        return Promise.resolve(mockFiles);
      };
      FileManagerFactory.getInstance = () => mockFileManager;
      FileManagerFactory.getInstanceForType = (_) => mockFileManager;
    });

    beforeEach((done: () => any) => {
      testFixture = fixture('files-fixture');
      testFixture.ready()
        .then(() => {
          Polymer.dom.flush();
          done();
        });
    });

    it('gets the startup path correctly', () => {
      assert(JSON.stringify(testFixture.currentFile.id) === JSON.stringify(startuppath),
          'incorrect startup path');
    });

    it('displays list of files correctly', () => {
      const files: ItemListElement = testFixture.$.files;
      assert(files.rows.length === 3, 'should have three files');

      mockFiles.forEach((file: DatalabFile, i: number) => {
        assert(files.rows[i].columns[0] === file.name,
            'mock file ' + i + 'name not shown in first column');
        assert(files.rows[i].icon === file.icon, 'mock file ' + i + ' type not shown as icon');
      });
    });

    it('shows Name column in header', () => {
      const files: ItemListElement = testFixture.$.files;
      const columns = files.$.header.querySelectorAll('.column');
      assert(columns.length === 1, 'exactly one column is expected');
      assert(columns[0].innerText === 'Name', 'Name column missing');
    });

    it('starts up with no files selected, and no files running', () => {
      const files: ItemListElement = testFixture.$.files;
      files.rows.forEach((row: ItemListRow, i: number) => {
        assert(!row.selected, 'file ' + i + ' should not be selected');
      });
    });

    it('shows new notebook dialog', async () => {
      // Make sure no dialogs are shown
      assert(document.querySelector('input-dialog') === null,
          'no input dialogs should be shown before clicking new');
      testFixture.$.newNotebookButton.click();
      const dialog = TestUtils.getDialog(InputDialogElement);
      assert(dialog, 'an input dialog should show after clicking new notebook');
      assert(dialog.$.dialogTitle.innerText === 'New ' + Utils.constants.notebook);

      await TestUtils.cancelDialog(dialog);
    });

    it('shows new file dialog', async () => {
      // Make sure no dialogs are shown
      assert(document.querySelector('input-dialog') === null,
          'no input dialogs should be shown before clicking new');
      testFixture.$.newFileButton.click();
      const dialog = TestUtils.getDialog(InputDialogElement);
      assert(dialog, 'an input dialog should show after clicking new file');
      assert(dialog.$.dialogTitle.innerText === 'New ' + Utils.constants.file);

      await TestUtils.cancelDialog(dialog);
    });

    it('shows new folder dialog', async () => {
      // Make sure no dialogs are shown
      assert(document.querySelector('input-dialog') === null,
          'no input dialogs should be shown before clicking new');
      testFixture.$.newFolderButton.click();
      const dialog = TestUtils.getDialog(InputDialogElement);
      assert(dialog, 'an input dialog should show after clicking new folder');
      assert(dialog.$.dialogTitle.innerText === 'New ' + Utils.constants.directory);

      await TestUtils.cancelDialog(dialog);
    });
  });
});
