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

/// <reference path="../../../common.d.ts" />

/**
 * Represents a Jupyter terminal object.
 */
interface JupyterTerminal {
  name: string;
}

/**
 * Handles different API calls to the backend's terminals service.
 */
class TerminalManager {

  /**
   * Initializes a terminal session.
   */
  public static startTerminalAsync() {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      method: 'POST',
    };
    return apiManager.sendRequestAsync(apiManager.getServiceUrl(ServiceId.TERMINALS), xhrOptions);
  }

  /**
   * Returns a list of active terminal sessions.
   */
  public static listTerminalsAsync() {
    const apiManager = ApiManagerFactory.getInstance();
    return apiManager.sendRequestAsync(apiManager.getServiceUrl(ServiceId.TERMINALS));
  }

}
