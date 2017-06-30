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
class SettingsElement extends Polymer.Element {

  /**
   * Current selected theme.
   */
  public theme: string;

  static get is() { return "datalab-settings"; }

  static get properties() {
    return {
      theme: {
        type: String,
      }
    }
  }

  /**
   * Called when element is attached to DOM. Gets the user settings and sets
   * the visible ones to element properties.
   */
  ready() {
    super.ready();

    SettingsManager.getUserSettingsAsync(true /*forceRefresh*/)
      .then((settings: common.UserSettings) => {
        this.theme = settings.theme;
      });
  }

  _themeChanged() {
    return SettingsManager.setUserSettingAsync('theme', this.theme)
      .then(() => document.dispatchEvent(new Event('ThemeChanged')));
  }

}

customElements.define(SettingsElement.is, SettingsElement);

