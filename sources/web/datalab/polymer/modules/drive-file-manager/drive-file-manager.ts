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

class DriveFile extends DatalabFile {
}

/**
 * An Google Drive specific file manager.
 */
class DriveFileManager implements FileManager {

  private static readonly _directoryMimeType = 'application/vnd.google-apps.folder';
  private static readonly _notebookMimeType = 'application/json';

  private static _upstreamToDriveFile(file: gapi.client.drive.File) {
    const datalabFile: DriveFile = new DriveFile({
      icon: file.iconLink,
      id: new DatalabFileId(file.id, FileManagerType.DRIVE),
      name: file.name,
      status: DatalabFileStatus.IDLE,
      type: file.mimeType === DriveFileManager._directoryMimeType ?
                              DatalabFileType.DIRECTORY :
                              DatalabFileType.FILE,
    } as DatalabFile);
    if (datalabFile.name.endsWith('.ipynb')) {
      datalabFile.type = DatalabFileType.NOTEBOOK;
    }
    return datalabFile;
  }
  public async get(fileId: DatalabFileId): Promise<DatalabFile> {
    const upstreamFile = await GapiManager.drive.getFile(fileId.path);
    return DriveFileManager._upstreamToDriveFile(upstreamFile);
  }

  public async getStringContent(fileId: DatalabFileId, _asText?: boolean): Promise<string> {
    const [, content] = await GapiManager.drive.getFileWithContent(fileId.path);
    if (content === null) {
      throw new Error('Could not download file: ' + fileId.toQueryString());
    }
    return content;
  }

  public async getRootFile(): Promise<DatalabFile> {
    const upstreamFile = await GapiManager.drive.getRoot();
    return DriveFileManager._upstreamToDriveFile(upstreamFile);
  }

  public saveText(file: DatalabFile, text: string): Promise<DatalabFile> {
    return GapiManager.drive.patchContent(file.id.path, text)
      .then((upstreamFile) => DriveFileManager._upstreamToDriveFile(upstreamFile));
  }

  public async list(fileId: DatalabFileId): Promise<DatalabFile[]> {
    const whitelistFilePredicates = [
      'name contains \'.ipynb\'',
      'name contains \'.txt\'',
      'mimeType = \'' + DriveFileManager._directoryMimeType + '\'',
    ];
    const queryPredicates = [
      '"' + fileId.path + '" in parents',
      'trashed = false',
      '(' + whitelistFilePredicates.join(' or ') + ')',
    ];
    const fileFields = [
      'createdTime',
      'iconLink',
      'id',
      'mimeType',
      'modifiedTime',
      'name',
      'parents',
    ];
    const orderModifiers = [
      'folder',
      'modifiedTime desc',
      'name',
    ];
    const upstreamFiles =
        await GapiManager.drive.listFiles(fileFields, queryPredicates, orderModifiers);
    // TODO: Check which files are running from the SessionsManager and modify
    // their status accordingly.
    return upstreamFiles.map((file) => DriveFileManager._upstreamToDriveFile(file));
  }

  public async create(fileType: DatalabFileType, containerId?: DatalabFileId, name?: string)
      : Promise<DatalabFile> {
    let mimeType: string;
    switch (fileType) {
      case DatalabFileType.DIRECTORY:
        mimeType = DriveFileManager._directoryMimeType; break;
      case DatalabFileType.NOTEBOOK:
        mimeType = DriveFileManager._notebookMimeType; break;
      default:
        mimeType = 'text/plain';
    }
    const content = fileType === DatalabFileType.NOTEBOOK ?
        NotebookContent.EMPTY_NOTEBOOK_CONTENT : '';
    const upstreamFile = await GapiManager.drive.create(mimeType,
                                                        containerId ? containerId.path : 'root',
                                                        name || 'New Item',
                                                        content);
    return DriveFileManager._upstreamToDriveFile(upstreamFile);
  }

  public rename(oldFileId: DatalabFileId, newName: string, newContainerId?: DatalabFileId)
      : Promise<DatalabFile> {
    const newContainerPath = newContainerId ? newContainerId.path : undefined;
    return GapiManager.drive.renameFile(oldFileId.path, newName, newContainerPath)
      .then((upstreamFile) => DriveFileManager._upstreamToDriveFile(upstreamFile));
  }

  public delete(fileId: DatalabFileId): Promise<boolean> {
    return GapiManager.drive.deleteFile(fileId.path)
      .then(() => true, () => false);
  }

  public copy(file: DatalabFileId, destinationDirectoryId: DatalabFileId): Promise<DatalabFile> {
    return GapiManager.drive.copy(file.path, destinationDirectoryId.path)
      .then((upstreamFile) => DriveFileManager._upstreamToDriveFile(upstreamFile));
  }

  public async getEditorUrl(fileId: DatalabFileId) {
    return Utils.getHostRoot() + '/editor?file=' + fileId.toQueryString();
  }

  public async getNotebookUrl(fileId: DatalabFileId): Promise<string> {
    return location.protocol + '//' + location.host +
        '/notebook?file=' + fileId.toQueryString();
  }

  public pathToPathHistory(path: string): DatalabFile[] {
    if (path == '') {
      return [];
    } else {
      // TODO - create the real path to this object, or figure out
      // a better way to handle not having the full path in the breadcrumbs
      const fileId = path;  // We assume the entire path is one fileId
      const datalabFile: DriveFile = new DriveFile({
        id: new DatalabFileId(fileId, FileManagerType.DRIVE),
      } as DatalabFile);
      return [datalabFile];
    }
  }
}
