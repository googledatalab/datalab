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


import formats = require('./serializers/formats');
import nb = require('./session');
import nbutil = require('./util');
import util = require('../common/util');


/**
 * Manages the reading and writing of notebooks from/to a storage backend.
 *
 * Provides notebook-specific content serialization and default content generation when reading or
 * writing to a storage backend.
 */
export class NotebookStorage implements app.INotebookStorage {

  _storage: app.IStorage;

  /**
   * Constructor.
   *
   * @param storage The storage instance to use for persistence.
   */
  constructor(storage: app.IStorage) {
    this._storage = storage;
  }

  /**
   * Asynchronously reads in the notebook if it exists or creates a starter notebook if not.
   *
   * @param path The full notebook path to read (with file extension).
   * @param createIfNeeded Should a starter notebook be returned if the path doesn't exist?
   * @param callback Callback to invoke upon completion of the read operation.
   */
  read(path: string, createIfNeeded: boolean, callback: app.Callback<app.INotebookSession>) {

    // Selects the serializer that has been assigned to the notebook path extension.
    var serializer: app.INotebookSerializer;
    try {
      serializer = formats.selectSerializer(path);
    } catch (error) {
      // Pass the error to the caller.
      return callback(error);
    }

    // First, attempt to read in the notebook if it already exists at the defined path.
    this._storage.read(path, (error: any, serializedNotebook: string) => {

      // Pass any read errors back to the caller to handle.
      if (error) {
        return callback(error);
      }

      // Deserialize the notebook or create a starter notebook.
      var notebookData: app.notebooks.Notebook;
      if (serializedNotebook === undefined) {

        if (createIfNeeded) {
          // Notebook didn't exist, so create a starter notebook.
          notebookData = nbutil.createStarterNotebook();
        } else {
          // Nothing can be done here since the path doesn't exist.
          return callback(util.createError(
            'Cannot read notebook path "%s" because does not exist.'));
        }

      } else {
        // Notebook already exists. Deserialize the notebook data.
        notebookData = serializer.parse(serializedNotebook);
      }

      // Create the notebook wrapper to manage the notebook model state.
      callback(null, new nb.NotebookSession(notebookData));
    });
  }

  /**
   * Asynchronously serializes the given notebook and writes it to storage.
   *
   * @param path The notebook path to write to.
   * @param notebook A notebook session to serialize.
   * @param callback Callback to invoke upon completion of the async write operation.
   */
  write(path: string, notebook: app.INotebookSession, callback: app.ErrorCallback) {

    // Selects the serializer that has been assigned to the notebook path extension.
    var serializer: app.INotebookSerializer;
    try {
      serializer = formats.selectSerializer(path);
    } catch (error) {
      return callback(error);
    }

    // Serialize the current notebook model state to the format inferred from the file extension
    var serializedNotebook = serializer.stringify(notebook.getNotebookData());

    // Asynchronously write the notebook to storage.
    this._storage.write(path, serializedNotebook, callback);
  }

}
