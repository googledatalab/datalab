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
  created?: string;
  format: string;
  lastModified?: string;
  mimetype?: string;
  path: string;
  writable?: boolean;
}

/**
 * An Jupyter-specific file manager.
 */
class JupyterFileManager implements FileManager {

  private static _toUpstreamType(file: JupyterFile, content: string) {
    const jupyterFile = {
      content,
      created: file.created,
      format: file.format,
      last_modified: file.lastModified,
      mimetype: file.mimetype,
      name: file.name,
      path: file.path,
      type: '',
    };
    switch (file.type) {
      case DatalabFileType.DIRECTORY:
        jupyterFile.type = 'directory';
        break;
      case DatalabFileType.FILE:
        jupyterFile.type = 'file';
        break;
      case DatalabFileType.NOTEBOOK:
        jupyterFile.type = 'notebook';
        break;
      default:
        throw new Error('Unknown jupyter file type: ' + file.type);
    }

    return jupyterFile;
  }

  public async get(fileId: DatalabFileId) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return apiManager.sendRequestAsync(
        apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + fileId.path, xhrOptions);
  }

  public async getContent(fileId: DatalabFileId, asText?: boolean): Promise<DatalabFileContent> {
    const apiManager = ApiManagerFactory.getInstance();
    if (fileId.path.startsWith('/')) {
      fileId.path = fileId.path.substr(1);
    }
    if (asText === true) {
      fileId.path += '?format=text&type=file';
    }
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    const upstreamFile = await apiManager.sendRequestAsync(
        apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + fileId.path, xhrOptions);
    switch (upstreamFile.type) {
      case 'directory':
        return new DirectoryContent(upstreamFile.content);
      case 'file':
        return new TextContent(upstreamFile.content);
      case 'notebook':
        return new NotebookContent(upstreamFile.content.cells, upstreamFile.content.metadata,
            upstreamFile.content.nbformat, upstreamFile.content.nbformat_minor);
      default:
        throw new Error('Unknown Jupyter file type: ' + upstreamFile.type);
    }
  }

  public async getRootFile() {
    return this.get(new DatalabFileId('/', FileManagerType.JUPYTER));
  }

  public async saveText(file: JupyterFile, content: string) {
    const apiManager = ApiManagerFactory.getInstance();
    const upstreamFile = JupyterFileManager._toUpstreamType(file, content);
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PUT',
      parameters: JSON.stringify(upstreamFile),
      successCodes: [200, 201],
    };
    const requestPath =
        apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + file.path + '/' + file.name;
    return apiManager.sendRequestAsync(requestPath, xhrOptions);
  }

  public list(containerId: DatalabFileId): Promise<DatalabFile[]> {
    const filesPromise = this.get(containerId)
      .then((file: any) => {
        if (file.type !== 'directory') {
          throw new Error('Can only list files in a directory. Found type: ' + file.type);
        }
        return file.content as JupyterFile[];
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
        files.forEach((file: JupyterFile) => {
          if (runningPaths.indexOf(file.path) > -1) {
            file.status = DatalabFileStatus.RUNNING;
          } else {
            file.status = DatalabFileStatus.IDLE;
          }
        });
        return files as DatalabFile[];
      });
  }

  public create(fileType: DatalabFileType, containerId?: DatalabFileId, name?: string) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        ext: 'ipynb',
        type: fileType,
      }),
      successCodes: [201],
    };
    let createPromise = apiManager.sendRequestAsync(apiManager.getServiceUrl(ServiceId.CONTENT),
        xhrOptions);

    // If a path is provided for naming the new item, request the rename, and
    // delete it if failed.
    if (containerId && name) {
      let notebookPlaceholder: DatalabFileId;
      createPromise = createPromise
        .then((notebook: JupyterFile) => {
          notebookPlaceholder = notebook.id as DatalabFileId;
          return this.rename(notebookPlaceholder, containerId.path + '/' + name);
        })
        .catch((error: string) => {
          // If the rename fails, remove the temporary item
          this.delete(notebookPlaceholder);
          throw error;
        });
    }
    return createPromise;
  }

  public rename(oldFileId: DatalabFileId, newName: string, newContainerId?: DatalabFileId) {
    const apiManager = ApiManagerFactory.getInstance();
    const oldPath = apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + oldFileId.path;
    let newPath = newContainerId ? newContainerId.path : oldFileId.path;
    newPath += '/' + newName;
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PATCH',
      parameters: JSON.stringify({
        path: newPath
      }),
    };

    return apiManager.sendRequestAsync(oldPath, xhrOptions);
  }

  public delete(fileId: DatalabFileId) {
    const apiManager = ApiManagerFactory.getInstance();
    const path = apiManager.getServiceUrl(ServiceId.CONTENT) + '/' + fileId.path;
    const xhrOptions: XhrOptions = {
      failureCodes: [400],
      method: 'DELETE',
      successCodes: [204],
    };

    return apiManager.sendRequestAsync(path, xhrOptions);
  }

  public copy(fileId: DatalabFileId, destinationDirectoryId: DatalabFileId) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        copy_from: fileId.path,
      }),
      successCodes: [201],
    };

    return apiManager.sendRequestAsync(destinationDirectoryId.path, xhrOptions);
  }

  public async getNotebookUrl(fileId: DatalabFileId) {
    // Notebooks that are stored on the VM require the basepath.
    const apiManager = ApiManagerFactory.getInstance();
    const basepath = await apiManager.getBasePath();
    return location.protocol + '//' + location.host + basepath + '/notebooks/' + fileId.path;
  }

  public async getEditorUrl(fileId: DatalabFileId) {
    // Files that are stored on the VM require the basepath.
    const apiManager = ApiManagerFactory.getInstance();
    const basepath = await apiManager.getBasePath();
    return location.protocol + '//' + location.host + basepath + '/editor?file=' +
        fileId.toQueryString();
  }
}
