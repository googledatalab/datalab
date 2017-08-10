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

class JupyterApiManager extends BaseApiManager {

  private _basepathPromise: Promise<string>;

  public getBasePath(): Promise<string> {
    if (!this._basepathPromise) {
      this._basepathPromise = this._xhrTextAsync(this.getServiceUrl(ServiceId.BASE_PATH))
        .then((basepath: string) => basepath.replace(/\/$/, ''))
        .catch((e) => {
          console.error('Could not get base path: ' + e.message);
          return '';
        });
    }
    return this._basepathPromise;
  }

  public getServiceUrl(serviceId: ServiceId): string {
    switch (serviceId) {
      case ServiceId.APP_SETTINGS:
        return '/api/settings';
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
        return '/_settings';
      default:
        throw new Error('Unknown service id: ' + serviceId);
    }
  }
}
