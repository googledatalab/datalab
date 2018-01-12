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
 * Settings element for Datalab.
 * This element shows a settings panel for Datalab that contains different user settings,
 * and uses the ApiManager to read and update those settings.
 * On changing the selected theme, this element will trigger an event on the document
 * element to signal the change, which can be handled by the host.
 */
@Polymer.decorators.customElement('datalab-settings')
class SettingsElement extends Polymer.Element {

  /**
   * Current selected theme.
   */
  @Polymer.decorators.property({type: String})
  public theme: string;

  /**
   * Idle timeout interval.
   */
  @Polymer.decorators.property({type: String})
  public idleTimeoutInterval: string;

  @Polymer.decorators.property({type: Boolean})
  _updateError = false;

  @Polymer.decorators.property({type: Boolean})
  _busy = false;

  @Polymer.decorators.property({type: String})
  _idleTimeoutUpdateStatus = '';

  /**
   * Called when element is attached to DOM. Gets the user settings and sets
   * the visible ones to element properties.
   */
  ready() {
    super.ready();
    this.loadSettings();
  }

  /**
   * Fetches the settings from the backend and populates the UI.
   */
  loadSettings() {
    this._busy = true;
    this._idleTimeoutUpdateStatus = '';
    this._updateError = false;
    return SettingsManager.getUserSettingsAsync(true /*forceRefresh*/)
      .then((settings: common.UserSettings) => {
        this.theme = settings.theme;
        this.idleTimeoutInterval = settings.idleTimeoutInterval;
      })
      .catch(() => {
        Utils.log.error('Could not get user settings from server.');
      })
      .then(() => this._busy = false);
  }

  /**
   * On changing the theme, an event is fired to allow the host to reload the theme CSS.
   */
  _themeChanged() {
    return SettingsManager.setUserSettingAsync('theme', this.theme)
      .then(() => {
        const e = new CustomEvent('ThemeChanged', {detail: this.theme});
        document.dispatchEvent(e);
      });
  }

  _idleTimoutIntervalChanged() {
    // TODO: Show success/error status to user
    this._busy = true;
    this._idleTimeoutUpdateStatus = '';
    this._updateError = false;
    return SettingsManager.setUserSettingAsync('idleTimeoutInterval', this.idleTimeoutInterval)
      .then(() => this._idleTimeoutUpdateStatus = 'Idle timeout updated')
      .catch((e: Error) => {
        this._idleTimeoutUpdateStatus = 'Update failed: ' + e.message;
        this._updateError = true;
      })
      .then(() => this._busy = false);
  }

}
