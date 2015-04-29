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
/// <reference path="../../../../../../externs/ts/node/async.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/node/mkdirp.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node-dir.d.ts" />
import async = require('async');
import content = require('./content');
import fs = require('fs');
import mkdirp = require('mkdirp');
import nodedir = require('node-dir');
import pathlib = require('path');

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

    // Asynchronously enumerate the files and directories matching the given
    nodedir.paths(fsListingPath, (error: Error, paths: NodeDir.Paths) => {
      if (error) {
        callback(error);
        return;
      }

      var resources: app.Resource[] = [];

      // Add file (terminal) resources.
      paths.files.forEach(fsFilepath => {
        var resourceStoragePath = this._toStoragePath(fsFilepath);
        var resource = {
          path: resourceStoragePath,
          isDirectory: false,
          description: content.getDescription(resourceStoragePath)
        };

        if (recursive) {
          // Push all resources regardless of depth in the recursive case.
          resources.push(resource);
        } else {
          // Filter files not within the top-level directory specified by the path if recursive
          // listing is not desired.
          if (fsListingPath == this._getDirectory(fsFilepath)) {
            resources.push(resource);
          }
        }
      });

      // Add directory (non-terminal) resources.
      paths.dirs.forEach(fsDirpath => {
        var resourceStoragePath = this._toStoragePath(fsDirpath);
        var resource = {
          path: resourceStoragePath,
          isDirectory: true,
          description: content.getDescription(resourceStoragePath)
        };

        if (recursive) {
          // Push all resources regardless of depth in the recursive case.
          resources.push(resource);
        } else {
          // Filter directories not within the top-level directory specified by the path if
          // recursive listing is not desired.
          if (fsListingPath == this._getDirectory(fsDirpath)) {
            resources.push(resource);
          }
        }
      });

      // Filter non-notebook resources.
      resources = content.selectNotebooks(resources);

      // Asynchronously get the last modified time of the files.
      async.map(resources.map(r => r.path), fs.stat, (error, stats) => {
        if (error) {
          callback(error);
          return;
        }

        stats.forEach((stat, i) => {
          // Populate the last modified timestamp for each resource.
          resources[i].lastModified = stat.mtime.toISOString();
        });

        callback(null, resources);
      });
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
          callback(null, null);
          return;
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
   * @param fsPath The local filesystem path.
   * @return The corresponding storage path..
   */
  _toStoragePath(fsPath: string) {
    return fsPath.slice(this._fsRootPath.length);
  }

  /**
   * Converts the storage path to the corresponding file system path.
   *
   * @param storagePath The storage path.
   * @return The corresponding local filesystem path.
   */
  _toFileSystemPath(storagePath: string) {
    return pathlib.join(this._fsRootPath, storagePath);
  }
}
