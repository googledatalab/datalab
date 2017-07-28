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

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../node_modules/@types/sinon/index.d.ts" />
/// <reference path="../components/datalab-files/datalab-files.ts" />

describe('<datalab-files>', () => {
  let testFixture: FilesElement;
  const startuppath = 'testpath';
  const basepath = 'basepath';

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
      return Promise.resolve(basepath);
    };
    ApiManager.listFilesAsync = (path: string) => {
      assert(path === basepath + '/' + startuppath,
          'listFilesAsync should be called with the base path and startup path');
      const files: ApiFile[] = [
        {content: '', format: '', name: 'file1', path: '/', type: 'folder', status: ''},
        {content: '', format: '', name: 'file2', path: '/', type: 'folder', status: ''},
        {content: '', format: '', name: 'file3', path: '/', type: 'folder', status: ''},
      ];
      return Promise.resolve(files);
    };
  });

  beforeEach((done: () => any) => {
    testFixture = fixture('files-fixture');
    testFixture.ready()
      .then(() => done());
  });

  it('displays list of files correctly', () => {
    Polymer.dom.flush();
    assert(testFixture.fileList.length === 3, 'should have three files');
    debugger;
  });
});
