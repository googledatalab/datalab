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

// element.js
// RequireJS plugin to resolve DOM elements.

define("element", function () {
  'use strict';

  var pendingCallbacks = null;

  function resolve(cbInfo) {
    cbInfo.cb(document.getElementById(cbInfo.name));
  }
  
  function domReadyCallback() {
    if (pendingCallbacks) {
      // Clear out pendingCallbacks, so any future requests are immediately resolved.
      var callbacks = pendingCallbacks;
      pendingCallbacks = null;

      callbacks.forEach(resolve);
    }
  }

  function loadElement(name, req, loadCallback, config) {
    if (config.isBuild) {
      loadCallback(null);
    }
    else {
      var cbInfo = { name: name, cb: loadCallback };

      if (document.readyState == 'loading') {
        if (!pendingCallbacks) {
          pendingCallbacks = [];
          document.addEventListener('DOMContentLoaded', domReadyCallback, false);
        }

        pendingCallbacks.push(cbInfo);
      }
      else {
        resolve(cbInfo);
      }
    }
  }

  return {
    load: loadElement
  }
});
