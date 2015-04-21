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

/// <reference path="../common/interfaces.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/node/mkdirp.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node-dir.d.ts" />
import fs = require('fs');
import mkdirp = require('mkdirp');
import nodedir = require('node-dir');
import pathlib = require('path');
import util = require('util'); // FIXME: DEBUG

/**
 * Manages storage operations backed by a local file system.
 */
export class LocalFileSystemStorage implements app.IStorage {

  _fsRootPath: string;

  /**
   * Constructor.
   *
   * @param storageRootPath The root path within the local filesystem to use for storage.
   */
  constructor(storageRootPath: string) {
    // Normalize the root path structure.
    this._fsRootPath = pathlib.join(storageRootPath);
    console.log('fs root path: ', this._fsRootPath);
  }

  /**
   * Asynchronously deletes the file at the given path.
   *
   * @param path The file system path to write to, relative to the root path.
   * @param callback Callback to invoke upon completion of the write operation.
   */
  delete(path: string, callback: app.Callback<void>) {
    // TODO(bryantd): Add support for deleting directories with emptiness check.
    fs.unlink(this._toFileSystemPath(path), callback);
  }

  /**
   * Asynchronously enumerates the resources that match the given path prefix.
   *
   * @param path The directory path for which to enumerate resources.
   * @param recursive Should the listing operation recursively enumerate sub-directories?
   * @param callback Completion callback to invoke.
   */
  list(path: string, recursive: boolean, callback: app.Callback<app.Resource[]>) {
    // Normalize the listing path (directory) to always have a trailing slash.
    var fsListingPath = pathlib.join(this._toFileSystemPath(path), '/');
    console.log('fsListingPath: ', fsListingPath); // FIXME remove

    console.log('storage.list:', util.format('path: "%s", abspath: "%s"', path, fsListingPath)); // FIXME remove
    // Asynchronously enumerate the files and directories matching the given
    nodedir.paths(fsListingPath, (error: Error, paths: NodeDir.Paths) => {
      if (error) {
        callback(error);
        return;
      }
      console.log('listed: ', paths); // FIXME remove

      var resources: app.Resource[] = [];

      // Add file (terminal) resources.
      paths.files.forEach(fsFilepath => {
        var resource = {
          path: this._toStoragePath(fsFilepath),
          isTerminal: true
        };

        if (recursive) {
          // Push all resources regardless of depth in the recursive case.
          resources.push(resource);
        } else {
          console.log(util.format('File filter: "%s" == "%s"', fsListingPath, this._getDirectory(fsFilepath))); // FIXME remove
          // Filter files not within the top-level directory specified by the path if recursive
          // listing is not desired.
          if (fsListingPath == this._getDirectory(fsFilepath)) {
            resources.push(resource);
          }
        }
      });

      // Add directory (non-terminal) resources.
      paths.dirs.forEach(fsDirpath => {
        var resource = {
          path: this._toStoragePath(fsDirpath),
          isTerminal: false
        };

        if (recursive) {
          // Push all resources regardless of depth in the recursive case.
          resources.push(resource);
        } else {
          console.log(util.format('Dir filter: "%s" == "%s"', fsListingPath, this._getDirectory(fsDirpath))); // FIXME remove
          // Filter directories not within the top-level directory specified by the path if
          // recursive listing is not desired.
          if (fsListingPath == this._getDirectory(fsDirpath)) {
            resources.push(resource);
          }
        }
      });

      callback(null, resources);
    });
  }

  move(sourcePath: string, destinationPath: string, callback: app.Callback<void>) {
    fs.rename(
        this._toFileSystemPath(sourcePath),
        this._toFileSystemPath(destinationPath),
        callback);
  }

  /**
   * Asynchronously opens and reads from the file at the given path.
   *
   * @param path The file system path to read, relative to the root path.
   * @param callback Callback to invoke upon completion of the read operation.
   */
  read(path: string, callback: app.Callback<string>) {
    fs.readFile(this._toFileSystemPath(path), { encoding: 'utf8' }, (error: any, data: string) => {
      if (error) {
        // An error code of ENOENT indicates that the specified read failed because the file
        // doesn't exist.
        if (error.code == 'ENOENT') {
          // Return as a non-error state, but pass null to indicate the lack of data.
          return callback(null, null);
        } else {
          // Any other error types are surfaced to the caller.
          return callback(error);
        }
      } else {
        // Successful read. Return the data.
        callback(null, data);
        return;
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
  write(path: string, data: string, callback: app.Callback<void>) {
    fs.writeFile(this._toFileSystemPath(path), data, callback);
  }

  _getDirectory(path: string) {
    // Normalize path to always include a trailing slash for the directory.
    return pathlib.join(pathlib.dirname(path), '/');
  }

  /**
   * Converts the file system path to the corresponding storage path.
   *
   * @param  path The local filesystem path.
   * @return The corresponding storage path..
   */
  _toStoragePath(path: string) {
    console.log(util.format('path trim: "%s" from "%s" => "%s"',
      path, this._fsRootPath, path.slice(this._fsRootPath.length))); // FIXME remove
    return path.slice(this._fsRootPath.length);
  }

  /**
   * Converts the storage path to the corresponding file system path.
   *
   * @param  path The storage path.
   * @return The corresponding local filesystem path.
   */
  _toFileSystemPath(path: string) {
    return pathlib.join(this._fsRootPath, path);
  }
}
