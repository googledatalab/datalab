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


import transforms = require('./ipynbv3/transforms');
import util = require('../util');


/**
 * Serializer for reading/writing the .ipynb (IPython) formats.
 *
 * Only supports .ipynb v3 format currently.
 */
export class IPySerializer implements app.INotebookSerializer {

  /**
   * Parses and transforms the given .ipynb formatted JSON string into an in-memory notebook model.
   */
  parse (notebookData: string) {
    // Read the raw file contents (json blob) into an object.
    var ipynb = JSON.parse(notebookData);
    // Transform the .ipynb-formatted object into the internal notebook format.
    return transforms.fromIPyNotebook(ipynb);
  }

  /**
   * Serializes the in-memory notebook model to a .ipynb formatted JSON string.
   */
  stringify (notebook: app.notebooks.Notebook) {
    return JSON.stringify(
        transforms.toIPyNotebook(notebook),
        null, // Null value indicates that the entire object should be serialized.
        2); // Pretty print the json and use this number of spaces per identation level.
  }

}
