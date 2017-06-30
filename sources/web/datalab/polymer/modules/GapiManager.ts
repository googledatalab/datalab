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

/// <reference path="./ApiManager.ts" />
/// <reference path="./gapi.d.ts" />

/**
 * This file contains a collection of functions that interact with gapi.
 */
class GapiManager {

  static clientId = '';   // Gets set by loadClientId()
  static DISCOVERYDOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
  static SCOPES = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/devstorage.full_control';

  /**
   * Loads the gapi module and the auth2 modules.
   */
  static loadGapi(signInChangedCallback:(signedIn:boolean)=>void) {
    // Loads the gapi client library and the auth2 library together for efficiency.
    // Loading the auth2 library is optional here since `gapi.client.init` function will load
    // it if not already loaded. Loading it upfront can save one network request.
    GapiManager.loadClientId()
      .then(() => {
        gapi.load('client:auth2', this._initClient.bind(this, signInChangedCallback));
      });
  }

  static signIn(doPrompt: boolean) {
    const rePromptOptions = 'login consent select_account';
    const promptFlags = doPrompt ? rePromptOptions : '';
    const options = {
      prompt: promptFlags,
    };
    gapi.auth2.getAuthInstance().signIn(options);
  }

  static signOut() {
    gapi.auth2.getAuthInstance().signOut();
  }

  static _initClient(signInChangedCallback:(signedIn:boolean)=>void) {
    // Initialize the client with API key and People API, and initialize OAuth with an
    // OAuth 2.0 client ID and scopes (space delimited string) to request access.
    gapi.client.init({
      'discoveryDocs': GapiManager.DISCOVERYDOCS,
      'clientId': GapiManager.clientId,
      'scope': GapiManager.SCOPES,
    })
    .then(() => {
      // Listen for auth changes
      gapi.auth2.getAuthInstance().isSignedIn.listen(() => this._signInChanged(signInChangedCallback));
      // Initialize with current signed-in state
      this._signInChanged(signInChangedCallback);
    });
  }

  static _signInChanged(signInChangedCallback:(signedIn:boolean)=>void) {
    const signedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
    signInChangedCallback(signedIn);
  }

  static getSignedInEmail() {
    return gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail();
  }

  static loadClientId() {
    return ApiManager.getUserSettings()
      .then((settings: common.UserSettings) => {
        if (settings.oauth2ClientId) {
          GapiManager.clientId =  settings.oauth2ClientId;
        }
      })
      .catch(() => console.log('Failed to get the user settings.'));
  }
}
