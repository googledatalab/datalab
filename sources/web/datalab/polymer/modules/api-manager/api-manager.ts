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
  CREDENTIALS,
  SESSIONS,
  TERMINALS,
  TIMEOUT,
  USER_SETTINGS,
}

/**
 * XHR response for XSSI attacks after the magic prefix.
 */
interface XssiResponse {
  basepath: string;
  token: string;
}

/**
 * An abstraction for sending xhr requests to the backend service, including
 * getting the basepath for all upcoming requests
 */
class ApiManager {

  public static isConnected = true;

  // TODO: Consider making these event targets to allow multiple listeners
  public static connectedHandler: () => void;
  public static disconnectedHandler: () => void;

  /**
   * XSRF token, if required, undefined until we call basepathApiUrl
   */
  private static _xsrfToken = '';

  public static async getBasePath(): Promise<string> {
    const basePathUrl = this.getServiceUrl(ServiceId.BASE_PATH);
    let response = await this._xhrTextAsync(basePathUrl, { noCache: true });
    // The server may add the xssiPrefix to the response to prevent.
    // it being parsed as if it were a javascript file.
    const xssiPrefix = ')]}\'\n';
    if (!response.startsWith(xssiPrefix)) {
      // If no xssi prefix is there, the response should be pure text.
      // This will be the case when the basepath is on localhost.
      return response.replace(/\/$/, '');
    } else {
      // We did get a response with an xssi prefix, the rest of the
      // response will be JSON, which we can parse after removing the
      // prefix.
      response = response.substr(xssiPrefix.length);
      const j = JSON.parse(response) as XssiResponse;
      if (j.basepath) {
        // The response includes a basepath.
        // Check to ensure that the basepath doesn't have a trailing slash.
        return j.basepath.replace(/\/$/, '');
      } else {
        // The response didn't include the basepath, it should have
        // and xsrf token for us to use to retry our request as a POST.
        this._xsrfToken = j.token;
        const formData = new FormData();
        // The server expects the xsrfToken as FormData.
        formData.append('token', this._xsrfToken);
        const xhrOptions: XhrOptions = {
          method: 'POST',
          noCache: true,
          parameters: formData,
        };
        let postResponse = await this._xhrTextAsync(basePathUrl, xhrOptions);
        if (!postResponse.startsWith(xssiPrefix)) {
          // The server didn't give us a basepath, even after we sent
          // it the token. We give up.
          throw new Error('unknown basepath prefix');
        } else {
          // We sent the token, so we should have a basepath.
          // Make sure it doesn't have a trailing slash.
          postResponse = postResponse.substr(xssiPrefix.length);
          const basepath = (JSON.parse(postResponse) as XssiResponse).basepath;
          return basepath.replace(/\/$/, '');
        }
      }
    }
  }

  public static async sendRawRequestAsync(url: string, options?: XhrOptions, prependBasepath = true)
      : Promise<XMLHttpRequest> {
    if (prependBasepath) {
      const basepath = await this.getBasePath();
      url = basepath + url;
    }
    return this._xhrRequestAsync(url, options);
  }

  public static async sendRequestAsync(url: string, options?: XhrOptions, prependBasepath = true)
      : Promise<any> {
    if (prependBasepath) {
      const basepath = await this.getBasePath();
      url = basepath + url;
    }
    return this._xhrJsonAsync(url, options);
  }

  public static async sendTextRequestAsync(url: string, options?: XhrOptions, prependBasepath = true)
      : Promise<string> {
    if (prependBasepath) {
      const basepath = await this.getBasePath();
      url = basepath + url;
    }
    return this._xhrTextAsync(url, options);
  }

  public static getServiceUrl(serviceId: ServiceId): string {
    switch (serviceId) {
      case ServiceId.APP_SETTINGS:
        return '/_appsettings';
      case ServiceId.BASE_PATH:
        return '/api/basepath';
      case ServiceId.CONTENT:
        return '/api/contents';
      case ServiceId.CREDENTIALS:
        return '/api/creds';
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

  public static async uploadOauthAccessToken() {
    const account = await GapiManager.getCurrentUser();
    const token = account.getAuthResponse();
    const creds = {
        access_token: token.access_token,
        account: account.getBasicProfile().getEmail(),
        expires_in: token.expires_in,
        scopes: token.scope,
        token_type: 'Bearer',
      };
    const options: XhrOptions = {
      method: 'POST',
      parameters: JSON.stringify(creds)
    };
    return this.sendTextRequestAsync(this.getServiceUrl(ServiceId.CREDENTIALS), options);
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, and returns the
   * the response text. This method returns immediately with a promise
   * that resolves with the response text when the request completes.
   */
  protected static _xhrRequestAsync(url: string, options?: XhrOptions):
      Promise<XMLHttpRequest> {

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
              resolve(request);
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
   * Sends an XMLHttpRequest to the specified URL, and returns the
   * the response text. This method returns immediately with a promise
   * that resolves with the response text when the request completes.
   */
  protected static _xhrTextAsync(url: string, options?: XhrOptions): Promise<string> {
    return this._xhrRequestAsync(url, options)
      .then((request) => request.responseText);
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, and parses the
   * the response text as json. This method returns immediately with a promise
   * that resolves with the parsed object when the request completes.
   */
  private static _xhrJsonAsync(url: string, options?: XhrOptions) {
    return this._xhrTextAsync(url, options)
      .then((response: string) => JSON.parse(response || 'null'));
  }
}
