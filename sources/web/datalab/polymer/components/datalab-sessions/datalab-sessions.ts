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
   * The currently selected session if exactly one is selected, or null if none is.
   */
  public selectedSession: Session | null;

  private _sessionList: Session[];
  private _fetching: boolean;
  private _sessionListRefreshInterval = 60 * 1000;
  private _sessionListRefreshIntervalHandle = 0;

  static get is() { return 'datalab-sessions'; }

  static get properties() {
    return {
      _fetching: {
        type: Boolean,
        value: false
      },
      _sessionList: {
        type: Array,
        value: () => [],
      },
      selectedSession: {
        type: Object,
        value: null,
      },
    };
  }

  /**
   * Called when when the element's local DOM is ready and initialized We use it
   * to initialize element state.
   */
  ready() {
    super.ready();

    (this.$.sessions as ItemListElement).columns = ['Session Path', 'Status'];

    const sessionsElement = this.shadowRoot.querySelector('#sessions');
    if (sessionsElement) {
      sessionsElement.addEventListener('selected-indices-changed',
                                    this._handleSelectionChanged.bind(this));
    }

    this._focusHandler();
  }

  /**
   * Creates a new ItemListRow object for each entry in the session list, and sends
   * the created list to the item-list to render.
   */
  _drawSessionList() {
    // initial value
    if (!Array.isArray(this._sessionList)) {
      return;
    }

    (this.$.sessions as ItemListElement).rows = this._sessionList.map((session) => {
      return {
        firstCol: session.notebook.path,
        icon: 'editor:insert-drive-file',
        secondCol: 'running',
        selected: false
      };
    });
  }

  /**
   * Calls the ApiManager to get the list of sessions at the current path, and
   * updates the _sessionList property.
   * @param throwOnError whether to throw an exception if the refresh fails. This
   *                     is false by default because throwing is currently not used.
   */
  _fetchSessionList(throwOnError = false) {
    // Don't overlap fetch requests. This can happen because we set up fetch from several sources:
    // - Initialization in the ready() event handler.
    // - Refresh mechanism called by the setInterval().
    // - User clicking refresh button.
    // - Sessions page gaining focus.
    if (this._fetching) {
      return;
    }
    this._fetching = true;
    ApiManager.listSessionsAsync()
      .then((newList) => {
        // Only refresh the UI list if there are any changes. This helps keep
        // the item list's selections intact most of the time
        // TODO: [yebrahim] Try to diff the two lists and only inject the
        // differences in the DOM instead of refreshing the entire list if
        // one item changes. This is tricky because we don't have unique
        // ids for the items. Using paths might work for files, but is not
        // a clean solution.
        if (JSON.stringify(this._sessionList) !== JSON.stringify(newList)) {
          this._sessionList = newList;
          this._drawSessionList();
        }
      })
      .catch((e: Error) => {
        if (throwOnError === true) {
          throw new Error('Error getting list of sessions: ' + e.message);
        }
      })
      .then(() => this._fetching = false);
  }

  /**
   * Calls the ApiManager to terminate the selected sessions.
   */
  _shutdownSelectedSessions() {
    const selectedIndices = (this.$.sessions as ItemListElement).selectedIndices;
    if (selectedIndices.length) {
      const shutdownPromises = selectedIndices.map((i: number) => {
        return ApiManager.shutdownSessionAsync(this._sessionList[i].id);
      });

      // TODO: [yebrahim] If at least one delete fails, _fetchSessionList will never be called,
      // even if some other deletes completed.
      return Promise.all(shutdownPromises)
        .then(() => this._fetchSessionList());
        // TODO: Handle delete errors properly by showing some message to the user
    } else {
      return Promise.resolve(null);
    }
  }

  /**
   * Called when the selection changes on the item list. If exactly one session
   * is selected, sets the selectedSession property to the selected session object.
   */
  _handleSelectionChanged() {
    const selectedItems = (this.$.sessions as ItemListElement).selectedIndices;
    if (selectedItems.length === 1) {
      this.selectedSession = this._sessionList[selectedItems[0]];
    } else {
      this.selectedSession = null;
    }
  }

  /**
   * Starts auto refreshing the session list, and also triggers an immediate refresh.
   */
  _focusHandler() {
    // Refresh the session list periodically. Note that we don't rely solely on
    // the interval to keep the list in sync, the refresh also happens when the
    // sessions page gains focus, which is more useful since the list will
    // change typically when the user opens a notebook, then switches back to
    // the sessions page. Killing a session also triggers a refresh.
    if (!this._sessionListRefreshIntervalHandle) {
      this._sessionListRefreshIntervalHandle =
          setInterval(this._fetchSessionList.bind(this), this._sessionListRefreshInterval);
    }
    // Now refresh the list once.
    this._fetchSessionList();
  }

  /**
   * Stops the auto refresh of the session list. This happens when the user moves
   * away from the page.
   */
  _blurHandler() {
    if (this._sessionListRefreshIntervalHandle) {
      clearInterval(this._sessionListRefreshIntervalHandle);
      this._sessionListRefreshIntervalHandle = 0;
    }
  }

}

customElements.define(SessionsElement.is, SessionsElement);
