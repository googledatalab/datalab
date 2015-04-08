/*
 * Copyright 2015 Google Inc. All rights reserved.
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


/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/express/express.d.ts" />
import express = require('express');
import manager = require('./manager');


/**
 * Session management HTTP API
 */
export class SessionApi {

  static sessionsCollectionUrl: string = '/sessions';
  static singleSessionUrl: string = SessionApi.sessionsCollectionUrl + '/:id';
  static singleSessionActionUrl: string = SessionApi.singleSessionUrl + '::';

  _manager: app.ISessionManager;

  constructor (manager: app.ISessionManager) {
    this._manager = manager;
  }

  /**
   * Gets the single session specified by the request 'id' param if it exists.
   *
   * @param request The received HTTP request.
   * @param response The pending HTTP response.
   */
  get(request: express.Request, response: express.Response) {
    var session = this._getSessionOrFail(request, response);
    if (!session) {
      // Response has been handled by getSessionOrFail. Nothing more to do.
      return;
    }
    response.send(this._getSessionMetadata(session));
  }

  /**
   * Gets the list of existing sessions.
   *
   * @param request The received HTTP request.
   * @param response The pending HTTP response.
   */
  list(request: express.Request, response: express.Response) {
    var sessions = this._manager.list();
    response.send(sessions.map((session) => {
      return this._getSessionMetadata(session);
    }));
  }

  /**
   * Renames the session.
   *
   * @param request The received HTTP request.
   * @param response The pending HTTP response.
   */
  rename(request: express.Request, response: express.Response) {
    var sessionId = this._getSessionIdOrFail(request, response);
    if (!sessionId) {
      // Response has been handled. Nothing more to do.
      return;
    }

    // TODO(bryantd): get the new session from the request POST body here

    this._manager.renameSession(sessionId, newId);
  }

  /**
   * Resets the session's (kernel) state.
   *
   * This will also have the effect of cancelling any queued/pending execution requests.
   *
   * @param request The received HTTP request.
   * @param response The pending HTTP response.
   */
  reset(request: express.Request, response: express.Response) {
    var sessionId = this._getSessionIdOrFail(request, response);
    if (!sessionId) {
      // Response has been handled. Nothing more to do.
      return;
    }

    this._manager.resetSession(sessionId);
  }

  /**
   * Shuts down the session specified by the request 'id' param.
   *
   * Note: will also shutdown any kernel process associated with the session.
   */
  shutdown(request: express.Request, response: express.Response) {
    var session = this._getSessionOrFail(request, response);
    if (!session) {
      // Response has been handled by getSessionOrFail. Nothing more to do.
      return;
    }
    this._manager.shutdown(session.id);
    response.sendStatus(200);
  }

  /**
   * Registers routes for the session API
   */
  register(router: express.Router): void {
    router.get(SessionApi.singleSessionUrl, this.get.bind(this));
    router.get(SessionApi.sessionsCollectionUrl, this.list.bind(this));
    router.post(SessionApi.singleSessionActionUrl + 'rename', this.shutdown.bind(this));
    router.post(SessionApi.singleSessionActionUrl + 'reset', this.shutdown.bind(this));
    router.post(SessionApi.singleSessionActionUrl + 'shutdown', this.shutdown.bind(this));
  }

  /**
   * Transforms a session into a data-only object suitable for string-ification.
   */
  _getSessionMetadata(session: app.ISession): any {
    return {
      id: session.id,
      // TODO(bryantd): Add fields needed for display here.
    };
  }

  /**
   * Gets the session ID from the request or fails the response.
   */
  _getSessionIdOrFail(request: express.Request, response: express.Response): string {
    var id = request.param('id', null);
    if (!id) {
      response.sendStatus(400);
    }

    return id;
  }

  /**
   * Gets the session specified by the request route or fails the request (via response object).
   */
  _getSessionOrFail(request: express.Request, response: express.Response): app.ISession {
    // Get the session id from the request.
    var id = this._getSessionIdOrFail(request, response);

    // Lookup the session by id.
    var session = this._manager.get(id);

    if (!session) {
      // Session resource with given id was not found.
      response.sendStatus(404);
    }

    return session;
  }

}

