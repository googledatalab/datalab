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

describe('<datalab-files>', () => {
  let testFixture: FilesElement;
  const startuppath = 'testpath';

  const mockFiles: ApiFile[] = [
    {content: '', format: '', name: 'file1', path: '/', type: 'directory', status: ''},
    {content: '', format: '', name: 'file2', path: '/', type: 'directory', status: ''},
    {content: '', format: '', name: 'file3', path: '/', type: 'directory', status: ''},
  ];

  before(() => {
    SettingsManager.getUserSettingsAsync = (forceRefresh: boolean) => {
      assert(forceRefresh === true, 'datalab-files should refresh settings on load');
      const mockSettings: common.UserSettings = {
        idleTimeoutInterval: '',
        idleTimeoutShutdownCommand: '',
        oauth2ClientId: '',
        startuppath,
        theme: 'light',
      };
      return Promise.resolve(mockSettings);
    };
    ApiManager.getBasePath = () => {
      return Promise.resolve('');
    };
    ApiManager.listFilesAsync = (path: string) => {
      assert(path === startuppath, 'listFilesAsync should be called with the startup path');
      return Promise.resolve(mockFiles);
    };
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
    assert(testFixture.currentPath === startuppath, 'incorrect startup path');
  });

  it('displays list of files correctly', () => {
    const files: ItemListElement = testFixture.$.files;
    assert(files.rows.length === 3, 'should have three files');

    mockFiles.forEach((file: ApiFile, i: number) => {
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
