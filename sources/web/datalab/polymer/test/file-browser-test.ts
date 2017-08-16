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

describe('<file-browser>', () => {
  let testFixture: FileBrowserElement;
  const startuppath = new DatalabFileId('testpath', FileManagerType.JUPYTER);

  const mockFiles: DatalabFile[] = [
    {icon: '', id: new DatalabFileId('', FileManagerType.JUPYTER), name: 'file1', type: DatalabFileType.DIRECTORY, status: DatalabFileStatus.IDLE},
    {icon: '', id: new DatalabFileId('', FileManagerType.JUPYTER), name: 'file2', type: DatalabFileType.DIRECTORY, status: DatalabFileStatus.IDLE},
    {icon: '', id: new DatalabFileId('', FileManagerType.JUPYTER), name: 'file3', type: DatalabFileType.DIRECTORY, status: DatalabFileStatus.IDLE},
  ];

  before(() => {
    SettingsManager.getUserSettingsAsync = (forceRefresh: boolean) => {
      assert(forceRefresh === true, 'file-browser should refresh settings on load');
      const mockSettings: common.UserSettings = {
        idleTimeoutInterval: '',
        idleTimeoutShutdownCommand: '',
        oauth2ClientId: '',
        startuppath: startuppath.toQueryString(),
        theme: 'light',
      };
      return Promise.resolve(mockSettings);
    };
    ApiManagerFactory.getInstance().getBasePath = () => {
      return Promise.resolve('');
    };
    const mockFileManager = {
      list: (id: DatalabFileId) => {
        assert(id === startuppath, 'listFilesAsync should be called with the startup path');
        return Promise.resolve(mockFiles);
      },
    } as FileManager;
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
    assert(testFixture.currentDirectory.id === startuppath, 'incorrect startup path');
  });

  it('displays list of files correctly', () => {
    const files: ItemListElement = testFixture.$.files;
    assert(files.rows.length === 3, 'should have three files');

    mockFiles.forEach((file: DatalabFile, i: number) => {
      assert(files.rows[i].firstCol === file.name,
          'mock file ' + i + 'name not shown in first column');
      assert(files.rows[i].icon === Utils.getItemIconString(file.type),
          'mock file ' + i + ' type not shown as icon');
    });
  });

  it('starts up with no files selected, and no files running', () => {
    const files: ItemListElement = testFixture.$.files;
    files.rows.forEach((row: ItemListRow, i: number) => {
      assert(row.secondCol === '', 'file ' + i + 'should have an empty status');
      assert(!row.selected, 'file ' + i + ' should not be selected');
    });
  });
});
