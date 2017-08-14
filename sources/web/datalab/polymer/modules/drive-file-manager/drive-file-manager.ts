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

/**
 * This file contains a collection of functions that call the Google Drive APIs, and are
 * wrapped in the ApiManager class.
 */

/**
 * An Google Drive specific file manager.
 */
class DriveFileManager implements FileManager {

  private _loadPromise: Promise<any>;

  constructor() {
    this._loadPromise = GapiManager.grantScope(GapiScopes.DRIVE);
  }

  public async get(path: string, asText?: boolean): Promise<DatalabFile> {
    const apiManager = ApiManagerFactory.getInstance();
    if (path.startsWith('/')) {
      path = path.substr(1);
    }
    if (asText === true) {
      path += '?format=text&type=file';
    }
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return apiManager.sendRequestAsync(apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + path,
                                       xhrOptions) as Promise<DatalabFile>;
  }

  public async save(file: DatalabFile) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PUT',
      parameters: JSON.stringify(file),
      successCodes: [200, 201],
    };
    const requestPath =
        apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + file.path + '/' + file.name;
    return apiManager.sendRequestAsync(requestPath, xhrOptions);
  }

  public async list(path: string): Promise<DatalabFile[]> {
    if (!path) {
      path = 'root';
    }
    const filesPromise = GapiManager.getDriveFiles(path + 'in parents');

    const sessionsPromise: Promise<Session[]> = SessionManager.listSessionsAsync();

    // Combine the return values of the two requests to supplement the files
    // array with the status value.
    return Promise.all([filesPromise, sessionsPromise])
      .then((values) => {
        const files = values[0];
        const sessions = values[1];
        const runningPaths: string[] = [];
        sessions.forEach((session: Session) => {
          runningPaths.push(session.notebook.path);
        });
        const datalabFiles: DatalabFile[] = [];
        files.forEach((file: any) => {
          const datalabFile = this._driveFileToDatalabFile(file);
          if (runningPaths.indexOf(file.path) > -1) {
            datalabFile.status = DatalabFileStatus.RUNNING;
          } else {
            datalabFile.status = DatalabFileStatus.IDLE;
          }
          datalabFiles.push(datalabFile);
        });
        return datalabFiles;
      });
  }

  public create(itemType: DatalabFileType, path?: string) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        ext: 'ipynb',
        type: itemType,
      }),
      successCodes: [201],
    };
    let createPromise = apiManager.sendRequestAsync(apiManager.getServiceUrl(ServiceId.CONTENT),
        xhrOptions);

    // If a path is provided for naming the new item, request the rename, and
    // delete it if failed.
    if (path) {
      let notebookPathPlaceholder = '';
      createPromise = createPromise
        .then((notebook: DatalabFile) => {
          notebookPathPlaceholder = notebook.path;
          return this.rename(notebookPathPlaceholder, path);
        })
        .catch((error: string) => {
          // If the rename fails, remove the temporary item
          this.delete(notebookPathPlaceholder);
          throw error;
        });
    }
    return createPromise;
  }

  public rename(oldPath: string, newPath: string) {
    const apiManager = ApiManagerFactory.getInstance();
    oldPath = apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + oldPath;
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PATCH',
      parameters: JSON.stringify({
        path: newPath
      }),
    };

    return apiManager.sendRequestAsync(oldPath, xhrOptions);
  }

  public delete(path: string) {
    const apiManager = ApiManagerFactory.getInstance();
    path = apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + path;
    const xhrOptions: XhrOptions = {
      failureCodes: [400],
      method: 'DELETE',
      successCodes: [204],
    };

    return apiManager.sendRequestAsync(path, xhrOptions);
  }

  public copy(itemPath: string, destinationDirectory: string) {
    const apiManager = ApiManagerFactory.getInstance();
    destinationDirectory = apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + destinationDirectory;
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        copy_from: itemPath
      }),
      successCodes: [201],
    };

    return apiManager.sendRequestAsync(destinationDirectory, xhrOptions);
  }

  private _driveFileToDatalabFile(file: gapi.client.drive.File) {
    const datalabFile: DatalabFile = {
      content: '',
      created: '',
      format: '',
      last_modified: file.modifiedTime.toISOString(),
      mimetype: file.mimeType,
      name: file.name,
      path: file.parents ? file.parents[0] : '',
      status: DatalabFileStatus.IDLE,
      type: file.mimeType === 'application/vnd.google-apps.folder' ?
                              DatalabFileType.DIRECTORY :
                              DatalabFileType.FILE,
      writable: true,
    };
    return datalabFile;
  }
}
