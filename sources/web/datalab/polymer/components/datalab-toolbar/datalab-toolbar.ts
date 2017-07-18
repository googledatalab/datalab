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
 * Toolbar element for Datalab.
 * This element is a horizontal bar that goes at the top of the page, and
 * contains the Datalab logo, plus a few icons that are meant to persist
 * on all pages. It also contains dialogs that are opened by those buttons
 */
class ToolbarElement extends Polymer.Element {

  /**
   * The current Datalab version string.
   */
  public version: string;

  static get is() { return "datalab-toolbar"; }

  static get properties() {
    return {
      version: {
        type: String,
        value: '',
      },
    };
  }

  ready() {
    super.ready();
    const authPanel = this.shadowRoot.querySelector('auth-panel')
    if (authPanel) {
      authPanel.addEventListener('signInOutDone', this._closeAccountDropdown.bind(this));
    }

    SettingsManager.getAppSettingsAsync()
      .then((settings: common.AppSettings) => this.version = settings.versionId);
  }

  /**
   * When account menu icon is clicked, toggles account menu visibility
   */
  _accountIconClicked() {
    this.$.accountDropdown.toggle();
  }

  _closeAccountDropdown() {
    this.$.accountDropdown.close();
  }

  /**
   * Opens the info dialog
   */
  _infoClicked() {
    this.$.infoDialog.open();
  }

  /**
   * Opens the settings dialog
   */
  _settingsClicked() {
    this.$.settingsDialog.open();
    this.$.settingsElement.loadSettings();
  }
}

customElements.define(ToolbarElement.is, ToolbarElement);
