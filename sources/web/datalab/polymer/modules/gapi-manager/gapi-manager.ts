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

/// <reference path="../../../../../../third_party/externs/ts/gapi/bigquery.d.ts" />
/// <reference path="../../../../../../third_party/externs/ts/gapi/drive.d.ts" />

class MissingClientIdError extends Error {
  message = 'No oauth2ClientId found in app settings or config';
}

enum GapiScopes {
  CLOUD,
  DRIVE,
  SIGNIN,
}

// The GapiAuth interface handles initialization and authorization of gapi.
interface GapiAuth {
  getAccessToken(): Promise<string>;
  getSignedInEmail(): Promise<string>;
  listenForSignInChanges(signInChangedCallback: (isSignedIn: boolean) => void):
      Promise<void>;
  loadGapiAndScopes(
      moduleName: string, moduleVersion: string, scopes: GapiScopes):
      Promise<void>;
  signIn(doPrompt?: boolean): Promise<void>;
  signOut(): Promise<void>;
  isServerAuth(): boolean;
}

// Ask for all necesary scopes up front so we don't need to ask again later.
// Cloud-platform scope covers BigQuery and GCS but not Drive.
const initialScopes = [ GapiScopes.SIGNIN, GapiScopes.CLOUD, GapiScopes.DRIVE ];

class ClientAuth implements GapiAuth {

  private _clientId = '';   // Gets set by _loadClientId()
  private _currentUser: gapi.auth2.GoogleUser; // Gets set by _loadClientId
  private _loadPromise: Promise<void>;

  /** Always returns false because we do not do server-side auth flow. */
  public isServerAuth() {
    return false;
  }

  /**
   * Starts the sign-in flow using gapi.
   * If the user has not previously authorized our app, this will redirect to oauth url
   * to ask the user to select an account and to consent to our use of the scopes.
   * If the user has previously signed in and the doPrompt flag is false, the redirect will
   * happen momentarily before automatically closing. If the doPrompt flag is set, then
   * the user will be prompted as if authorization has not previously been provided.
   */
  public async signIn(doPrompt?: boolean): Promise<void> {
    const rePromptOptions = 'login consent select_account';
    const promptFlags = doPrompt ? rePromptOptions : '';
    const options = {
      prompt: promptFlags,
    };
    await this._loadGapi();
    gapi.auth2.getAuthInstance().signIn(options);
  }

  /**
   * Signs the user out using gapi.
   */
  public signOut(): Promise<void> {
    return this._loadGapi()
      .then(() => gapi.auth2.getAuthInstance().signOut());
  }

  /**
   * Returns a promise that resolves to the signed-in user's email address.
   */
  public async getSignedInEmail(): Promise<string> {
    await this._loadGapi();
    const user = await this.getCurrentUser();
    return user.getBasicProfile().getEmail();
  }

