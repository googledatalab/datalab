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

class JupyterFile extends DatalabFile {
  content: DatalabFile[] | Notebook | string;
  created?: string;
  format: string;
  lastModified?: string;
  mimetype?: string;
  path: string;
  type: string;
  writable?: boolean;
}

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
  public async get(file: DatalabFile, asText?: boolean): Promise<DatalabFile> {
    const jupyterFile = this._castDatalabFileToJupyterFile(file);
    const apiManager = ApiManagerFactory.getInstance();
    if (jupyterFile.path.startsWith('/')) {
      jupyterFile.path = jupyterFile.path.substr(1);
    }
    if (asText === true) {
      jupyterFile.path += '?format=text&type=file';
    }
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return apiManager.sendRequestAsync(
        apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + jupyterFile.path, xhrOptions);
  }

  /**
   * Uploads the given file object to the backend. The file's name, path, format,
   * and content are required fields.
   * @param model object containing file information to send to backend
   */
  public async save(file: DatalabFile) {
    const jupyterFile = this._castDatalabFileToJupyterFile(file);
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PUT',
      parameters: JSON.stringify(jupyterFile),
      successCodes: [200, 201],
    };
    const requestPath =
        apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + jupyterFile.path + '/' + file.name;
    return apiManager.sendRequestAsync(requestPath, xhrOptions);
  }

  /**
   * Returns a list of files at the target path, each implementing the
   * DatalabFile interface. Two requests are made to /api/contents and
   * /api/sessions to get this data.
   * @param path current path to list files under
   */
  public list(container: DatalabFile): Promise<DatalabFile[]> {
    const jupyterContainer = this._castDatalabFileToJupyterFile(container);
    const filesPromise = this.get(jupyterContainer)
      .then((file: JupyterFile) => {
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

  public create(fileType: DatalabFileType, container?: DatalabFile, name?: string) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        ext: 'ipynb',
        type: this._datalabTypeToJupyterType(fileType),
      }),
      successCodes: [201],
    };
    let createPromise = apiManager.sendRequestAsync(apiManager.getServiceUrl(ServiceId.CONTENT),
        xhrOptions);

    // If a path is provided for naming the new item, request the rename, and
    // delete it if failed.
    if (container && name) {
      const jupyterContainer = this._castDatalabFileToJupyterFile(container);
      let notebookPlaceholder: JupyterFile;
      createPromise = createPromise
        .then((notebook: JupyterFile) => {
          notebookPlaceholder = notebook;
          return this.rename(notebookPlaceholder, jupyterContainer.path + '/' + name);
        })
        .catch((error: string) => {
          // If the rename fails, remove the temporary item
          this.delete(notebookPlaceholder);
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
  public rename(oldFile: DatalabFile, name: string, newContainer?: DatalabFile) {
    const jupyterOldFile = this._castDatalabFileToJupyterFile(oldFile);
    const apiManager = ApiManagerFactory.getInstance();
    const oldPath = apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + jupyterOldFile.path;
    let newPath = jupyterOldFile.path + '/' + name;
    if (newContainer) {
      const jupyterNewContainer = this._castDatalabFileToJupyterFile(newContainer);
      newPath = jupyterNewContainer.path + '/' + name;
    }
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PATCH',
      parameters: JSON.stringify({
        path: newPath
      }),
    };

    return apiManager.sendRequestAsync(oldPath, xhrOptions);
  }

  public delete(file: DatalabFile) {
    const jupyterfile = this._castDatalabFileToJupyterFile(file);
    const apiManager = ApiManagerFactory.getInstance();
    const path = apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + jupyterfile.path;
    const xhrOptions: XhrOptions = {
      failureCodes: [400],
      method: 'DELETE',
      successCodes: [204],
    };

    return apiManager.sendRequestAsync(path, xhrOptions);
  }

  public copy(file: DatalabFile, destinationDirectory: DatalabFile) {
    const jupyterfile = this._castDatalabFileToJupyterFile(file);
    const jupyterDestination = this._castDatalabFileToJupyterFile(destinationDirectory);
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        copy_from: jupyterfile.path,
      }),
      successCodes: [201],
    };

    return apiManager.sendRequestAsync(jupyterDestination.path, xhrOptions);
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

  private _castDatalabFileToJupyterFile(file: DatalabFile): JupyterFile {
    const jupyterFile = file as JupyterFile;
    for (const k in JupyterFile) {
      if (!(k in jupyterFile)) {
        throw new Error('Property ' + k + ' not found in file');
      }
    }
    return jupyterFile;
  }
}
