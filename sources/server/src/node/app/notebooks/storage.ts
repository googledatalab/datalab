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

  constructor (storage: app.IStorage) {
    this._storage = storage;
  }

  /**
   * Reads in the notebook if it exists or creates a starter notebook if not.
   */
  read (path: string, createIfNeeded?: boolean): app.INotebookSession {
    console.log('Reading notebook ' + path + ' ...');

    // Selects the serializer that has been assigned to the notebook path extension.
    var serializer = formats.selectSerializer(path);

    // First, attempt to read in the notebook if it already exists at the defined path.
    var serializedNotebook = this._storage.read(path);
    var notebookData: app.notebooks.Notebook;
    if (serializedNotebook === undefined) {
      if (createIfNeeded) {
        // Notebook didn't exist, so create a starter notebook.
        notebookData = nbutil.createStarterNotebook();
      } else {
        // Nothing can be done here since the path doesn't exist.
        throw util.createError('Cannot read notebook path "%s" because does not exist.');
      }
    } else {
      // Notebook already existed. Deserialize the notebook data.
      notebookData = serializer.parse(serializedNotebook);
    }
    // Create the notebook wrapper to manage the notebook model state.
    return new nb.NotebookSession(notebookData);
  }

  /**
   * Serializes the given notebook and writes it to storage.
   */
  write (path: string, notebook: app.INotebookSession) {
    console.log('Saving notebook ' + path + ' ...');
    // Selects the serializer that has been assigned to the notebook path extension.
    var serializer = formats.selectSerializer(path);

    // Serialize the current notebook model state to the format inferred from the file extension
    var serializedNotebook = serializer.stringify(notebook.getNotebookData());
    this._storage.write(path, serializedNotebook);
  }

}
