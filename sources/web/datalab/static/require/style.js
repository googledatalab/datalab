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

// style.js
// RequireJS plugin to load stylesheets.

define(function () {
  'use strict';

  // An object containing stylesheets to load, and associated callback to invoke.
  // This will be processed once the DOM is ready.
  var pendingStyleSheets = null;

  function addStyleSheet(url) {
    var stylesheet = document.createElement('link');
    stylesheet.type = 'text/css';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = url;

    document.getElementsByTagName('head')[0].appendChild(stylesheet);
  }

  function domReadyCallback() {
    var stylesheets = pendingStyleSheets;
    pendingStyleSheets = null;

    Object.keys(stylesheets).forEach(function(url) {
      addStyleSheet(url);
      stylesheets[url](null);
    });
  }

  function loadStyleSheet(url, req, loadCallback, config) {
    if (config.isBuild) {
      loadCallback(null);
    }
    else {
      if (document.readyState != 'complete') {
        if (!pendingStyleSheets) {
          pendingStyleSheets = {};
          document.addEventListener('DOMContentLoaded', domReadyCallback, false);
        }

        pendingStyleSheets[url] = loadCallback;
      }
      else {
        addStyleSheet(url);
        setTimeout(loadCallback, 0)
      }
    }
  }

  return {
    load: loadStyleSheet
  }
});
