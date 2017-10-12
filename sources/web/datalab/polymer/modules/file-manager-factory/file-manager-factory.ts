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

enum FileManagerType {
  BIG_QUERY = 'bigquery',
  BIG_QUERY_PUBLIC = 'bigqueryPublic',
  DRIVE = 'drive',
  GITHUB = 'github',
  JUPYTER = 'jupyter',
  MOCK = 'mock',
  SHARED_DRIVE = 'sharedDrive',
  STATIC = 'static',  // For internal use, there is no corresponding FileManager
}

interface FileManagerConfig {
  typeClass: new () => FileManager;
  displayIcon: string;
  displayName: string;
  name: string;
  path: string;
}

/**
 * Maintains and gets the static FileManager singleton.
 */
class FileManagerFactory {

  /**
   * Dependency custom element for ApiManager
   */
  private static _fileManagerConfig = new Map<FileManagerType, FileManagerConfig> ([
    [
      FileManagerType.BIG_QUERY, {
        displayIcon: 'datalab-icons:bigquery-logo',
        displayName: 'BigQuery',
        name: 'bigquery',
        path: 'modules/bigquery-file-manager/bigquery-file-manager.html',
        typeClass: BigQueryFileManager,
      }
    ], [
      FileManagerType.BIG_QUERY_PUBLIC, {
        displayIcon: 'datalab-icons:bigquery-logo',
        displayName: 'Public Datasets',
        name: 'bigqueryPublic',
        path: 'modules/bigquery-file-manager/bigquery-file-manager.html',
        typeClass: BigQueryPublicFileManager,
      }
    ], [
      FileManagerType.DRIVE, {
        displayIcon: 'datalab-icons:drive-logo',
        displayName: 'My Drive',
        name: 'drive',
        path: 'modules/drive-file-manager/drive-file-manager.html',
        typeClass: DriveFileManager,
      }
    ], [
      FileManagerType.GITHUB, {
        displayIcon: 'datalab-icons:github-logo',
        displayName: 'Github',
        name: 'github',
        path: 'modules/github-file-manager/github-file-manager.html',
        typeClass: GithubFileManager,
      }
    ], [
      FileManagerType.JUPYTER, {
        displayIcon: 'datalab-icons:local-disk',
        displayName: 'Local Disk',
        name: 'jupyter',
        path: 'modules/jupyter-file-manager/jupyter-file-manager.html',
        typeClass: JupyterFileManager,
      }
    ], [
      FileManagerType.SHARED_DRIVE, {
        displayIcon: 'folder-shared',
        displayName: 'Shared on Drive',
        name: 'sharedDrive',
        path: 'modules/drive-file-manager/drive-file-manager.html',
        typeClass: SharedDriveFileManager,
      }
    ]
  ]);

  private static _fileManagers: { [fileManagerType: string]: FileManager } = {};

  /** Get the default FileManager. */
  public static getInstance() {
    return FileManagerFactory.getInstanceForType(FileManagerType.JUPYTER);
  }

  public static fileManagerNameToType(name: string): FileManagerType {
    switch (name) {
      case 'bigquery': return FileManagerType.BIG_QUERY;
      case 'bigqueryPublic': return FileManagerType.BIG_QUERY_PUBLIC;
      case 'drive': return FileManagerType.DRIVE;
      case 'github': return FileManagerType.GITHUB;
      case 'jupyter': return FileManagerType.JUPYTER;
      case 'sharedDrive': return FileManagerType.SHARED_DRIVE;
      case 'static': return FileManagerType.STATIC;
      default: throw new Error('Unknown FileManagerType name ' + name);
    }
  }

  // Consider moving this to a strings module
  public static fileManagerTypetoString(type: FileManagerType) {
    return type.toString();
  }

  public static getInstanceForType(fileManagerType: FileManagerType) {
    const config = this.getFileManagerConfig(fileManagerType);
    if (!FileManagerFactory._fileManagers[config.name]) {

      FileManagerFactory._fileManagers[fileManagerType] = new config.typeClass();
    }

    return FileManagerFactory._fileManagers[fileManagerType];
  }

  public static getFileManagerConfig(type: FileManagerType) {
    const config = this._fileManagerConfig.get(type);
    if (!config) {
      throw new Error('Unknown FileManagerType: ' + type.toString());
    }
    return config;
  }

}
