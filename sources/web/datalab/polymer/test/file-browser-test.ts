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
  const testPath = 'testpath';

  describe('<file-browser>', () => {
    let testFixture: FileBrowserElement;
    const startuppath = new DatalabFileId(testPath, FileManagerType.MOCK);

    const mockFiles = [
      new MockFile('file1'),
      new MockFile('file2'),
      new MockFile('file3'),
    ];
    const mockFileManager = new MockFileManager();

    const alwaysEnabledButtonIds = [
      'newNotebookButton',
      'newFileButton',
      'newFolderButton',
      'uploadButton',
    ];
    const singleSelectionEnabledButtonIds = [
      'editAsTextButton',
      'copyButton',
      'moveButton',
      'renameButton',
    ];
    const multiSelectionEnabledButtonIds = [
      'deleteButton',
    ];

    function assertEnabledState(id: string, enabled: boolean) {
      const button = testFixture.$[id] as HTMLElement;
      assert(button.hasAttribute('disabled') === !enabled,
          id + ' is expected to be ' + enabled ? 'enabled' : 'disabled');
    }

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
        assert(files.rows[i].columns[1] === file.type.toString(),
            'mock file ' + i + 'type not shown in second column');
        assert(files.rows[i].icon === file.icon, 'mock file ' + i + ' type not shown as icon');
      });
    });

    it('shows column names returned from the file manager in header', () => {
      const files: ItemListElement = testFixture.$.files;
      const columns = files.$.header.querySelectorAll('.column');
      assert(columns.length === 2, 'exactly two columns are expected');
      assert(columns[0].innerText.trim() === 'Name', 'Name column missing');
      assert(columns[1].innerText.trim() === 'Type', 'Type column missing');
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
      const dialog = TestUtils.getDialog(NewNotebookDialogElement);
      assert(!!dialog, 'an input dialog should show after clicking new notebook');
      assert(dialog.$.dialogTitle.innerText === 'New ' + Utils.constants.notebook,
          'dialog text should include type of new entity');

      // Force update items in the dropdown instead of waiting on the event
      Polymer.dom.flush();
      dialog.$.dropdownItems.forceSynchronousItemUpdate();

      await TestUtils.closeDialog(dialog, false);
    });

    it('shows new file dialog', async () => {
      // Make sure no dialogs are shown
      assert(document.querySelector('input-dialog') === null,
          'no input dialogs should be shown before clicking new');
      testFixture.$.newFileButton.click();
      const dialog = TestUtils.getDialog(InputDialogElement);
      assert(!!dialog, 'an input dialog should show after clicking new file');
      assert(dialog.$.dialogTitle.innerText === 'New ' + Utils.constants.file,
          'dialog text should include type of new entity');

      await TestUtils.closeDialog(dialog, false);
    });

    it('shows new folder dialog', async () => {
      // Make sure no dialogs are shown
      assert(document.querySelector('input-dialog') === null,
          'no input dialogs should be shown before clicking new');
      testFixture.$.newFolderButton.click();
      const dialog = TestUtils.getDialog(InputDialogElement);
      assert(!!dialog, 'an input dialog should show after clicking new folder');
      assert(dialog.$.dialogTitle.innerText === 'New ' + Utils.constants.directory,
          'dialog text should include type of new entity');

      await TestUtils.closeDialog(dialog, false);
    });

    it('enables always-enabled buttons, disables the rest when no file is selected', () => {
      const files: ItemListElement = testFixture.$.files;
      files._unselectAll();
      alwaysEnabledButtonIds.forEach((id) => assertEnabledState(id, true));
      singleSelectionEnabledButtonIds.forEach((id) => assertEnabledState(id, false));
      multiSelectionEnabledButtonIds.forEach((id) => assertEnabledState(id, false));
    });

    it('enables all buttons when one file is selected', () => {
      const files: ItemListElement = testFixture.$.files;
      files._unselectAll();
      files._selectItemByDisplayIndex(0);
      alwaysEnabledButtonIds.forEach((id) => assertEnabledState(id, true));
      singleSelectionEnabledButtonIds.forEach((id) => assertEnabledState(id, true));
      multiSelectionEnabledButtonIds.forEach((id) => assertEnabledState(id, true));
    });

    it(`enables always enabled and multi-selection enabled buttons, and
        disables the rest when two files are selected`, () => {
      const files: ItemListElement = testFixture.$.files;
      files._unselectAll();
      files._selectItemByDisplayIndex(0);
      files._selectItemByDisplayIndex(1);
      alwaysEnabledButtonIds.forEach((id) => assertEnabledState(id, true));
      singleSelectionEnabledButtonIds.forEach((id) => assertEnabledState(id, false));
      multiSelectionEnabledButtonIds.forEach((id) => assertEnabledState(id, true));
    });

    describe('creating new notebook', () => {
      const notebookName = 'newMockNotebook';
      let dialog: NewNotebookDialogElement;
      const specs = [{
        display_name: 'Kernel 1',
        language: 'kernel1Lang',
        name: 'kernel1',
      }, {
        display_name: 'Kernel 2',
        language: 'kernel2Lang',
        name: 'kernel2',
      }];
      KernelManager.getAllKernelSpecs = () => specs;

      beforeEach(async () => {
        // Validate window.open is called with the correct url
        sinon.stub(window, 'open');
        testFixture.$.newNotebookButton.click();
        dialog = TestUtils.getDialog(NewNotebookDialogElement) as NewNotebookDialogElement;
        dialog.$.inputBox.value = notebookName;

        // Force update items in the dropdown instead of waiting on the event
        Polymer.dom.flush();
        dialog.$.dropdownItems.forceSynchronousItemUpdate();
      });

      afterEach(() => {
        (window.open as sinon.SinonStub).restore();
      });

      it('shows a list of supported kernel names in new notebook dialog', async () => {
        assert(dialog.$.dropdownItems.items.length === 2, 'two kernels should be listed');
        dialog.$.dropdownItems.items.forEach((item: any, i: number) => {
          assert(item.innerText.trim() === specs[i].display_name,
              'the kernel\'s display name should be shown in the list');
          assert(item.value.trim() === specs[i].name,
              'the kernel\'s name should be stored in the value attribute');
        });
        await TestUtils.closeDialog(dialog, false);
      });

      it('correctly opens new tab to create a notebook using the default kernel', async () => {
        await TestUtils.closeDialog(dialog, true);

        const result = await TestUtils.waitUntilTrue(() =>
            (window.open as sinon.SinonStub).called, 5000);
        assert(!!result, 'create should be called when create button clicked');
        assert((window.open as sinon.SinonStub).calledWithExactly(
                  location.origin + '/notebook/new/mock/' + testPath +
                  '?fileName=' + notebookName + '.ipynb&templateName=newNotebook' +
                  '&kernel=' + specs[0].name, '_blank'),
                'window.open should be created with the newNotebook template');
      });

      it('uses the selected kernel name when creating a new notebook', async () => {
        dialog.$.dropdownItems.selected = 1;
        await TestUtils.closeDialog(dialog, true);

        const result = await TestUtils.waitUntilTrue(() =>
            (window.open as sinon.SinonStub).called, 5000);
        assert(!!result, 'create should be called when create button clicked');
        assert((window.open as sinon.SinonStub).calledWithExactly(
                  location.origin + '/notebook/new/mock/' + testPath +
                  '?fileName=' + notebookName + '.ipynb&templateName=newNotebook' +
                  '&kernel=' + specs[1].name, '_blank'),
                'window.open should be created with the newNotebook template');
      });
    });

    it('calls FileManager.create correctly to create a new file', async () => {
      const fileName = 'newMockFile';
      sinon.stub(mockFileManager, 'create');
      testFixture.$.newFileButton.click();
      const dialog = TestUtils.getDialog(InputDialogElement) as InputDialogElement;
      dialog.$.inputBox.value = fileName;
      await TestUtils.closeDialog(dialog, true);

      const result = await TestUtils.waitUntilTrue(() =>
          (mockFileManager.create as sinon.SinonStub).called, 5000);
      assert(!!result, 'create should be called when create button clicked');
      assert((mockFileManager.create as sinon.SinonStub).calledWithExactly(
                DatalabFileType.FILE, testFixture.currentFile.id, fileName),
             'filemanager.create should be created with the new file args');
      (mockFileManager.create as sinon.SinonStub).restore();
    });

    it('calls FileManager.create correctly to create a new directory', async () => {
      const folderName = 'newMockDirectory';
      sinon.stub(mockFileManager, 'create');
      testFixture.$.newFolderButton.click();
      const dialog = TestUtils.getDialog(InputDialogElement) as InputDialogElement;
      dialog.$.inputBox.value = folderName;
      await TestUtils.closeDialog(dialog, true);

      const result = await TestUtils.waitUntilTrue(() =>
          (mockFileManager.create as sinon.SinonStub).called, 5000);
      assert(!!result, 'create should be called when create button clicked');
      assert((mockFileManager.create as sinon.SinonStub).calledWithExactly(
                DatalabFileType.DIRECTORY, testFixture.currentFile.id, folderName),
             'filemanager.create should be created with the new folder args');
      (mockFileManager.create as sinon.SinonStub).restore();
    });

  });
});
