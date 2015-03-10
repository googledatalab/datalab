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


import util = require('util');


/**
 * Finds an open port available for binding.
 *
 * TODO(bryantd): this is a stop-gap implementation for port selection
 * Find a robust/reliable way of getting available ports to replace this.
 */
var portOffset = 0;
export function getAvailablePort (): number {
  return 45100 + portOffset++;
}

/**
 * Generic no-op function that takes a single arg
 */
export function noop (arg1: any): void {}

/**
 * Creates an error object from the format string and list of args to interpolate.
 */
export function createError(format: string, ...formatArgs: any[]) {
  return new Error(util.format.apply(/* this context */ null, [format].concat(formatArgs)));
}

/**
 * Creates a mimetype bundle to represent an error output
 *
 * Used when transforming the common set of error fields to a rich cell output
 * in the case of .ipynb error outputs and kernel error messages.
 */
export function createErrorOutput (
    errorName: string,
    errorMessage: string,
    traceback: string[]
    ): app.notebook.CellOutput {
  return {
    type: 'error',
    mimetypeBundle: {
      'text/plain': errorName + ': ' + errorMessage
      // TODO(bryantd): parse and present the traceback data as formatted html content
      // This requires converting the ANSI color codes embedded in the traceback to appropriate
      // CSS classes.
    },
    // Retain the individual error fields as metadata
    // Necessary to fully support exporting to .ipynb format
    metadata: {
      errorDetails: {
        errorName: errorName,
        errorMessage: errorMessage,
        traceback: traceback
      }
    }
  };
}
