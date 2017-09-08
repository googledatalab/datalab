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

class MockFileManager implements FileManager {
  public get(_fileId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('get', this);
  }
  public getStringContent(_fileId: DatalabFileId, _asText?: boolean): Promise<string> {
    throw new UnsupportedMethod('getContent', this);
  }
  public async getRootFile() {
    const file: DatalabFile = {
      icon: '/',
      id: new DatalabFileId('/', FileManagerType.JUPYTER),
      name: 'root',
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile;
    return file;
  }
  public saveText(_file: DatalabFile, _content: string): Promise<DatalabFile> {
    throw new UnsupportedMethod('saveText', this);
  }
  public list(_containerId: DatalabFileId): Promise<DatalabFile[]> {
    throw new UnsupportedMethod('list', this);
  }
  public create(_fileType: DatalabFileType, _containerId: DatalabFileId, _name: string):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('create', this);
  }
  public rename(_oldFileId: DatalabFileId, _name: string, _newContainerId?: DatalabFileId):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('rename', this);
  }
  public delete(_fileId: DatalabFileId): Promise<boolean> {
    throw new UnsupportedMethod('delete', this);
  }
  public copy(_fileId: DatalabFileId, _destinationDirectoryId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('copy', this);
  }
  public getNotebookUrl(_fileId: DatalabFileId): Promise<string> {
    throw new UnsupportedMethod('getNotebookUrl', this);
  }
  public getEditorUrl(_fileId: DatalabFileId): Promise<string> {
    throw new UnsupportedMethod('getEditorUrl', this);
  }
  public pathToPathHistory(path: string): DatalabFile[] {
    const datalabFile = {
      id: new DatalabFileId(path, FileManagerType.JUPYTER),
    } as DatalabFile;
    return [datalabFile];
  }
}

describe('<file-browser>', () => {
  let testFixture: FileBrowserElement;
  const startuppath = new DatalabFileId('testpath', FileManagerType.JUPYTER);

  const mockFiles: DatalabFile[] = [{
      icon: '',
      id: new DatalabFileId('', FileManagerType.JUPYTER),
      name: 'file1',
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile,
    {
      icon: '',
      id: new DatalabFileId('', FileManagerType.JUPYTER),
      name: 'file2',
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile,
    {
      icon: '',
      id: new DatalabFileId('', FileManagerType.JUPYTER),
      name: 'file3',
      status: DatalabFileStatus.RUNNING,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile,
  ];

  before(() => {
    SettingsManager.getUserSettingsAsync = (forceRefresh: boolean) => {
      assert(forceRefresh === true, 'file-browser should refresh settings on load');
      const mockSettings: common.UserSettings = {
        idleTimeoutInterval: '',
        idleTimeoutShutdownCommand: '',
        oauth2ClientId: '',
        startuppath: startuppath.path,
        theme: 'light',
      };
      return Promise.resolve(mockSettings);
    };
    ApiManagerFactory.getInstance().getBasePath = () => {
      return Promise.resolve('');
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

  it('starts up with no files selected, and no files running', () => {
    const files: ItemListElement = testFixture.$.files;
    files.rows.forEach((row: ItemListRow, i: number) => {
      assert(row.columns[1] === Utils.getFileStatusString(mockFiles[i].status as DatalabFileStatus),
          'file ' + i + 'should have an empty status');
      assert(!row.selected, 'file ' + i + ' should not be selected');
    });
  });
});
