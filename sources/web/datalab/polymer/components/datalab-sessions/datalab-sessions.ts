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

/// <reference path="../item-list/item-list.ts" />

interface SessionDescription {
  icon: string;
  kernel: string;
  name: string;
}

/**
 * Session listing element for Datalab.
 * Contains an item-list element to display sessions, a toolbar to interact with these sessions,
 * a progress bar that appears while loading the list
 */
class SessionsElement extends Polymer.Element implements DatalabPageElement {

  /**
   * The currently selected session if exactly one is selected, or null if none is.
   */
  public selectedSession: Session | null;

  public resizeHandler = null;

  private _sessionList: Session[] = [];
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

    (this.$.sessions as ItemListElement).columns = ['Session Path', 'Kernel'];

    const sessionsElement = this.shadowRoot.querySelector('#sessions');
    if (sessionsElement) {
      sessionsElement.addEventListener('selected-indices-changed',
                                    this._handleSelectionChanged.bind(this));
    }

    this.focusHandler();
  }

  /**
   * Creates a new ItemListRow object for each entry in the session list, and sends
   * the created list to the item-list to render.
   */
  async _drawSessionList() {
    const sessionsDescriptions = await Promise.all(this._sessionList.map((session) =>
        this._sessionToDescriptionPromise(session)));
    (this.$.sessions as ItemListElement).rows = sessionsDescriptions.map((description) => {
        return new ItemListRow({
            columns: [description.name, description.kernel],
            icon: description.icon,
        });
    });
  }

  /**
   * Convert a session object to a SessionDescription promise. If a file
   * manager type is also specified, it is used instead to get the
   * description's icon. Otherwise, we try to get the file manager type from
   * the session path and use that type's icon. If we fail to do that, we
   * default to using Jupyter as the file manager type.
   */
  _sessionToDescriptionPromise(session: Session, fileManagerType?: FileManagerType)
      : Promise<SessionDescription> {
    if (fileManagerType) {
      const config = FileManagerFactory.getFileManagerConfig(fileManagerType);
      const description: SessionDescription = {
        icon: config.displayIcon,
        kernel: session.kernel.name,
        name: session.notebook.path,
      };
      return Promise.resolve(description);
    } else {
      let id: DatalabFileId;
      try {
        id = DatalabFileId.fromString(session.notebook.path);
      } catch (e) {
        // If we fail to parse the path as a file id, default to using Jupyter,
        // since the V1 Jupyter notebook editor does not pass a full file id.
        return this._sessionToDescriptionPromise(session, FileManagerType.JUPYTER);
      }
      const type = FileManagerFactory.fileManagerNameToType(id.source);
      const config = FileManagerFactory.getFileManagerConfig(type);
      const fileManager = FileManagerFactory.getInstanceForType(type);
      return fileManager.get(id)
        .then((file) => file.name)
        // On error to get the file object, use the notebook path as is
        .catch(() => id.path)
        .then((fileName: string) => {
          const description: SessionDescription = {
            icon: config.displayIcon,
            kernel: session.kernel.name,
            name: fileName,
          };
          return description;
        });
      }
  }

  /**
   * Calls the SessionManager to get the list of sessions at the current path, and
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
    SessionManager.listSessionsAsync()
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
   * Calls the SessionManager to terminate the selected sessions.
   */
  _shutdownSelectedSessions() {
    const selectedIndices = (this.$.sessions as ItemListElement).selectedIndices;
    if (selectedIndices.length) {
      const shutdownPromises = selectedIndices.map((i: number) => {
        return SessionManager.shutdownSessionAsync(this._sessionList[i].id);
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
  focusHandler() {
    // Refresh the session list periodically as long as the document has focus.
    // Note that we don't rely solely on the interval to keep the list in sync,
    // the refresh also happens when the sessions page gains focus, which is
    // more useful since the list will change typically when the user opens a
    // notebook, then switches back to the sessions page. Killing a session also
    // triggers a refresh.
    if (!this._sessionListRefreshIntervalHandle) {
      this._sessionListRefreshIntervalHandle = window.setInterval(() => {
        if (document.hasFocus()) {
          this._fetchSessionList();
        }
      }, this._sessionListRefreshInterval);
    }
    // Now refresh the list once.
    this._fetchSessionList();
  }

  /**
   * Stops the auto refresh of the session list. This happens when the user moves
   * away from the page.
   */
  blurHandler() {
    if (this._sessionListRefreshIntervalHandle) {
      clearInterval(this._sessionListRefreshIntervalHandle);
      this._sessionListRefreshIntervalHandle = 0;
    }
  }

}

customElements.define(SessionsElement.is, SessionsElement);
