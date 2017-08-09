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

// DaaS is Datalab as a Service
class DaasApiManager extends BaseApiManager {

  /**
   * URL for retrieving the base path
   */
  private readonly _basepathApiUrl = '/api/basepath';

  private _basepathPromise: Promise<string>;

  /**
   * XSRF token, if required, undefined until we call basepathApiUrl
   */
  private _xsrfToken = '';

  public getBasePath(): Promise<string> {
    if (!this._basepathPromise) {
      this._basepathPromise = this._xhrTextAsync(this._basepathApiUrl)
        .then((response: string) => {
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
              return this._xhrTextAsync(this._basepathApiUrl, xhrOptions)
                .then((basePathResponse: string) => {
                  if (!basePathResponse.startsWith(xssiPrefix)) {
                    // The server didn't give us a basepath, even after we sent
                    // it the token. We give up.
                    throw new Error('unknown basepath prefix');
                  } else {
                    // We sent the token, so we should have a basepath.
                    // Make sure it doesn't have a trailing slash.
                    basePathResponse = basePathResponse.substr(xssiPrefix.length);
                    const basepath = (JSON.parse(basePathResponse) as XssiResponse).basepath;
                    return basepath.replace(/\/$/, '');
                  }
                });
            }
          }
        });
    }
    return this._basepathPromise;
  }

  public getServiceUrl(_: ServiceId): string {
    throw new Error('Not implemented');
  }
}