  /**
   * Observes changes to the sign in status, and calls the provided callback
   * with the changes.
   */
  public listenForSignInChanges(signInChangedCallback: (isSignedIn: boolean) => void):
      Promise<void> {
    return this._loadGapi()
      .then(() => {
        // Initialize the callback now
        signInChangedCallback(gapi.auth2.getAuthInstance().isSignedIn.get());

        // Listen for auth changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(() => {
          signInChangedCallback(gapi.auth2.getAuthInstance().isSignedIn.get());
        });
      });
  }

  /**
   * Gets the current user's access token.
   */
  public async getAccessToken(): Promise<string> {
    const user = await this.getCurrentUser();
    return user.getAuthResponse().access_token;
  }

  /**
   * Gets the info we need to pass along about our access token.
   */
  public async getAccessTokenInfo() {
    const account = await this.getCurrentUser();
    const token = account.getAuthResponse();
    return {
      access_token: token.access_token,
      account: account.getBasicProfile().getEmail(),
      expires_in: token.expires_in,
      scopes: token.scope,
      token_type: 'Bearer',
    };
  }

  /**
   * Loads the requested gapi module and ensures we have the requested scope.
   */
  public async loadGapiAndScopes(
      moduleName: string, moduleVersion: string, scopes: GapiScopes):
      Promise<void> {
    await this._loadGapi();
    await gapi.client.load(moduleName, moduleVersion);
    await this._grantScope(scopes);
  }

  /**
   * Get the currently logged in user.
   */
  private async getCurrentUser(): Promise<gapi.auth2.GoogleUser> {
    await this._loadGapi();
    return this._currentUser;
  }

  /**
   * Requests a new scope to be granted.
   */
  private async _grantScope(scope: GapiScopes): Promise<any> {
    await this._loadGapi();
    const currentUser = await this.getCurrentUser();
    if (!currentUser.hasGrantedScopes(this._getScopeString(scope))) {
      return new Promise((resolve, reject) => {
        const options = new gapi.auth2.SigninOptionsBuilder();
        options.setScope(this._getScopeString(scope));
        options.setPrompt('consent');
        gapi.auth2.getAuthInstance().signIn(options)
          .then(() => {
            resolve();
          }, () => reject());
      });
    }
    return Promise.resolve();
  }

  /**
   * Loads the gapi module and the auth2 modules. This can be called multiple
   * times, and it will only load the gapi module once.
   * @param signInChangedCallback callback to be called when the signed-in state changes
   * @returns a promise that completes when the load is done or has failed
   */
   private _loadGapi(): Promise<void> {
    // Loads the gapi client library and the auth2 library together for efficiency.
    // Loading the auth2 library is optional here since `gapi.client.init` function will load
    // it if not already loaded. Loading it upfront can save one network request.
    if (!this._loadPromise) {
      this._loadPromise = new Promise((resolve, reject) => {
        return this._loadClientId()
          .then(() => gapi.load('client:auth2', resolve))
          .catch((e: Error) => {
            if (e instanceof MissingClientIdError) {
              Utils.log.error(e.message);
            }
            reject(e);
          });
      })
      .then(() => this._initClient());
    }

    return this._loadPromise;
  }

  /*
   * Initialize the client and initialize OAuth with an
   * OAuth 2.0 client ID and scopes (space delimited string) to request access.
   */
  private _initClient(): Promise<void> {
    const initialScopeString = initialScopes.map(
      (scopeEnum) => this._getScopeString(scopeEnum)).join(' ');
    // TODO: Add state parameter to redirect the user back to the current URL
    // after the OAuth flow finishes.
    return gapi.auth2.init({
      client_id: this._clientId,
      fetch_basic_profile: true,
      redirect_uri: Utils.getHostRoot(),
      scope: initialScopeString,
      ux_mode: 'redirect',
    })
    // The return value of gapi.auth2.init is not a normal promise
    .then(() => {
      this._currentUser = gapi.auth2.getAuthInstance().currentUser.get();
    }, (errorReason: any) => {
      throw new Error('Error in gapi auth: ' + errorReason.details);
    });
  }

  /**
   * Loads the oauth2 client id. Looks first in the app settings,
   * then in the config-local file.
   */
  private async _loadClientId(): Promise<void> {
    let clientId = await this._loadClientIdFromAppSettings();
    if (!clientId) {
      clientId = await this._loadClientIdFromConfigFile();
    }
    if (!clientId) {
      throw new MissingClientIdError();
    }
    this._clientId = clientId;
  }

  /**
   * Loads the oauth2 client id from the app settings.
   */
  private _loadClientIdFromAppSettings(): Promise<string> {
    return SettingsManager.getAppSettingsAsync()
      .then((settings: common.AppSettings) => {
        return settings.oauth2ClientId;
      })
      .catch(() => {
        return '';
      });
  }

  /**
   * Loads the oauth2 client id from the config-local file.
   */
  private _loadClientIdFromConfigFile(): Promise<string> {
    return SettingsManager.loadConfigToWindowDatalab()
      .catch()  // We will detect errors below when we see if the clientId exists
      .then(() => {
        if (window.datalab && window.datalab.oauth2ClientId) {
          return window.datalab.oauth2ClientId;
        } else {
          return '';
        }
      });
  }

  private _getScopeString(scope: GapiScopes): string {
    // https://developers.google.com/identity/protocols/googlescopes
    switch (scope) {
      case GapiScopes.CLOUD:
        return 'https://www.googleapis.com/auth/cloud-platform';
      case GapiScopes.DRIVE:
        const driveScopeList = [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.appdata',
            'https://www.googleapis.com/auth/drive.install',
        ];
        return driveScopeList.join(' ');
      case GapiScopes.SIGNIN:
          return 'profile email';
      default:
        throw new Error('Unknown gapi scope: ' + scope);
    }
  }
}

class ServerAuth implements GapiAuth {
  _isSignedIn: boolean;
  _signInChangedCallback: (isSignedIn: boolean) => void;

  private _loadPromise: Promise<void>;
  private _refreshTimeoutId: number;

