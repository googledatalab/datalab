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
 * This file contains a collection of functions that call the ApiManager APIs to
 * manage Sessions. It also defines a set of interfaces to interact with these
 * APIs to help with type checking.
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
   * Returns a list of currently running session paths.
   */
  public static listSessionPaths(): Promise<string[]> {
    return this.listSessionsAsync()
      .then((sessions: Session[]) => sessions.map((s) => s.notebook.path));
  }

  /**
   * Terminates a running session.
   */
  public static shutdownSessionAsync(sessionId: string) {
    const xhrOptions: XhrOptions = {
      method: 'DELETE',
      successCodes: [204],
    };
    return ApiManager.sendRequestAsync(
        ApiManager.getServiceUrl(ServiceId.SESSIONS) + '/' + sessionId, xhrOptions);
  }

  /**
   * Returns a list of currently running Session objects.
   */
  public static listSessionsAsync(): Promise<Session[]> {
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return ApiManager.sendRequestAsync(ApiManager.getServiceUrl(ServiceId.SESSIONS),
        xhrOptions) as Promise<Session[]>;
  }

}
