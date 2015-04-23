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
/// <reference path="../shared/requests.d.ts" />
/// <reference path="../common/interfaces.d.ts" />
import apiutil = require('../common/api');
import express = require('express');
import manager = require('./manager');
import util = require('util');


/**
 * Session management HTTP API
 */
export class SessionApi {

  static sessionsCollectionUrl: string = '/sessions';
  static singleSessionUrl: string = SessionApi.sessionsCollectionUrl + '/:path';
  static singleSessionActionUrl: string = SessionApi.singleSessionUrl + '::';

  _manager: app.ISessionManager;

  /**
   * Constructor.
   *
   * @param manager Instance to which session resource operations should be delegated.
   */
  constructor (manager: app.ISessionManager) {
    this._manager = manager;
  }

  /**
   * Creates a new session for the resource specified by the request 'path' param.
   *
   * Note: idempotent operation. Requesting a session be created for an path that already exists
   * will have no effect.
   *
   * @param request The received HTTP request.
   * @param response The pending HTTP response.
   */
  create(request: express.Request, response: express.Response) {
    var sessionPath = this._getSessionPathOrFail(request, response);
    if (!sessionPath) {
      // Response has been handled. Nothing more to do.
      return;
    }

    this._manager.create(sessionPath, (error: Error, session: app.ISession) => {
      if (error) {
        apiutil.sendInternalError(response, 'Session create operation failed', error);
        return;
      }

      // Send the created session's metadata to the user.
      response.send(this._getSessionMetadata(session));
    });
  }

  /**
   * Gets the single session specified by the request 'path' param if it exists.
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
    var sessions = this._manager.list().map((session) => {
      return this._getSessionMetadata(session);
    });

    var body: app.requests.ListSessionsResponse = {
      sessions: sessions
    };

    response.send(body);
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
    var session = this._getSessionOrFail(request, response);
    if (!session) {
      // Response has been handled. Nothing more to do.
      return;
    }

    session.reset((error) => {
      if (error) {
        apiutil.sendInternalError(response, 'Session reset operation failed', error);
        return;
      }

      // Reset succeeded.
      apiutil.sendSuccessWithoutResponseContent(response);
    });
  }

  /**
   * Shuts down the session specified by the request 'path' param.
   *
   * Note: will also shutdown any kernel process associated with the session.
   *
   * @param request The received HTTP request.
   * @param response The pending HTTP response.
   */
  shutdown(request: express.Request, response: express.Response) {
    var session = this._getSessionOrFail(request, response);
    if (!session) {
      // Response has been handled by getSessionOrFail. Nothing more to do.
      return;
    }

    this._manager.shutdown(session.path, (error) => {
      if (error) {
        apiutil.sendInternalError(response, 'Session shutdown operation failed', error);
        return;
      }

      // Shutdown succeeded.
      apiutil.sendSuccessWithoutResponseContent(response);
    });
  }

  /**
   * Registers routes for the session API
   *
   * @param router The Express router to which each URL route handler should be attached.
   */
  register(router: express.Router): void {
    // Read-only operations
    router.get(SessionApi.singleSessionUrl, this.get.bind(this));
    router.get(SessionApi.sessionsCollectionUrl, this.list.bind(this));

    // State-modifying operations
    router.post(SessionApi.singleSessionUrl, this.create.bind(this));
    router.post(SessionApi.singleSessionActionUrl + 'reset', this.reset.bind(this));
    router.post(SessionApi.singleSessionActionUrl + 'shutdown', this.shutdown.bind(this));
  }

  /**
   * Transforms a session into a data-only object suitable for string-ification.
   */
  _getSessionMetadata(session: app.ISession): app.SessionMetadata {
    return {
      path: session.path,
      createdAt: session.createdAt.toISOString(),
      numClients: session.getClientConnectionIds().length
    };
  }

  /**
   * Gets the session path from the request or fails the request (via response object).
   */
  _getSessionPathOrFail(request: express.Request, response: express.Response): string {
    var sessionPath = request.param('path', null);
    if (!sessionPath) {
      apiutil.sendBadRequest(response, 'No path was specified in the request URL.');
    }

    return sessionPath;
  }

  /**
   * Gets the session specified by the request route or fails the request (via response object).
   */
  _getSessionOrFail(request: express.Request, response: express.Response): app.ISession {
    // Get the session path from the request.
    var sessionPath = this._getSessionPathOrFail(request, response);

    // Lookup the session by sessionPath.
    var session = this._manager.get(sessionPath);

    if (!session) {
      // Session resource with given sessionPath was not found.
      apiutil.sendNotFound(response, util.format('Session path "%s" was not found.', sessionPath));
    }

    return session;
  }

}
