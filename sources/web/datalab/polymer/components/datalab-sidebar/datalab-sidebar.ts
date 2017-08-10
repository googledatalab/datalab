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

/**
 * Sidebar element for Datalab.
 * This element puts a side bar on the left side that contains links to
 * different pages, and exposes a two-way bound 'page' property.
 */
class SidebarElement extends Polymer.Element {

  /**
   * The currently selected page name
   */
  public page: string;

  private _dataTabId: string;
  // TODO - remove _showDataTab once the Data tab is ready to be visible
  private _showDataTab = false;
  private _uiroot: string;

  static get is() { return 'datalab-sidebar'; }

  static get properties() {
    return {
      _dataTabId: {
        type: String,
        value: 'data',
      },
      _showDataTab: {
        type: Boolean,
        value: false,
      },
      _uiroot: {
        type: String,
        value: '',
      },
      page: {
        type: String,
        value: 'files',
      },
    };
  }

  public ready() {
    super.ready();
    if (location.pathname.startsWith('/exp/')) {
      this._uiroot = '/exp';
    }
    if (location.pathname.startsWith('/exp/data') ||
        location.pathname.startsWith('/data')) {
      this._showDataTab = true;
    }
    if (location.pathname.startsWith('/exp/data2') ||
        location.pathname.startsWith('/data2')) {
      this._dataTabId = 'data2';
    }
  }
}

customElements.define(SidebarElement.is, SidebarElement);
