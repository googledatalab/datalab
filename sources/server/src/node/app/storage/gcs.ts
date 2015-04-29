/*
 * Copyright 2015 Google Inc. All rights reserved.
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
/// <reference path="../../../../../../externs/ts/node/gcloud.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
import content = require('./content');
import gcloud = require('gcloud');
import pathlib = require('path');
import util = require('util');


/**
 * Manages storage operations backed by Google Cloud Storage (GCS).
 */
export class GoogleCloudStorage implements app.IStorage {

  _bucket: GCloud.Storage.Bucket;

  /**
   * Constructor.
   *
   * @param bucket The gcloud bucket client to use for accessing storage.
   */
  constructor(bucket: GCloud.Storage.Bucket) {
    this._bucket = bucket;
  }

  /**
   * Asynchronously deletes the GCS object at the given path.
   *
   * @param path The file system path to write to, relative to the root path.
   * @param callback Callback to invoke upon completion of the write operation.
   */
  delete(path: string, callback: app.Callback<void>) {
    var file = this._bucket.file(this._toGcsPath(path));
    file.delete(callback);
  }

  /**
   * Asynchronously enumerates the resources that match the given directory path.
   *
   * @param directoryPath The storage path for which to enumerate resources.
   * @param recursive Should the listing operation recursively enumerate sub-directories?
   * @param callback Completion callback to invoke.
   */
  list(directoryPath: string, recursive: boolean, callback: app.Callback<app.Resource[]>) {
    // TODO(bryantd): Use the query.delimiter = '/' setting to fetch both files and sub-directories
    // in the non-recursive case to avoid needing to list the entire bucket and filter client side.
    // Depends upon gcloud-node adding support for this GCS "common prefixes" feature.
    var query: GCloud.Storage.Query = {
      prefix: this._toGcsPath(directoryPath)
    };

    this._bucket.getFiles(query, (error, files, nextPageToken) => {
      if (error) {
        callback(error);
        return;
      }

      // TODO(bryantd): add support for paging within the list API eventually via nextQuery GCS
      // token. For now, truncate the listing response to the first page of results from GCS to
      // avoid returning a response with unbounded size.
      if (nextPageToken) {
        console.log('WARNING storage listing operation returning truncated results.');
      }

      // Get the paths to all objects/directories within that matched the query.
      var resources = files.map(file => this._toResource(file.name));

      // Filter the resources to only those files and directories directly contained within the
      // query path/directory if a non-recursive listing was requested.
      resources = this._selectWithinDirectory(directoryPath, resources, recursive);

      callback(null, content.selectNotebooks(resources));
    });
  }

  /**
   * Asynchronously moves the resource from source path to destination path.
   *
   * Note: this operation only supports moving individual objects, not sets of objects
   * that share some common prefix ("directories").
   *
   * @param sourcePath The path to be moved.
   * @param destinationPath The path to move to.
   * @param callback Completion callback.
   */
  move(sourcePath: string, destinationPath: string, callback: app.Callback<void>) {
    var gcsSourcePath = this._toGcsPath(sourcePath);
    var gcsDestinationPath = this._toGcsPath(destinationPath);

    var source = this._bucket.file(gcsSourcePath);
    source.copy(gcsDestinationPath, (error) => {
      if (error) {
        callback(error);
        return;
      }

      // Successfully copied to the destination; Now delete the source.
      this.delete(sourcePath, (error) => {
        if (error) {
          callback(error);
          return;
        }

        callback(null);
      });
    });
  }

  /**
   * Asynchronously opens and reads from the GCS object at the given path.
   *
   * @param path The storage path to read.
   * @param callback Callback to invoke upon completion of the read operation.
   */
  read(path: string, callback: app.Callback<string>) {
    var file = this._bucket.file(this._toGcsPath(path));

    file.download((errors, buffer) => {
      if (errors && errors.errors && errors.errors.length > 0) {
        // Check if the first error was due to the file not being found.
        //
        // An error reason of notFound indicates that the specified read failed because the object
        // doesn't exist. Invoke the callback with a null data value (but no error) to signal this.
        if (errors.errors.length > 1) {
          console.log(util.format(
            'Multiple errors returned when attempting to read GCS path "%s": %s',
            path, errors));
        }

        // We'll pass the first error back to the caller to handle
        var error = errors.errors[0];

        if (error.reason == 'notFound') {
          callback(null, null);
          return;
        } else {
          // Any other errors are passed back to caller to handle.
          callback(error);
          return;
        }
      }

      // File content is returned as a buffer object, so deserialize it to utf-8.
      var data = buffer.toString('utf8');
      callback(null, data);
    });
  }

  /**
   * Asynchronously writes the given data string to the GCS object referenced by the given path.
   *
   * @param path The file system path to write to, relative to the root path.
   * @param data The data string to write.
   * @param callback Callback to invoke upon completion of the write operation.
   */
  write(path: string, data: string, callback: app.Callback<void>) {
    var file = this._bucket.file(this._toGcsPath(path));
    file.createWriteStream().end(data, 'utf8', callback);
  }

  /**
   * Selects resources that are directly contained within the specified directory path.
   *
   * @param directoryStoragePath The storage directory path to use for selection.
   * @param resources The array of resources to select from.
   * @param recursive Select all files/dirs recursively contained within the specified directory.
   * @return A new array containing only resources directly within the specified directory.
   */
  _selectWithinDirectory(
      directoryStoragePath: string,
      resources: app.Resource[],
      recursive: boolean
      ): app.Resource[] {

    var selected: app.Resource[] = [];

    resources.forEach(resource => {
      var pathPrefix = resource.path.slice(0, directoryStoragePath.length);
      // Check if the current resource path is contained (directly or indirectly) by the specified
      // directory path.
      if (directoryStoragePath != pathPrefix) {
        // This resource path is not contained within the specified directory path, so skip it.
        return;
      }

      // Don't add the directory itself.
      if (directoryStoragePath == resource.path) {
        return;
      }

      if (recursive) {
        selected.push(resource);
      } else {
        // Don't select paths that are contained within subdirectories.

        // Take the portion of the resource path that comes after the directory path (+slash).
        var pathSuffix = resource.path.slice(directoryStoragePath.length + 1);
        // Check if the suffix indicates that the resource path is directly contained (vs indirectly
        // via sub directory).
        if (pathSuffix.indexOf('/') == -1) {
          selected.push(resource);
        }
      }

    });

    return selected;
  }

  /**
   * Translates a storage path to the corresponding GCS path.
   *
   * @param storagePath The specified storage path.
   * @return The corresponding GCS path.
   */
  _toGcsPath(storagePath: string): string {
    // Strip the initial slash.
    var gcsPath = storagePath.slice(1);
    // Strip any trailing slash.
    return content.stripTrailingSlash(gcsPath);
  }

  /**
   * Creates a resource from the specified GCS path.
   *
   * @param gcsPath Path to the resource within GCS.
   * @return The Resource representation of the GCS resource.
   */
  _toResource(gcsPath: string): app.Resource {
    var storagePath = this._toStoragePath(gcsPath);
    return {
      path: storagePath,
      isDirectory: content.isDirectory(gcsPath),
      description: content.getDescription(storagePath)
    }
  }

  /**
   * Translates a GCS path to the corresponding storage path.
   *
   * @param gcsPath The specified GCS path.
   * @return The corresponding storage path.
   */
  _toStoragePath(gcsPath: string): string {
    // Prepend a slash. All storage paths are absolute.
    return '/' + gcsPath;
  }

}
