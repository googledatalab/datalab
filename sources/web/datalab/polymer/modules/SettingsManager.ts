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

let userSettings: common.UserSettings;
let appSettings: common.AppSettings;

class SettingsManager {

  static getUserSettingsAsync(forceRefresh?: boolean) {
    if (!userSettings || forceRefresh === true) {
      return SettingsManager._getUserSettingsAsync()
        .then((settings: common.UserSettings) => {
          userSettings = settings;
          return userSettings;
        });
    } else {
      return Promise.resolve(userSettings);
    }
  }

  static getAppSettingsAsync(forceRefresh?: boolean) {
    if (!appSettings || forceRefresh === true) {
      return SettingsManager._getAppSettingsAsync()
        .then((settings: common.AppSettings) => {
          appSettings = settings;
          return appSettings;
        });
    } else {
      return Promise.resolve(appSettings);
    }
  }

  /**
   * Sets a user setting.
   * @param setting name of the setting to change.
   * @param value new setting value.
   */
  static setUserSettingAsync(setting: string, value: string) {
    const xhrOptions: XhrOptions = {
      method: 'POST',
    };
    const requestUrl = ApiManager.userSettingsUrl + '?key=' + setting + '&value=' + value;
    return ApiManager.sendRequestAsync(requestUrl, xhrOptions);
  }

  /**
   * Gets the user settings JSON from the server.
   */
  static _getUserSettingsAsync() {
    return ApiManager.sendRequestAsync(ApiManager.userSettingsUrl);
  }


  /**
   * Gets the app settings JSON from the server.
   */
  static _getAppSettingsAsync() {
    return ApiManager.sendRequestAsync(ApiManager.appSettingsUrl);
  }


}