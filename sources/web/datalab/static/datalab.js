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

function placeHolder() {}

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
    // The page is finished loading after the notebook list is drawn for the first
    // time. The list is refreshed periodically though, so we need to only capture
    // the first occurrence
    events.on('draw_notebook_list.NotebookList', function() {
      if (!window.datalab.loaded) {
        notebooklist.postLoad(ipy.notebook_list, ipy.new_notebook_widget, dialog);
        window.datalab.loaded = true;
      }
    });
  }
  else if (pageClass.indexOf('session_list') >= 0) {
    // The page is finished loading after the notebook list is drawn for the first
    // time. This event is used also after loading the terminal list. These lists are
    // refreshed periodically though, so we need to only capture the first occurrence
    events.on('draw_notebook_list.NotebookList', function() {
      if (!window.datalab.loaded) {
        window.datalab.loaded = true;
      }
    });
  }
}

define([
  'base/js/namespace',
  'base/js/events',
  'base/js/utils',
  'base/js/security',
  'appbar',
  'edit-app',
  'notebook-app',
  'notebook-list',
  'minitoolbar',
  'websocket',
  'base/js/dialog'
], function(ipy, events, utils, security, appbar, editapp,
            notebookapp, notebooklist, minitoolbar, websocket, dialog) {
     initializeDataLab(
            ipy, events, dialog, utils, security, appbar, editapp,
            notebookapp, notebooklist);
});
