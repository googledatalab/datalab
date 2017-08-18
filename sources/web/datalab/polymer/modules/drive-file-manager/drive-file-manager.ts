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
    return datalabFile;
  }
  public get(_fileId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('get', this);
  }

  public getContent(_fileId: DatalabFileId, _asText?: boolean): Promise<DatalabContent> {
    throw new UnsupportedMethod('getContent', this);
  }

  public async getRootFile(): Promise<DatalabFile> {
    const upstreamFile = await GapiManager.drive.getRoot();
    return DriveFileManager._upstreamToDriveFile(upstreamFile);
  }

  public saveText(_file: DatalabFile): Promise<DatalabFile> {
    throw new UnsupportedMethod('getRootFile', this);
  }

  public async list(fileId: DatalabFileId): Promise<DatalabFile[]> {
    const queryPredicates = [
      '"' + fileId.path + '" in parents',
      'trashed = false',
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
      'modifiedTime',
      'name',
    ];
    const upstreamFiles =
        await GapiManager.drive.getFiles(fileFields, queryPredicates, orderModifiers);
    // TODO: Check which files are running from the SessionsManager and modify
    // their status accordingly.
    return upstreamFiles.map((file) => DriveFileManager._upstreamToDriveFile(file));
  }

  public create(_fileType: DatalabFileType, _containerId?: DatalabFileId, _name?: string): Promise<DatalabFile> {
    throw new UnsupportedMethod('create', this);
  }

  public rename(_oldFileId: DatalabFileId, _newName: string, _newContainerId?: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('rename', this);
  }

  public delete(_fileId: DatalabFileId): Promise<boolean> {
    throw new UnsupportedMethod('delete', this);
  }

  public copy(_file: DatalabFileId, _destinationDirectoryId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('copy', this);
  }

  public getEditorUrl(): Promise<string> {
    throw new UnsupportedMethod('getEditorUrl', this);
  }

  public getNotebookUrl(): Promise<string> {
    throw new UnsupportedMethod('getNotebookUrl', this);
  }
}
