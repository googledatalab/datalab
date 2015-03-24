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
 * Configuration specific to notebook formats
 */
import path = require('path');
import ipynb = require('./ipynb');
import util = require('../../common/util');


/**
 * Mapping of notebook path extensions to notebook serializer instances.
 *
 * Note: some formats (e.g., 'ipynb') are ambiguous and can imply multiple possible formats,
 * but this mapping assigns a default serializer for any given extension.
 */
var extensionToSerializer: app.Map<app.INotebookSerializer> = {
  '.ipynb': new ipynb.IPySerializer()
  // TODO(bryantd): define the serializer for .nb files here eventually
};

/**
 * Selects a notebook serializer, with implied format, for path based upon the file extension.
 *
 * Throws an error if the given file extension does not have a specified serializer.
 */
export function selectSerializer (notebookPath: string) {
  var extension = path.extname(notebookPath);
  var serializer = extensionToSerializer[extension];
  if (!serializer) {
    throw util.createError(
      'Notebook extension "%s" does not specify a supported serializer', extension);
  }
  return serializer;
}
