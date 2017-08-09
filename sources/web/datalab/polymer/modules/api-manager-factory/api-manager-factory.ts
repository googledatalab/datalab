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
 * Dependency custom element for ApiManager
 */
const API_MANAGER_ELEMENT = {
  daas: {
    path: 'not/implemented',
    type: undefined,
  },
  jupyter: {
    path: 'modules/jupyter-api-manager/jupyter-api-manager.html',
    type: JupyterApiManager
  },
};

/**
 * Maintains and gets the static ApiManager singleton.
 */
// TODO: Find a better way to switch the ApiManager instance based on the
// environment
class ApiManagerFactory {

  private static _apiManager: IApiManager;

  public static getInstance() {
    if (!ApiManagerFactory._apiManager) {
      const backendType = ApiManagerFactory._getBackendType();

      Polymer.importHref(backendType.path, undefined, undefined, true);
      ApiManagerFactory._apiManager = new backendType.type();
    }

    return ApiManagerFactory._apiManager;
  }

  private static _getBackendType() {
    return API_MANAGER_ELEMENT.jupyter;
  }
}
