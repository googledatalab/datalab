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

/// <reference path="../../modules/ApiManager.ts" />
/// <reference path="../item-list/item-list.ts" />

/**
 * Session listing element for Datalab.
 * Contains an item-list element to display sessions, a toolbar to interact with these sessions,
 * a progress bar that appears while loading the list
 */
class SessionsElement extends Polymer.Element {

  /**
   * The list of sessions being displayed
   */
  public sessionList: Array<Session>;

  private _fetching: boolean;
  private _sessionListRefreshInterval: number;

  static get is() { return "datalab-sessions"; }

  static get properties() {
    return {
      sessionList: {
        type: Array,
        value: function() {
          return [];
        },
        observer: '_sessionListChanged'
      },
      _fetching: {
        type: Boolean,
        value: false
      },
      _sessionListRefreshInterval: {
        type: Number,
        value: 10000
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    const listElement = this._getSessionListElement();
    listElement.columns = ['Session Path', 'Status'];

    // load session list initially
    this._loadSessionsList();

    // Refresh the session list periodically.
    // TODO: [yebrahim] Start periodic refresh when the window is in focus, and
    // the sessions page is open, and stop it on blur to minimize unnecessary traffic
    setInterval(this._loadSessionsList.bind(this), this._sessionListRefreshInterval);
  }

  _getSessionListElement() {
    return this.$.sessions;
  }

  _sessionListChanged() {
    // initial value
    if (!Array.isArray(this.sessionList)) {
      return;
    }

    const listElement = this._getSessionListElement();
    let newList: Array<ItemListRow> = [];
    this.sessionList.forEach(session => {
      newList.push({
        firstCol: session.notebook.path,
        secondCol: 'running',
        icon: 'editor:insert-drive-file',
        selected: false
      });
    });
    listElement.rows = newList;
  }

  _loadSessionsList() {
    const self = this;
    self._fetching = true;
    return ApiManager.listSessionsAsync()
      .then(list => {
        self.sessionList = list;
      }, () => {
        // TODO: [yebrahim] Add dummy data here when debugging is enabled to allow for
        // fast UI iteration using `polymer serve`.
        console.log('Error getting list of sessions.');
      })
      .then(() => {
        this._fetching = false;
      });
  }

}

customElements.define(SessionsElement.is, SessionsElement);

