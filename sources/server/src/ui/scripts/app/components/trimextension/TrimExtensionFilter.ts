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


import _app = require('app/App');

/**
 * Filter for trimming the file extension off of a file path
 *
 * e.g., "/path/to/foo.bar" => "/path/to/foo"
 *
 * Example usage in a template: {{ somePath | trimExtension }}
 */
function trimExtension () {
  return (path: string) => {
    var match = /(.*)\.[^.]+$/.exec(path);
    if (!match) {
      // Filename doesn't match the regex -- malformed, so just display it as-is
      return path;
    }
    // A successful regex match returns: [<full text of matched string>, <capturing group we want>]
    return match[1];
  };
}

_app.registrar.filter('trimExtension', trimExtension);
