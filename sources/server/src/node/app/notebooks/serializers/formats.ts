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


/**
 * Configuration specific to notebook formats.
 */
import path = require('path');


/**
 * String constants for specifying a notebook format.
 */
export var names = {
  ipynbV3: 'ipynb v3',
  model: 'model'
}

/**
 * Mapping of notebook path extensions to notebook format names
 *
 * Note: some formats (e.g., 'ipynb') are ambiguous and can imply multiple possible formats,
 * but this mapping assigns a default format for any given extension
 */
var extensionToFormat = {
  '.ipynb': names.ipynbV3,
  '.modelnb': names.model
  // TODO(bryantd): define the format for .nb files here eventually
};

/**
 * Selects a serialization format for the given notebook path based upon the file extension.
 */
export function selectNotebookFormat (notebookPath: string) {
  var extension = path.extname(notebookPath);
  var format = extensionToFormat[extension];
  if (!format) {
    throw new Error('Notebook extension ("'+extension+'") does not specify a supported format');
  }
  return format;
}
