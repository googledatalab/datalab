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

  _bucket: string;
  _client: GCloud.Bucket;

  /**
   * Constructor.
   *
   * @param bucket The name of the GCS bucket to use for storage.
   */
  constructor(bucket: string) {
    this._bucket = bucket;
    this._client = gcloud.storage().bucket(this._bucket);
  }

  /**
   * Asynchronously deletes the GCS object at the given path.
   *
   * @param path The file system path to write to, relative to the root path.
   * @param callback Callback to invoke upon completion of the write operation.
   */
  delete(path: string, callback: app.Callback<void>) {
    // TODO
  }

  /**
   * Asynchronously enumerates the resources that match the given path prefix.
   *
   * @param path The storage path for which to enumerate resources.
   * @param recursive Should the listing operation recursively enumerate sub-directories?
   * @param callback Completion callback to invoke.
   */
  list(path: string, recursive: boolean, callback: app.Callback<app.Resource[]>) {
    // TODO
  }

  move(sourcePath: string, destinationPath: string, callback: app.Callback<void>) {
    // TODO
  }

  /**
   * Asynchronously opens and reads from the GCS object at the given path.
   *
   * @param path The storage path to read.
   * @param callback Callback to invoke upon completion of the read operation.
   */
  read(path: string, callback: app.Callback<string>) {
    var file = this._client.file(path);

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
    var file = this._client.file(path);

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
}
