/*
 * Copyright 2014 Google Inc. All rights reserved.
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


import fs = require('fs');
import pathlib = require('path');


/**
 * Manages storage operations backed by a local file system.
 */
export class LocalFileSystemStorage implements app.IStorage {

  _storageRootPath: string;

  /**
   * Constructor.
   *
   * @param storageRootPath The root path within the local filesystem to use for storage.
   */
  constructor(storageRootPath: string) {
    this._storageRootPath = storageRootPath;
  }

  /**
   * Asynchronously opens and reads from the file at the given path.
   *
   * @param path The file system path to read, relative to the root path.
   * @param callback Callback to invoke upon completion of the read operation.
   */
  read(path: string, callback: app.Callback<string>) {
    fs.readFile(this._getAbsolutePath(path), { encoding: 'utf8' }, (error: any, data: string) => {
      if (error) {
        // No file exists at the given path, just leave data undefined for caller to handle
        return callback(error);
      } else {
        return callback(null, data);
      }
    });
  }

  /**
   * Asynchronously writes the given data string to the file referenced by the given path.
   *
   * @param path The file system path to write to, relative to the root path.
   * @param data The data string to write.
   * @param callback Callback to invoke upon completion of the write operation.
   */
  write(path: string, data: string, callback: app.ErrorCallback) {
    fs.writeFile(this._getAbsolutePath(path), data, callback);
  }

  /**
   * Asynchronously deletes the file at the given path.
   *
   * @param path The file system path to write to, relative to the root path.
   * @param callback Callback to invoke upon completion of the write operation.
   */
  delete(path: string, callback: app.ErrorCallback) {
    fs.unlink(path, callback);
  }

  _getAbsolutePath (path: string) {
    return pathlib.join(this._storageRootPath, path);
  }
}
