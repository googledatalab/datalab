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
/// <reference path="../../../../../third_party/externs/ts/gapi/bigquery.d.ts" />
/// <reference path="../../../../../third_party/externs/ts/gapi/gapi.d.ts" />
/// <reference path="../../common.d.ts" />

/**
 * This file contains a collection of functions that interact with gapi.
 */
class GapiManager {

  public static DISCOVERYDOCS = [
    'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    'https://www.googleapis.com/discovery/v1/apis/bigquery/v2/rest'
  ];
  public static SCOPES =
      'https://www.googleapis.com/auth/drive.metadata.readonly ' +
      'https://www.googleapis.com/auth/devstorage.full_control ' +
      'https://www.googleapis.com/auth/bigquery';

  private static _clientId = '';   // Gets set by _loadClientId()

  /**
   * Loads the gapi module and the auth2 modules.
   * @param signInChangedCallback callback to be called when the signed-in state changes
   * @returns a promise that completes when the load is done or has failed
   */
   public static loadGapi(signInChangedCallback: (signedIn: boolean) => void): Promise<void> {
    // Loads the gapi client library and the auth2 library together for efficiency.
    // Loading the auth2 library is optional here since `gapi.client.init` function will load
    // it if not already loaded. Loading it upfront can save one network request.
    console.log('== loading gapi');
    return GapiManager._loadClientId()
      .then(() => gapi.load('client:auth2', this._initClient.bind(this, signInChangedCallback)))
      .catch((e: Error) => console.log('Failed to get client ID: ', e));
  }

  /**
   * Starts the sign-in flow using gapi.
   * If the user has not previously authorized our app, this will open a pop-up window
   * to ask the user to select an account and to consent to our use of the scopes.
   * If the user has previously signed in and the doPrompt flag is false, the pop-up will
   * appear momentarily before automatically closing. If the doPrompt flag is set, then
   * the user will be prompted as if authorization has not previously been provided.
   */
   public static signIn(doPrompt: boolean): Promise<gapi.auth2.GoogleUser> {
    const rePromptOptions = 'login consent select_account';
    const promptFlags = doPrompt ? rePromptOptions : '';
    const options = {
      prompt: promptFlags,
    };
    return gapi.auth2.getAuthInstance().signIn(options);
  }

  /**
   * Signs the user out using gapi.
   */
   public static signOut(): Promise<void> {
    return gapi.auth2.getAuthInstance().signOut();
  }

  /** Returns the signed-in user's email address. */
  public static getSignedInEmail() {
    return gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail();
  }

  /** Gets the list of BigQuery projects, returns a Promise. */
  public static listBigQueryProjects(): gapi.client.HttpRequest<gapi.client.bigquery.ListProjectsResponse> {
    return GapiManager._loadBigQuery().then(() => gapi.client.bigquery.projects.list());
  }

  /** Gets the list of BigQuery datasets in the specified project, returns a Promise.
   * @param projectId
   * @param filter A label filter of the form label.<name>[:<value>], as described in
   *     https://cloud.google.com/bigquery/docs/reference/rest/v2/datasets/list
   */
  public static listBigQueryDatasets(projectId: string, filter: string): gapi.client.HttpRequest<gapi.client.bigquery.ListDatasetsResponse> {
    const request = {
      filter,
      projectId,
    };
    return GapiManager._loadBigQuery().then(() => gapi.client.bigquery.datasets.list(request));
  }

  /** Gets the list of BigQuery tables in the specified project and dataset, returns a Promise. */
  public static listBigQueryTables(projectId: string, datasetId: string): gapi.client.HttpRequest<gapi.client.bigquery.ListTablesResponse> {
    const request = {
      datasetId,
      projectId,
    };
    return GapiManager._loadBigQuery().then(() => gapi.client.bigquery.tables.list(request));
  }

  private static _initClient(signInChangedCallback: (signedIn: boolean) => void) {
    // Initialize the client with API key and People API, and initialize OAuth with an
    // OAuth 2.0 client ID and scopes (space delimited string) to request access.
    gapi.client.init({
      clientId: GapiManager._clientId,
      discoveryDocs: GapiManager.DISCOVERYDOCS,
      scope: GapiManager.SCOPES,
    })
    .then(() => {
      // Listen for auth changes
      gapi.auth2.getAuthInstance().isSignedIn.listen(() =>
          this._signInChanged(signInChangedCallback));
      // Initialize with current signed-in state
      this._signInChanged(signInChangedCallback);
      console.log('== gapi loaded and listening for auth');
    }, (errorReason) => {
      console.log('Error in gapi auth: ' + errorReason.result.error.message);
    });
  }

  private static _signInChanged(signInChangedCallback: (signedIn: boolean) => void) {
    const signedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
    signInChangedCallback(signedIn);
  }

  /**
   * Loads the oauth2 client id from the user settings.
   * This will change once we figure out how we want to do it.
   */
  private static _loadClientId() {
    return SettingsManager.getUserSettingsAsync()
      .then((settings: common.UserSettings) => {
        if (settings.oauth2ClientId) {
          GapiManager._clientId = settings.oauth2ClientId;
        } else {
          throw new Error('No oauth2ClientId found in user settings');
        }
      });
  }

  private static _loadBigQuery(): Promise<void> {
    return gapi.client.load('bigquery', 'v2');
  }
}
