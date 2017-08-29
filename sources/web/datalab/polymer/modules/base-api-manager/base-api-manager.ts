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
 * Options for _xhr call, contains the following optional fields:
 *  - failureCodes: List of recoverable failure codes.
 *  - method: The HTTP method to use; default is 'GET'.
 *  - noCache: Disable request cache.
 *  - parameters: Set of parameters to pass to the xhr request.
 *  - successCodes: Only treat the request as successful if the return code is in this list.
 */
interface XhrOptions {
  failureCodes?: number[];
  headers?: {[key: string]: string};
  method?: string;
  noCache?: boolean;
  parameters?: string | FormData;
  successCodes?: [number];
}

/**
 * A list of services offered by backends.
 */
enum ServiceId {
  APP_SETTINGS,
  BASE_PATH,
  CONTENT,
  SESSIONS,
  TERMINALS,
  TIMEOUT,
  USER_SETTINGS,
}

/**
 * An abstraction for sending xhr requests to the backend service, including
 * getting the basepath for all upcoming requests
 */
// TODO: Rename to ApiManager once we refactor the current ApiManager, and
// remove next line
// tslint:disable-next-line:interface-name
interface ApiManager {

  /**
   * Current connection status. Set to the last connection status.
   */
  isConnected: boolean;

  /**
   * Handlers for connected/disconnected status. These will be called when the
   * isConnected property changes value.
   */
  // TODO: Consider making these actual events so that multiple users can attach
  // listeners
  connectedHandler: () => void;
  disconnectedHandler: () => void;

  /**
   * Returns a Promise that resolves to the base path.
   */
  getBasePath(): Promise<string>;

  /**
   * Sends an XMLHttpRequest to the specified URL, adding the required
   * base path, and expecting a JSON response. This method returns immediately
   * with a promise that resolves with the parsed object when the request completes.
   */
  sendRequestAsync(url: string, options?: XhrOptions, prependBasepath?: boolean): Promise<any>;

  /**
   * Sends an XMLHttpRequest to the specified URL, adding the required
   * base path, and expecting a text response. This method returns immediately
   * with a promise that resolves with the returned text when the request completes.
   */
  sendTextRequestAsync(url: string, options?: XhrOptions, prependBasepath?: boolean)
      : Promise<string>;

  /**
   * Returns the relative path for the given service name.
   */
  getServiceUrl(serviceId: ServiceId): string;
}

abstract class BaseApiManager implements ApiManager {

  public isConnected = true;

  public connectedHandler: () => void;
  public disconnectedHandler: () => void;

  public abstract getBasePath(): Promise<string>;

  public async sendRequestAsync(url: string, options?: XhrOptions, prependBasepath = true)
      : Promise<any> {
    if (prependBasepath) {
      const basepath = await this.getBasePath();
      url = basepath + url;
    }
    return this._xhrJsonAsync(url, options);
  }

  public async sendTextRequestAsync(url: string, options?: XhrOptions, prependBasepath = true)
      : Promise<string> {
    if (prependBasepath) {
      const basepath = await this.getBasePath();
      url = basepath + url;
    }
    return this._xhrTextAsync(url, options);
  }

  public getServiceUrl(serviceId: ServiceId): string {
    switch (serviceId) {
      case ServiceId.APP_SETTINGS:
        return '/_appsettings';
      case ServiceId.BASE_PATH:
        return '/api/basepath';
      case ServiceId.CONTENT:
        return '/api/contents';
      case ServiceId.SESSIONS:
        return '/api/sessions';
      case ServiceId.TERMINALS:
        return '/api/terminals';
      case ServiceId.TIMEOUT:
        return '/_timeout';
      case ServiceId.USER_SETTINGS:
        return '/_usersettings';
      default:
        throw new Error('Unknown service id: ' + serviceId);
    }
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, and returns the
   * the response text. This method returns immediately with a promise
   * that resolves with the response text when the request completes.
   */
  protected _xhrTextAsync(url: string, options?: XhrOptions): Promise<string> {

    options = options || {};
    const method = options.method || 'GET';
    const params = options.parameters;
    const successCodes = options.successCodes || [200];
    const request = new XMLHttpRequest();
    const noCache = options.noCache || false;
    const failureCodes = options.failureCodes;
    const headers = options.headers;

    return new Promise((resolve, reject) => {
      request.onreadystatechange = () => {
        if (request.readyState === 4) {
          if (successCodes.indexOf(request.status) > -1) {

            // If this is the first success after failures, call the connected handler
            if (!this.isConnected && this.connectedHandler) {
              this.connectedHandler();
            }
            this.isConnected = true;

            try {
              resolve(request.responseText);
            } catch (e) {
              reject(e);
            }
          } else {

            // If this is an unexpected failure, call the disconnected handler
            if (!failureCodes || failureCodes.indexOf(request.readyState) > -1) {
              if (this.isConnected && this.disconnectedHandler) {
                this.disconnectedHandler();
              }
              this.isConnected = false;
            }

            // Jupyter returns error messages with schema {"reason": string, "message": string}
            // TODO: Should not need this when relying on a different content service.
            let errorMessage = request.responseText;
            try {
              errorMessage = JSON.parse(request.responseText).message || errorMessage;
            } catch (_) {
              // This is fine, if the error isn't a JSON, return it as is.
            }
            reject(new Error(errorMessage));
          }
        }
      };

      request.open(method, url);
      if (headers) {
        for (const k of Object.keys(headers)) {
          request.setRequestHeader(k, headers[k]);
        }
      }
      if (noCache) {
        request.setRequestHeader('Cache-Control', 'no-cache');
      }
      request.send(params);
    });
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, and parses the
   * the response text as json. This method returns immediately with a promise
   * that resolves with the parsed object when the request completes.
   */
  private _xhrJsonAsync(url: string, options?: XhrOptions) {
    return this._xhrTextAsync(url, options)
      .then((response: string) => JSON.parse(response || 'null'));
  }
}
