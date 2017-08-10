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
 * This file contains a collection of functions that call the Jupyter server APIs, and are
 * wrapped in the ApiManager class. It also defines a set of interfaces to interact with
 * these APIs to help with type checking.
 */

/// <reference path="../../../common.d.ts" />

/**
 * Represents a session object as returned from sessions API.
 */
interface Session {
  id: string;
  kernel: {
    id: string;
    name: string;
  };
  notebook: {
    path: string;
  };
}

/**
 * Handles different API calls to the backend's session service.
 */
class SessionManager {

  /**
   * Returns a list of currently running sessions, each implementing the Session interface
   */
  public static listSessionsAsync(): Promise<Session[]> {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return apiManager.sendRequestAsync(apiManager.getServiceUrl(ServiceId.SESSIONS),
        xhrOptions) as Promise<Session[]>;
  }

  /**
   * Terminates a running session.
   */
  public static shutdownSessionAsync(sessionId: string) {
    const apiManager = ApiManagerFactory.getInstance();
    const xhrOptions: XhrOptions = {
      method: 'DELETE',
      successCodes: [204],
    };
    return apiManager.sendRequestAsync(
        apiManager.getServiceUrl(ServiceId.SESSIONS) + '/' + sessionId, xhrOptions);
  }

}
