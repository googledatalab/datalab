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
 * Dependency custom element for ApiManager
 */
const FILE_MANAGER_ELEMENT = {
  jupyter: {
    path: 'modules/jupyter-file-manager/jupyter-file-manager.html',
    type: JupyterFileManager,
  },
};

/**
 * Maintains and gets the static FileManager singleton.
 */
// TODO: Find a better way to switch the FileManager instance based on the
// environment
class FileManagerFactory {

  private static _fileManager: FileManager;

  public static getInstance() {
    if (!FileManagerFactory._fileManager) {
      const backendType = FileManagerFactory._getBackendType();

      Polymer.importHref(backendType.path, undefined, undefined, true);
      FileManagerFactory._fileManager = new backendType.type();
    }

    return FileManagerFactory._fileManager;
  }

  private static _getBackendType() {
    return FILE_MANAGER_ELEMENT.jupyter;
  }
}

