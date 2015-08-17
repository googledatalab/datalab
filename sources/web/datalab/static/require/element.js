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

// element.js
// RequireJS plugin to resolve DOM elements.

define(function () {
  'use strict';

  var pendingCallbacks = null;

  function domReadyCallback() {
    var callbacks = pendingCallbacks;
    pendingCallbacks = null;

    if (callbacks && callbacks.length) {
      for (var i = 0; i < callbacks.length; i += 2) {
        callbacks[i + 1](document.getElementById(callbacks[i]));
      }
    }
  }

  function loadElement(name, req, loadCallback, config) {
    if (config.isBuild) {
      loadCallback(null);
    }
    else {
      if (document.readyState != 'complete') {
        if (!pendingCallbacks) {
          pendingCallbacks = [];
          document.addEventListener('DOMContentLoaded', domReadyCallback, false);
        }

        pendingCallbacks.push([name, loadCallback]);
      }
      else {
        loadCallback(document.getElementById(name));
      }
    }
  }

  return {
    load: loadElement
  }
});
