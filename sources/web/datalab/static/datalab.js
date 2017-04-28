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

var debug = {
  enabled: true,
  log: function() { console.log.apply(console, arguments); }
};

function placeHolder() {}

function reportEvent(event) {
  var reportingEnabled = (document.body.getAttribute('data-reporting-enabled') == 'true');
  if (!reportingEnabled) { return; }

  var signedIn = (document.body.getAttribute('data-signed-in') == 'true');
  var additionalMetadata = 'signedIn=' + signedIn;
  if (event['metadata']) {
    event['metadata'] = event['metadata'] + ',' + additionalMetadata;
  } else {
    event['metadata'] = additionalMetadata;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

function xhr(url, callback, method) {
  method = method || "GET";

  let request = new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState === 4 && request.status === 200) {
      callback.call(request);
    }
  }
  request.open(method, url);
  request.send();
}

function initializeDataLab(
    ipy, events, dialog, utils, security, appbar, editapp,
    notebookapp, notebooklist
  ) {
  var saveFn = function() {
    if (('notebook' in ipy) && ipy.notebook) {
      ipy.notebook.save_checkpoint();
    }
  }
  appbar.init(dialog, saveFn);

  // Override the sanitizer - all notebooks within the user's volume are implicity
  // trusted, and there is no need to remove scripts from cell outputs of notebooks
  // with previously saved results.
  security.sanitize_html = function(html) {
    return html;
  }

  var pageClass = document.body.className;
  if (pageClass.indexOf('notebook_app') >= 0) {
    notebookapp.preLoad(ipy, ipy.notebook, events, dialog, utils);
    events.on('notebook_loaded.Notebook', function() {
      notebookapp.postLoad(ipy, ipy.notebook, events, dialog, utils);
      window.datalab.loaded = true;
    });
  }
  else if (pageClass.indexOf('edit_app') >= 0) {
    events.on('file_loaded.Editor', function() {
      editapp.postLoad(ipy, ipy.editor);
      window.datalab.loaded = true;
    });
  }
  else if (pageClass.indexOf('notebook_list') >= 0) {
    events.on('draw_notebook_list.NotebookList', function() {
      notebooklist.postLoad(ipy, ipy.notebook_list, ipy.new_notebook_widget,
                             events, dialog, utils);
      window.datalab.loaded = true;
    });
  }
  else if (pageClass.indexOf('session_list') >= 0) {
    events.on('draw_notebook_list.NotebookList', function() {
      window.datalab.loaded = true;
    });
  }
}

define([
  'base/js/namespace',
  'base/js/events',
  'base/js/dialog',
  'base/js/utils',
  'base/js/security',
  'static/appbar',
  'static/edit-app',
  'static/notebook-app',
  'static/notebook-list',
  'static/minitoolbar',
  'static/websocket'
], function(ipy, events, dialog, utils, security, appbar, editapp,
            notebookapp, notebooklist, minitoolbar, websocket) {
     initializeDataLab(
            ipy, events, dialog, utils, security, appbar, editapp,
            notebookapp, notebooklist);
});