  /** Always returns true because we do server-side auth flow. */
  public isServerAuth() {
    return true;
  }

  /**
   * Starts the sign-in flow.
   * If the user has not previously authorized our app, this will redirect to oauth url
   * to ask the user to select an account and to consent to our use of the scopes.
   * If the user has previously signed in, the redirect will
   * happen momentarily before automatically closing.
   */
  public async signIn(_doPrompt?: boolean): Promise<void> {
    let accessToken = await GapiManager.auth.getAccessToken();
    if (!accessToken) {
      // We don't have an access token, but we might have a refresh token (which
      // we can't see because it is HttpOnly). Try refreshing our access token,
      // then check again to see if that worked.
      await this.refreshToken();
      accessToken = await GapiManager.auth.getAccessToken();
    }
    if (!accessToken) {
      // No access token, even after trying a refresh, so ask user to log in again.
      const currentPath = window.location.pathname;
      const authLoginUrl = window.location.origin + '/auth/login?page=' + currentPath;
      window.location.replace(authLoginUrl);
      return;
    }
    this.setIsSignedIn(true);
  }

  /**
   * Signs the user out.
   */
  public async signOut(): Promise<void> {
    // We sign out by deleting our cookies.
    Utils.deleteCookie('DATALAB_ACCESS_TOKEN');
    Utils.deleteCookie('DATALAB_REFRESH_TOKEN');
    this.setIsSignedIn(false);
    await this.logout();
    return Promise.resolve();
  }

  /**
   * Returns a promise that resolves to the signed-in user's email address.
   */
  public async getSignedInEmail(): Promise<string> {
    const userInfo = await this.getUserInfo();
    return userInfo.email;
  }

  /**
   * Observes changes to the sign in status, and calls the provided callback
   * with the changes.
   */
  public listenForSignInChanges(signInChangedCallback: (isSignedIn: boolean) => void):
      Promise<void> {
    this._signInChangedCallback = signInChangedCallback;
    return Promise.resolve();
  }

  /**
   * Gets the current user's access token.
   */
  public async getAccessToken(): Promise<string> {
    const accessTokenBase64 = Utils.readCookie('DATALAB_ACCESS_TOKEN', true);
    if (!accessTokenBase64) {
      return '';
    }
    const json = atob(accessTokenBase64);
    const accessToken = JSON.parse(json);
    return accessToken.value;
  }

  /**
   * Gets the info we need to pass along about our access token.
   */
  public async getAccessTokenInfo() {
    const xhrOptions: XhrOptions = {
      successCodes: [200, 401],   // Auth errors are expected
    };
    const accessToken = await this.getAccessToken();
    const infoUrl = 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + accessToken;
    const tokenInfo = await ApiManager.sendRequestAsync(infoUrl, xhrOptions, false);
    return {
      access_token: accessToken,
      account: tokenInfo.email,
      expires_in: tokenInfo.expiresIn,
      scopes: tokenInfo.scope,
      token_type: 'Bearer',
    };
  }

  public async loadGapiAndScopes(
      moduleName: string, moduleVersion: string, _scopes: GapiScopes):
      Promise<void> {
    await this.signIn();
    await this._loadGapi();
    await gapi.client.load(moduleName, moduleVersion);
  }

  /**
   * Sets our internal flag as to whether we are signed in, and calls the
   * _signInChangedCallback if the signedIn value just changed and there is a
   * callback.
   */
  private setIsSignedIn(isSignedIn: boolean) {
    if (isSignedIn !== this._isSignedIn) {
      this._isSignedIn = isSignedIn;
      if (this._signInChangedCallback) {
        this._signInChangedCallback(isSignedIn);
      }
      if (isSignedIn) {
        this.setRefreshTokenTimeout();
      } else {
        Utils.log.verbose('Not signed in, clearing refresh token timeout');
        this.clearRefreshTokenTimeout();
      }
    }
  }

  private async getUserInfo(): Promise<any> {
    const xhrOptions: XhrOptions = {
      successCodes: [200, 401],   // Auth errors are expected
    };
    const userInfoPath = '/_auth/userinfo';
    const userInfo =
      await ApiManager.sendRequestAsync(userInfoPath, xhrOptions, false);
    if (userInfo && userInfo.error && userInfo.error.code === 401) {
      // If we get an invalid-credentials errors, sign out so the user
      // will be asked for sign in on the next request.
      Utils.log.verbose('Auto-sign-out due to invalid credentials');
      GapiManager.auth.signOut();
      return {};
    }
    return userInfo;
  }

