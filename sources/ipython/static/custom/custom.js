/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// IPython seems to assume local persistence of notebooks - it issues an HTTP
// request to create a notebook, and on completion opens a window.
// This is fine and dandy when the round-trip time is small, but sometimes long
// enough when notebooks are remote (as they are with GCS) to trigger the popup
// blocker in browsers.
// Patch the new_notebook method to first open the window, and then navigate it
// rather than open upon completion of the operation.

IPython.NotebookList.prototype.new_notebook = function() {
  var path = this.notebook_path;
  var base_url = this.base_url;
  var notebook_window = window.open('', '_blank');

  var settings = {
    processData : false,
    cache : false,
    type : 'POST',
    dataType : 'json',
    async : false,
    success : function(data, status, xhr) {
      var notebook_name = data.name;
      url = IPython.utils.url_join_encode(base_url, 'notebooks', path, notebook_name);
      notebook_window.location.href = url;
    },
    error : $.proxy(this.new_notebook_failed, this),
  };
  var url = IPython.utils.url_join_encode(base_url, 'api/notebooks', path);
  $.ajax(url, settings);
}
