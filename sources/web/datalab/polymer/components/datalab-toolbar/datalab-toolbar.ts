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

  private _projectInfo : string;
  private _signedIn : boolean;
  private _userInfo : string;

  static get is() { return "datalab-toolbar"; }

  static get properties() {
    return {
      _projectInfo: {
        type: String,
        value: '',
      },
      _signedIn: {
        type: Boolean,
        value: false,
      },
      _userInfo: {
        type: String,
        value: '',
      },
    }
  }

  /**
   * When account menu icon is clicked, toggles account menu visibility
   */
  _accountIconClicked() {
    this.$.accountDropdown.toggle();
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
  }

  _signInClicked() {
    this._signedIn = true;
    this._userInfo = 'Not actually signed in';
    this._projectInfo = 'No project is set';
  }

  _signOutClicked() {
    this._signedIn = false;
  }
}

customElements.define(ToolbarElement.is, ToolbarElement);

