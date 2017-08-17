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
 * This file contains a collection of functions that call the Jupyter server APIs, and are
 * wrapped in the ApiManager class. It also defines a set of interfaces to interact with
 * these APIs to help with type checking.
 */

/**
 * An Jupyter-specific file manager.
 */
class JupyterFileManager implements FileManager {

  /**
   * Returns a DatalabFile object representing the file or directory requested
   * @param path string path to requested file
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
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

  /**
   * Uploads the given file object to the backend. The file's name, path, format,
   * and content are required fields.
   * @param model object containing file information to send to backend
   */
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

  /**
   * Returns a list of files at the target path, each implementing the
   * DatalabFile interface. Two requests are made to /api/contents and
   * /api/sessions to get this data.
   * @param path current path to list files under
   */
  public list(path: string): Promise<DatalabFile[]> {
    const filesPromise = this.get(path)
      .then((file: any) => {
        if (file.type !== 'directory') {
          throw new Error('Can only list files in a directory. Found type: ' + file.type);
        }
        return file.content as DatalabFile[];
      });

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
        files.forEach((file: any) => {
          if (runningPaths.indexOf(file.path) > -1) {
            file.status = DatalabFileStatus.RUNNING;
          } else {
            file.status = DatalabFileStatus.IDLE;
          }
          file.type = this._jupyterTypeToDatalabType(file.type);
        });
        return files as DatalabFile[];
      });
  }

  /**
   * Creates a new notebook or directory.
   * @param itemType type of the created item, can be 'notebook' or 'directory'
   */
  public create(itemType: DatalabFileType, path?: string) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        ext: 'ipynb',
        type: this._datalabTypeToJupyterType(itemType),
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

  /**
   * Renames an item
   * @param oldPath source path of the existing item
   * @param newPath destination path of the renamed item
   */
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

  /**
   * Deletes an item
   * @param path item path to delete
   */
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

  /*
   * Copies an item from source to destination. Item name collisions at the destination
   * are handled by Jupyter.
   * @param itemPath path to copied item
   * @param destinationDirectory directory to copy the item into
   */
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

  private _datalabTypeToJupyterType(type: DatalabFileType) {
    switch (type) {
      case DatalabFileType.DIRECTORY:
        return 'directory';
      case DatalabFileType.NOTEBOOK:
        return 'notebook';
      case DatalabFileType.FILE:
        return 'file';
      default:
        throw new Error('Unknown file type: ' + type);
    }
  }

  private _jupyterTypeToDatalabType(type: string) {
    switch (type) {
      case 'directory':
        return DatalabFileType.DIRECTORY;
      case 'notebook':
        return DatalabFileType.NOTEBOOK;
      case 'file':
        return DatalabFileType.FILE;
      default:
        throw new Error('Unknown jupyter file type: ' + type);
    }
  }
}