  private async logout(): Promise<boolean> {
    const xhrOptions: XhrOptions = {
      successCodes: [200],
    };
    const logoutPath = '/_auth/logout';
    const result = await ApiManager.sendRequestAsync(logoutPath, xhrOptions, false);
    if (result && result.error) {
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  /**
   * Gets the expiration time for the access token, or null if no token.
   */
  private async getAccessTokenExpiry(): Promise<Date | null> {
    const accessTokenBase64 = Utils.readCookie('DATALAB_ACCESS_TOKEN', true);
    if (!accessTokenBase64) {
      return null;
    }
    const json = atob(accessTokenBase64);
    const accessToken = JSON.parse(json);
    const expiry = new Date(accessToken.expiry);
    Utils.log.verbose('Access token expires', expiry);
    return expiry;
  }

  /**
   * Sends a request to the service to refresh our access token.
   */
  private async refreshToken(): Promise<void> {
    const xhrOptions: XhrOptions = {
      failureCodes: [401],
      successCodes: [200],
    };
    const refreshPath = '/_auth/refresh';
    try {
      await ApiManager.sendRequestAsync(refreshPath, xhrOptions, false);
    } catch (e) {
      // If we get an invalid-credentials errors, sign out so the user
      // will be asked for sign in on the next request.
      Utils.log.verbose('Auto-sign-out due to invalid credentials');
      GapiManager.auth.signOut();
    }
  }

  private async refreshTokenAndTimeout(): Promise<void> {
    await this.refreshToken();
    if (this._isSignedIn) {
      this.setRefreshTokenTimeout();
    }
  }

  private async setRefreshTokenTimeout() {
    this.clearRefreshTokenTimeout();
    const timeoutMillis = await this.calculateRefreshTokenTimeoutMillis();
    this._refreshTimeoutId =
        window.setTimeout(() => this.refreshTokenAndTimeout(), timeoutMillis);
  }

  private clearRefreshTokenTimeout() {
    if (this._refreshTimeoutId) {
      window.clearTimeout(this._refreshTimeoutId);
      this._refreshTimeoutId = 0;
    }
  }

  private async calculateRefreshTokenTimeoutMillis() {
    const now = Date.now();
    const tokenExpirationTime = await this.getAccessTokenExpiry();
    const expirationMillis =
        tokenExpirationTime ? tokenExpirationTime.getTime() : 0;
    const millisToExpiration = expirationMillis - now;
    const minCheckMillis = 60 * 1000;
        // If expiration is less than this, refresh quickly
    const minTimeoutMillis = 500;
        // Wait minimum half second before refresh to avoid spinning in case of bugs
    const timeoutMillis =
        millisToExpiration < minCheckMillis ? minTimeoutMillis : millisToExpiration / 2;
    Utils.log.verbose('Seconds until token refresh:', timeoutMillis / 1000);
    return timeoutMillis;
  }

  /**
   * Loads the gapi module and the gapi client modules. This can be called multiple
   * times, and it will only load the gapi module once.
   * @returns a promise that completes when the load is done or has failed
   */
   private _loadGapi(): Promise<void> {
    // Loads the gapi client library.
    if (!this._loadPromise) {
      this._loadPromise = new Promise((resolve, reject) => {
        return Promise.resolve()
          .then(() => gapi.load('client',
              () => { Utils.log.verbose('gapi loaded'); resolve(); }))
          .catch((e: Error) => {
            if (e instanceof MissingClientIdError) {
              Utils.log.error(e.message);
            }
            reject(e);
          });
      })
      .then(() => this._initClient());
    }
    return this._loadPromise;
  }

  /*
  * Initialize the client and initialize OAuth with an
  * OAuth 2.0 client ID and scopes (space delimited string) to request access.
  */
  private async _initClient(): Promise<void> {
    Utils.log.verbose('in _initClient');
    const accessToken = await this.getAccessToken();
    if (accessToken) {
      gapi.client.setToken({access_token: accessToken});
    }
    return Promise.resolve();
  }
}

/**
 * This module contains a collection of functions that interact with gapi.
 */
class GapiManager {

  public static drive = class {

    public static getRoot(): Promise<gapi.client.drive.File> {
      const request: gapi.client.drive.GetFileRequest = {
        fileId: 'root',
      };
      return this._load()
        .then(() => gapi.client.drive.files.get(request))
        .then((response) => JSON.parse(response.body));
    }

    /**
     * Creates a file with the specified name under the specified parent
     * directory. If the content argument isn't empty, it's patched to the file
     * in a subsequent request.
     */
    public static async create(mimeType: string, parentId: string, name: string, content = '')
        : Promise<gapi.client.drive.File> {
      await this._load();
      let createPromise = gapi.client.drive.files.create({
          mimeType,
          name,
          parents: [parentId],
        })
        .then((response) => response.result);

      if (content) {
        createPromise = createPromise
          .then((file) => this.patchContent(file.id, content));
      }

      return createPromise;
    }

    /**
     * Makes a copy of the given file, and optionally moves this new copy into
     * the given parent directory.
     */
    public static async copy(fileId: string, destinationId?: string)
        : Promise<gapi.client.drive.File> {
      await this._load();
      return gapi.client.drive.files.copy({fileId})
        .then((response) => {
          const newFile = response.result;
          if (destinationId) {
            return this.renameFile(newFile.id, newFile.name, destinationId);
          } else {
            return newFile;
          }
        });
    }

    /**
     * Saves the given string content to the specified file.
     */
    public static async patchContent(fileId: string, content: string)
        : Promise<gapi.client.drive.File> {
      await this._load();
      return gapi.client.request({
          body: content,
          method: 'PATCH',
          params: {
            uploadType: 'media'
          },
          path: '/upload/drive/v3/files/' + fileId,
        })
      .then((response) => response.result as gapi.client.drive.File);
    }

    /**
     * Rename the given file to the new name, and optionally move it to the
     * given parent directory.
     */
    public static async renameFile(fileId: string, newName: string, newParentId?: string) {
      await this._load();
      const request: gapi.client.drive.UpdateFileRequest = {
        fileId,
        resource: {
          name: newName,
        },
      };
      if (newParentId) {
        const file = await this.getFile(fileId, ['parents']);
        const prevParents = file.parents.join(',');
        request.addParents = newParentId;
        request.removeParents = prevParents;
      }
      return gapi.client.drive.files.update(request)
        .then((response) => response.result);
    }

    /**
     * Delete the given file.
     */
    public static async deleteFile(fileId: string): Promise<void> {
      await this._load();
      return gapi.client.drive.files.delete({fileId})
        .then((response) => response.result);
    }

    /**
     * Gets a list of files with the specified query.
     */
    public static async listFiles(fileFields: string[], queryPredicates: string[],
                                  orderBy?: string[]): Promise<gapi.client.drive.File[]> {
      await this._load();
      return gapi.client.drive.files.list({
        fields: 'nextPageToken, files(' + fileFields.join(',') + ')',
        orderBy: orderBy ? orderBy.join(',') : '',
        // TODO: Implement paging.
        pageSize: 1000,
        q: queryPredicates.join(' and '),
      })
      .then((response: HttpResponse<gapi.client.drive.ListFilesResponse>) => {
        return response.result.files;
      }, (response: HttpResponse<{error: Error}>) => {
        throw response.result.error;
      });
    }

    /**
     * Get the file object associated with the given id.
     */
    public static async getFile(fileId: string, fields?: string[]): Promise<gapi.client.drive.File> {
      await this._load();
      const request: gapi.client.drive.GetFileRequest = {
        fileId,
      };
      if (fields) {
        request.fields = fields.join(',');
      }
      return gapi.client.drive.files.get(request)
        .then((response: HttpResponse<gapi.client.drive.File>) => response.result,
              (response: HttpResponse<{error: Error}>) => {
          throw response.result.error;
        });
    }

    /**
     * Get the file data associated with the given id, along with its contents
     * as a string. Returns an array of the file object and its contents.
     */
    public static async getFileWithContent(id: string)
        : Promise<[gapi.client.drive.File, string | null]> {
      await this._load();
      const accessToken = await GapiManager.auth.getAccessToken();
      const xhrOptions: XhrOptions = {
        headers: {Authorization: 'Bearer ' + accessToken},
        noCache: true,
      };
      const file: gapi.client.drive.File = await ApiManager.sendRequestAsync(
            'https://www.googleapis.com/drive/v2/files/' + id,
            xhrOptions,
            false);
      let content = null;
      if (file.downloadUrl) {
        content = await ApiManager.sendTextRequestAsync(file.downloadUrl,
                                                        xhrOptions,
                                                        false);
      }
      return [file, content];
    }

    public static load(): Promise<void> {
      return this._load();
    }

    private static _load(): Promise<void> {
      return GapiManager.auth.loadGapiAndScopes('drive', 'v3', GapiScopes.DRIVE);
    }

  };

  public static bigquery = class {

    /**
     * Gets the list of BigQuery projects, returns a Promise.
     */
    public static listProjects(pageToken?: string):
        Promise<gapi.client.HttpRequestFulfilled<gapi.client.bigquery.ListProjectsResponse>> {
      const request = {
        maxResults: 1000,
        pageToken,
      } as gapi.client.bigquery.ListProjectsRequest;
      return this._load()
        .then(() => gapi.client.bigquery.projects.list(request));
    }

    /**
     * Gets the list of BigQuery datasets in the specified project, returns a Promise.
     * @param projectId
     * @param filter A label filter of the form label.<name>[:<value>], as described in
     *     https://cloud.google.com/bigquery/docs/reference/rest/v2/datasets/list
     */
    public static listDatasets(projectId: string, filter: string, pageToken?: string):
        Promise<gapi.client.HttpRequestFulfilled<gapi.client.bigquery.ListDatasetsResponse>> {
      const request = {
        filter,
        maxResults: 1000,
        pageToken,
        projectId,
      } as gapi.client.bigquery.ListDatasetsRequest;
      return this._load()
        .then(() => gapi.client.bigquery.datasets.list(request));
    }

    /**
     * Gets the list of BigQuery tables in the specified project and dataset,
     * returns a Promise.
     */
    public static listTables(projectId: string, datasetId: string, pageToken?: string):
        Promise<gapi.client.HttpRequestFulfilled<gapi.client.bigquery.ListTablesResponse>> {
      const request = {
        datasetId,
        maxResults: 1000,
        pageToken,
        projectId,
      } as gapi.client.bigquery.ListTablesRequest;
      return this._load()
        .then(() => gapi.client.bigquery.tables.list(request));
    }

    /**
     * Fetches table details from BigQuery
     */
    public static getTableDetails(projectId: string, datasetId: string, tableId: string):
        Promise<gapi.client.HttpRequestFulfilled<gapi.client.bigquery.Table>> {
      const request = {
        datasetId,
        projectId,
        tableId,
      };
      return this._load()
        .then(() => gapi.client.bigquery.tables.get(request));
    }

    /**
     * Fetches table rows from BigQuery
     */
    public static getTableRows(projectId: string, datasetId: string,
                               tableId: string, maxResults: number):
        Promise<gapi.client.HttpRequestFulfilled<gapi.client.bigquery.ListTabledataResponse>> {
      const request = {
        datasetId,
        maxResults,
        projectId,
        tableId,
      };
      return this._load()
        .then(() => gapi.client.bigquery.tabledata.list(request));
    }

    private static _load(): Promise<void> {
      return GapiManager.auth.loadGapiAndScopes('bigquery', 'v2', GapiScopes.CLOUD);
    }

  };

  public static resourceManager = class {

    /**
     * Returns a list of all projects from the resource manager API. It concatenates
     * all projects returned into one long list.
     */
    public static async listAllProjects() {
      await this._load();
      let nextPageToken = null;
      const allProjects: gapi.client.cloudresourcemanager.Project[] = [];
      do {
        const result: any = await gapi.client.request({
            method: 'GET',
            params: {
              pageToken: nextPageToken,
            },
            path: 'https://cloudresourcemanager.googleapis.com/v1/projects',
          })
          .then((response) => response.result);
        allProjects.push(...result.projects);
        nextPageToken = result.nextPageToken;
      } while (nextPageToken);

      return allProjects;
    }

    private static _load(): Promise<void> {
      return GapiManager.auth.loadGapiAndScopes('cloudresourcemanager', 'v1', GapiScopes.CLOUD);
    }
  };

  /**
   * The auth class is responsible for initializing authorization, including
   * loading the gapi code and any data needed for oauth.
   */
  public static auth = GapiManager._initAuth();

  // Use server auth if the user has requested it by manually setting a cookie.
  // In the dev console, when on a Datalab page, enter this command:
  //   document.cookie="DATALAB_USE_SERVER_AUTH=1"
  private static _initAuth() {
    if (!!Utils.readCookie('DATALAB_USE_SERVER_AUTH')) {
      Utils.log.verbose('Using ServerAuth');
      return new ServerAuth();
    } else {
      Utils.log.verbose('Using ClientAuth');
      return new ClientAuth();
    }
  }
}
