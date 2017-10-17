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

  public getPreviewName(): string {
    const superPreview = super.getPreviewName();
    if (superPreview) {
      return superPreview;
    }
    if (this.mimetype && (
        this.mimetype.indexOf('text/') > -1 ||
        this.mimetype.indexOf('application/json') > -1
    )) {
      return 'text';
    }
    return '';
  }
}

/**
 * An Jupyter-specific file manager.
 */
class JupyterFileManager extends BaseFileManager {

  /**
   * Converts the given JupyterFile into the type understood by the Jupyter
   * backend.
   */
  private static _toUpstreamObject(file: JupyterFile, content: any) {
    const jupyterFile = {
      content,
      created: file.created,
      format: file.format,
      last_modified: file.lastModified,
      mimetype: file.mimetype,
      name: file.name,
      path: file.path,
      type: this._datalabTypeToUpstreamType(file.type),
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

  private static _upstreamTypeToDatalabType(type: string) {
    switch (type) {
      case 'directory': return DatalabFileType.DIRECTORY;
      case 'file': return DatalabFileType.FILE;
      case 'notebook': return DatalabFileType.NOTEBOOK;
      default: throw new Error('Unknown upstream file type: ' + type);
    }
  }

  private static _datalabTypeToUpstreamType(type: DatalabFileType) {
    switch (type) {
      case DatalabFileType.DIRECTORY: return 'directory';
      case DatalabFileType.FILE: return 'file';
      case DatalabFileType.NOTEBOOK: return 'notebook';
      default: throw new Error('Unknown upstream file type: ' + type);
    }
  }

  /**
   * Converts an object fetched from the Jupyter backend into a JupyterFile.
   */
  private static _upstreamFileToJupyterFile(file: any) {
    const jupyterFile = new JupyterFile();
    jupyterFile.created = file.created;
    jupyterFile.format = file.format;
    jupyterFile.type = JupyterFileManager._upstreamTypeToDatalabType(file.type);
    jupyterFile.icon = Utils.getItemIconString(jupyterFile.type);
    jupyterFile.id = new DatalabFileId(file.path, FileManagerType.JUPYTER);
    jupyterFile.lastModified = file.last_modified;
    jupyterFile.mimetype = file.mimetype;
    jupyterFile.name = file.name;
    jupyterFile.path = file.path;
    jupyterFile.writable = file.writable;
    return jupyterFile;
  }

  private static _getParentDir(path: string) {
    const end = path.indexOf('/') > -1 ? path.lastIndexOf('/') : 0;
    return path.substr(0, end);
  }

  public async get(fileId: DatalabFileId) {
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return ApiManager.sendRequestAsync(
        ApiManager.getServiceUrl(ServiceId.CONTENT) + '/' + fileId.path, xhrOptions)
      .then((file: any) => JupyterFileManager._upstreamFileToJupyterFile(file));
  }

  public async getStringContent(fileId: DatalabFileId, asText?: boolean): Promise<string> {
    if (asText === true) {
      fileId.path += '?format=text&type=file';
    }
    const upstreamFile = await this._getFileWithContent(fileId.path);
    if (upstreamFile.type === 'file') {
      return upstreamFile.content;
    } else {
      return JSON.stringify(upstreamFile.content);
    }
  }

  public async getRootFile() {
    return this.get(new DatalabFileId('/', FileManagerType.JUPYTER));
  }

  public async saveText(file: JupyterFile, content: string) {
    if (!file.mimetype) {
      file.mimetype = 'plain/text';
    }
    if (!file.format) {
      file.format = 'text';
    }
    file.lastModified = new Date().toISOString();
    let parsedContent: any = content;
    if (file.type === DatalabFileType.NOTEBOOK) {
      try {
        parsedContent = JSON.parse(content);
      } catch (e) {
        Utils.showErrorDialog('Invalid JSON', 'Error parsing JSON, cannot save notebook.');
        throw e;
      }
    }

    const upstreamFile = JupyterFileManager._toUpstreamObject(file, parsedContent);
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PUT',
      parameters: JSON.stringify(upstreamFile),
      successCodes: [200, 201],
    };
    const requestPath =
        ApiManager.getServiceUrl(ServiceId.CONTENT) + '/' + file.id.path;
    return ApiManager.sendRequestAsync(requestPath, xhrOptions)
      .then((savedFile: any) => JupyterFileManager._upstreamFileToJupyterFile(savedFile));
  }

  public async list(containerId: DatalabFileId): Promise<DatalabFile[]> {
    const container = await this._getFileWithContent(containerId.path);
    if (container.type !== 'directory') {
      throw new Error('Can only list files in a directory. Found type: ' +
          typeof(container.type));
    }

    const files = container.content;
    return files.map((file: any) => JupyterFileManager._upstreamFileToJupyterFile(file));
  }

  public create(fileType: DatalabFileType, containerId?: DatalabFileId, name?: string) {
    const jupyterFile = new JupyterFile();
    jupyterFile.created = new Date().toISOString();
    jupyterFile.format = 'text';
    jupyterFile.lastModified = jupyterFile.created;
    jupyterFile.mimetype = 'text/plain';
    jupyterFile.name = name || 'New item';
    jupyterFile.path = containerId ? containerId.path : '';
    jupyterFile.type = fileType;
    jupyterFile.writable = true;
    const upstreamFile = JupyterFileManager._toUpstreamObject(jupyterFile, '');
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        ext: 'ipynb',
        ...upstreamFile,
      }),
      successCodes: [201],
    };
    let createPromise = ApiManager.sendRequestAsync(ApiManager.getServiceUrl(ServiceId.CONTENT),
        xhrOptions)
      .then((file) => JupyterFileManager._upstreamFileToJupyterFile(file));

    // If a path is provided for naming the new item, request the rename, and
    // delete it if failed.
    if (containerId && name) {
      let notebookPlaceholder: DatalabFileId;
      createPromise = createPromise
        .then((notebook: JupyterFile) => {
          notebookPlaceholder = new DatalabFileId(notebook.path, FileManagerType.JUPYTER);
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
    const oldPath = ApiManager.getServiceUrl(ServiceId.CONTENT) + '/' + oldFileId.path;
    let newPath = newContainerId ?
        newContainerId.path : JupyterFileManager._getParentDir(oldFileId.path);
    newPath += '/' + newName;
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PATCH',
      parameters: JSON.stringify({
        path: newPath
      }),
    };

    return ApiManager.sendRequestAsync(oldPath, xhrOptions)
      .then((file) => JupyterFileManager._upstreamFileToJupyterFile(file));
  }

  public delete(fileId: DatalabFileId) {
    const path = ApiManager.getServiceUrl(ServiceId.CONTENT) + '/' + fileId.path;
    const xhrOptions: XhrOptions = {
      failureCodes: [400],
      method: 'DELETE',
      successCodes: [204],
    };

    return ApiManager.sendRequestAsync(path, xhrOptions);
  }

  public copy(fileId: DatalabFileId, destinationDirectoryId: DatalabFileId) {
    const path = ApiManager.getServiceUrl(ServiceId.CONTENT) + '/' + destinationDirectoryId.path;
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        copy_from: fileId.path,
      }),
      successCodes: [201],
    };

    return ApiManager.sendRequestAsync(path, xhrOptions);
  }

  public getNotebookUrl(fileId: DatalabFileId) {
    // TODO: We will need to get the base path when loading files
    // from a VM running Datalab with Jupyter.
    return Utils.getHostRoot() + '/notebooks/' + fileId.path;
  }

  public pathToPathHistory(path: string): DatalabFile[] {
    // For backward compatibility with the current path format.
    if (path.startsWith('/tree/')) {
      path = path.substr('/tree/'.length);
    }
    const tokens = path.split('/').filter((p) => !!p);
    const pathHistory = tokens.map((token, i) => {
      const f = new JupyterFile();
      f.path = tokens.slice(0, i + 1).join('/');
      f.name = token;
      f.id = new DatalabFileId(f.path, FileManagerType.JUPYTER);
      return f;
    });
    return pathHistory;
  }

  private _getFileWithContent(fileId: string) {
    if (fileId.startsWith('/')) {
      fileId = fileId.substr(1);
    }
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return ApiManager.sendRequestAsync(
        ApiManager.getServiceUrl(ServiceId.CONTENT) + '/' + fileId, xhrOptions);
  }
}
