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

/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/node/gcloud.d.ts" />
/// <reference path="../common/interfaces.d.ts" />
import gcloud = require('gcloud');
import pathlib = require('path');


/**
 * Manages storage operations backed by Google Cloud Storage (GCS).
 */
export class GoogleCloudStorage implements app.IStorage {

  _bucket: GCloud.Bucket;

  /**
   * Constructor.
   *
   * @param bucket The gcloud bucket client to use for accessing storage.
   */
  constructor(bucket: GCloud.Bucket) {
    this._bucket = bucket;
  }

  /**
   * Asynchronously deletes the GCS object at the given path.
   *
   * @param path The file system path to write to, relative to the root path.
   * @param callback Callback to invoke upon completion of the write operation.
   */
  delete(path: string, callback: app.Callback<void>) {
    var file = this._bucket.file(path);
    file.delete((error) => {
      if (error) {
        console.log('failed to delete ' + path);
        callback(error);
        return;
      }
      console.log('Delete succeeded!');
      callback(null);
    });
  }

  /**
   * Asynchronously enumerates the resources that match the given directory path.
   *
   * @param directoryPath The storage path for which to enumerate resources.
   * @param recursive Should the listing operation recursively enumerate sub-directories?
   * @param callback Completion callback to invoke.
   */
  list(directoryPath: string, recursive: boolean, callback: app.Callback<app.Resource[]>) {
    var query: GCloud.Query = {
      prefix: this._toGcsPath(directoryPath)
    };


    this._bucket.getFiles(query, (error, files, nextPageToken) => {
      if (error) {
        console.log('Failed to list objects: ', error);
        callback(error);
        return;
      }

      // TODO(bryantd): add support for paging within the list API eventually via nextQuery GCS
      // token. For now, truncate the listing response to the first page of results from GCS to
      // avoid returning a response with unbounded size.

      // Get the paths to all objects/directories within that matched the query.
      var resources = files.map(file => this._toResource(file.name));

      if (!recursive) {
        // Filter the resources to only those files and directories directly contained within the
        // query path/directory if a non-recursive listing was requested.
        resources = this._selectWithinDirectory(directoryPath, resources);
      }

      callback(null, this._selectNotebooks(resources));
    });
  }

  move(sourcePath: string, destinationPath: string, callback: app.Callback<void>) {
    var source = this._bucket.file(sourcePath);
    source.copy(destinationPath, (error) => {
      if (error) {
        console.log('copy to ' + destinationPath + ' failed');
        callback(error);
        return;
      }

      // successfully copied, now delete the source
      this.delete(sourcePath, (error) => {
        if (error) {
          console.log('failed to delete source ' + sourcePath);
          callback(error);
          return;
        }

        console.log('Move succeeded!');
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
    var file = this._bucket.file(path);

    file.download((error, buffer) => {
      console.log('Finished downloading file...');
      if (error) {
        // An error reason of notFound indicates that the specified read failed because the object
        // doesn't exist.
        if (error.reason == 'notFound') {
          console.log("Cannot read " + path + ' because it doesnt exist');
          callback(null, null);
          return;
        } else {
          // Any other errors are passed back to caller to handle.
          console.log('fail '+ path+ ':', error.message, error);
          callback(error);
          return;
        }
      }

      // File content is returned as a buffer object, so deserialize it to utf-8.
      var data = buffer.toString('utf8');
      console.log('success ' + path + ':', data);
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
    var file = this._bucket.file(path);

    file.createWriteStream().end(data, 'utf8', (error: Error) => {
      if (error) {
        console.log('Error occurred during write: ', error);
        callback(error);
        return;
      }

      console.log('Done writing... Success!');
      callback(null);
    });
  }

  /**
   * Detects if the given GCS path represents a "directory".
   */
  _isGcsDirectory(gcsPath: string): boolean {
    // GCS denotes "directories" as object paths with a trailing slash.
    return gcsPath[gcsPath.length - 1] == '/';
  }

  /**
   * Selects directories and notebook files from the specified list of resources.
   *
   * Currently, notebooks are limited to files with the .ipynb extension.
   *
   * @param resources The array of resources to select from.
   * @return A new array containing only directory and notebook resources.
   */
  _selectNotebooks(resources: app.Resource[]): app.Resource[] {
    var selected: app.Resource[] = [];

    resources.forEach(resource => {
      // All directories are retained.
      if (resource.isDirectory) {
        selected.push(resource);
        return;
      }

      // Select only the files having the notebook extension.
      var notebookExtension = 'ipynb';
      if (notebookExtension == resource.path.slice(-notebookExtension.length)) {
        selected.push(resource);
      }
    });

    return selected;
  }

  /**
   * Selects resources that are directly contained within the specified directory path.
   *
   * @param resources The array of resources to select from.
   * @return A new array containing only resources directly within the specified directory.
   */
  _selectWithinDirectory(directoryStoragePath: string, resources: app.Resource[]): app.Resource[] {
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

      // Take the portion of the resource path that comes after the directory path (+slash).
      var pathSuffix = resource.path.slice(directoryStoragePath.length + 1);
      // Check if the suffix indicates that the resource path is directly contained (vs indirectly
      // via sub directory).
      if (pathSuffix.split('/').length == 1) {
        selected.push(resource);
      }
    });

    return selected;
  }

  /**
   * Translates a GCS path to the corresponding storage path.
   *
   * @param gcsPath The specified GCS path.
   * @return The corresponding storage path.
   */
  _toStoragePath(gcsPath: string): string {
    // Prepend a slash. All storage paths are absolute.
    var storagePath = '/' + gcsPath;
    // Remove a trailing slash if one exists.
    return this._stripTrailingSlash(storagePath);
  }

  /**
   * Strips a trailing slash character from the string if one exists.
   *
   * @param s The input string.
   * @return String with a single trailing slash stripped, if one existed.
   */
  _stripTrailingSlash(s: string) {
    if (s[s.length - 1] == '/') {
      // Then strip a trailing slash.
      return s.slice(0, s.length -1);
    } else {
      // No trailing slash to strip.
      return s;
    }
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
    return this._stripTrailingSlash(gcsPath);
  }

  _toResource(gcsPath: string): app.Resource {
    // todo: figure out if path is a directory first
    return {
      path: this._toStoragePath(gcsPath),
      isDirectory: this._isGcsDirectory(gcsPath)
    }
  }

}
