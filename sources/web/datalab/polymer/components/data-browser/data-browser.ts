/*
 * Copyright 2017 Google Inc. All rights reserved.
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

/// <reference path="../input-dialog/input-dialog.ts" />
/// <reference path="../item-list/item-list.ts" />

/**
 * Data Browser element for Datalab.
 */
class DataBrowserElement extends Polymer.Element implements DatalabPageElement {

  static get is() { return 'data-browser'; }

  static get properties() {
    return {
      fileId: {
        notify: true,
        type: String,
      },
    };
  }

  /**
   * Pass through requests to our file-browser element.
   */
  focusHandler() {
    this.$.fileBrowser.focusHandler();
  }
  blurHandler() {
    this.$.fileBrowser.blurHandler();
  }
  resizeHandler() {
    this.$.fileBrowser.resizeHandler();
  }

  ready() {
    super.ready();

    this.$.fileBrowser.fileManagerTypeList = [
      FileManagerType.BIG_QUERY,
      FileManagerType.BIG_QUERY_PUBLIC,
    ];
  }
}

customElements.define(DataBrowserElement.is, DataBrowserElement);
