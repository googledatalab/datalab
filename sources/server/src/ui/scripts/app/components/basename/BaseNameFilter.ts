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


import _app = require('app/App');

/**
 * Filter for selecting the basename from a file path.
 *
 * e.g., "/path/to/foo.bar" => "foo"
 *
 * Example usage in a template: {{ somePath | basename }}
 */
function basename () {
  return (path: string) => {
    var parts = path.split('/');
    var filename = parts[parts.length - 1];

    // Find the final period, which marks delimites basename from file extension.
    var finalPeriodIndex = filename.lastIndexOf('.');
    if (finalPeriodIndex == -1) {
      // No file extension to trim. Done formatting.
      return filename;
    }

    // Return the portion of the filename up to the final period.
    return filename.substr(0, finalPeriodIndex);
  }
}

_app.registrar.filter('basename', basename);
