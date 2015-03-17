/*
 * Copyright 2014 Google Inc. All rights reserved.
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


/// <reference path="../../../../../../externs/ts/node/node-uuid.d.ts" />
import uuid = require('node-uuid');
import util = require('../common/util');
import sessions = require('./session');


/**
 * Manages the lifecycles of a set of sessions between users and kernels.
 *
 * When a user connects, the session manager specifies which session the user should
 * join, which may involve creating a new session or joining an existing one.
 *
 * In short, the session manager contains all of the business logic for how to bind together
 * users and kernels into session objects.
 */
export class SessionManager implements app.ISessionManager {

  _connectionIdToSession: app.Map<app.ISession>;
  _sessionIdToSession: app.Map<app.ISession>;
  _kernelManager: app.IKernelManager;
  _messageProcessors: app.MessageProcessor[];
  _notebookStorage: app.INotebookStorage;
  _userconnManager: app.IUserConnectionManager;

  constructor (
      kernelManager: app.IKernelManager,
      messageProcessors: app.MessageProcessor[],
      notebookStorage: app.INotebookStorage,
      userconnManager: app.IUserConnectionManager) {

    this._kernelManager = kernelManager;
    this._messageProcessors = messageProcessors;
    this._notebookStorage = notebookStorage;
    this._userconnManager = userconnManager;

    this._connectionIdToSession = {};
    this._sessionIdToSession = {};
    this._registerHandlers();
  }

  /**
   * Rename a session by modifying its id to be the new session id.
   */
  renameSession (oldId: string, newId: string) {
    // Retrieve the existing session if it exists.
    var session = this._sessionIdToSession[oldId];
    if (!session) {
      throw util.createError('Session id "%s" was not found.', oldId);
    }
    // Rename the session by updating the id.
    session.id = newId;
    // Store the session under the new id.
    this._sessionIdToSession[newId] = session;
    // Remove the old id mapping for the session.
    delete this._sessionIdToSession[oldId];
  }

  /**
   * Binds the user connection to a new kernel instance via a newly created session object.
   *
   * TODO(bryantd): Consider making this entire session creation call path async
   * to avoid blocking the server on file i/o (reading in notebook state). Persisting notebooks
   * to local disk is already done async. When implementing the async route, there are also
   * a few async json parsing libraries if parsing large notebooks becomes a bottleneck.
   *
   * This server blocking issue becomes more prominent when in a heavy-usage, multi-user
   * environment (where many sessions are being created).
   */
  _createSession (sessionId: string, connection: app.IUserConnection) {

    var kernel = this._kernelManager.create({
      iopubPort: util.getAvailablePort(),
      shellPort: util.getAvailablePort()
    });

    return new sessions.Session(
      sessionId,
      kernel,
      this._handleMessage.bind(this),
      connection.getHandshakeNotebookPath(),
      this._notebookStorage,
      connection);
  }

  /**
   * Gets the session id for the given user connection.
   */
  _getSessionId (connection: app.IUserConnection): string {
    // TODO(bryantd): evaluate if there are any cases where the sessionId must be a uuid.
    //
    // For now, ensure that all use cases of the session ID only assume it to be a opaque
    // string-based identifier so that it's trivial to switch to something like uuid.v5 in the
    // future; uuid.v4 is not suitable here because the goal is for any client that wants to edit
    // a specific notebook (uniquely identified by notebookPath) to share a single session. Thus
    // uuid.v5(notebookPath) would be one way of ensuring session id collision whenever the
    // notebookPath is the same for multiple clients, while still having a fixed-size, known
    // character-set, string-based identifier.
    return connection.getHandshakeNotebookPath();
  }

  /**
   * Receives and processes all messages flowing through all sessions owned by this instance.
   *
   * Session objects that pass control to this method also supply a "next action" callback for
   * returning control to the session after the middleware stack has had an opportunity
   * to manipulate a given message.
   */
  _handleMessage (message: any, session: app.ISession, callback: app.EventHandler<any>) {
    // Invoke each handler in the chain in order.
    //
    // If a handler returns null, the the message is considered "filtered" and processing
    // of the message stops.
    var processedMessage = message;
    for (var i = 0; i < this._messageProcessors.length; ++i) {
      processedMessage = this._messageProcessors[i](processedMessage, session, this);
      if (processedMessage === null) {
        // Then this message has been filtered, no further processing.
        console.log('Filtered: ', JSON.stringify(message));
        break;
      }
    }

    // Return control to the messaging stack via Session object that corresponds to this message
    // if the message was not filtered by one of the message handlers.
    if (processedMessage !== null) {
      callback(processedMessage);
    }
  }

  /**
   * Binds the new user connection to a session and configures session event handling.
   *
   * If the session for the given connection already exists, the new connection reconnects to the
   * existing session.
   */
  _handleUserConnect (connection: app.IUserConnection) {
    var sessionId = this._getSessionId(connection);

    // Retrieve an existing session for the specified session id if it exists.
    var session = this._sessionIdToSession[sessionId];
    if (!session) {
      // No existing session with given id, so create a new session.
      session = this._createSession(sessionId, connection);
      this._sessionIdToSession[sessionId] = session;
    } else {
      // Update existing session object with new user connection.
      session.addUserConnection(connection);
    }

    // Store a mapping from connection to the associated session so that the session can be
    // retrieved on disconnect.
    this._connectionIdToSession[connection.id] = session;
  }

  _handleUserDisconnect (connection: app.IUserConnection) {
    // Find the session associated with this connection.
    var session = this._connectionIdToSession[connection.id];

    if (!session) {
      throw util.createError(
        'Associated session not found when attempting to close connection id "%s"', connection.id);
    }

    // Remove the connection from the session.
    session.removeUserConnection(connection);
    // Remove the connection => session mapping
    delete this._connectionIdToSession[connection.id];
  }

  _registerHandlers () {
    this._userconnManager.onConnect(this._handleUserConnect.bind(this));
    this._userconnManager.onDisconnect(this._handleUserDisconnect.bind(this));
  }
}
