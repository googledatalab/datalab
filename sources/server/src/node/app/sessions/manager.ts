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


/// <reference path="../../../../../../externs/ts/node/socket.io.d.ts" />
/// <reference path="../../../../../../externs/ts/node/node-uuid.d.ts" />
import conn = require('./connection');
import sessions = require('./session');
import socketio = require('socket.io');
import uuid = require('node-uuid');
import util = require('../common/util');


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

  _connectionIdToConnection: app.Map<app.IClientConnection>;
  _connectionIdToSession: app.Map<app.ISession>;
  _sessionPathToSession: app.Map<app.ISession>;
  _kernelManager: app.IKernelManager;
  _messageProcessors: app.MessageProcessor[];
  _notebookStorage: app.INotebookStorage;
  _socketioManager: socketio.SocketManager;

  constructor (
      kernelManager: app.IKernelManager,
      messageProcessors: app.MessageProcessor[],
      notebookStorage: app.INotebookStorage,
      socketioManager: socketio.SocketManager) {

    this._kernelManager = kernelManager;
    this._messageProcessors = messageProcessors;
    this._notebookStorage = notebookStorage;
    this._socketioManager = socketioManager;

    this._connectionIdToSession = {};
    this._connectionIdToConnection = {};
    this._sessionPathToSession = {};

    this._registerHandlers();
  }

  /**
   * Gets a session by its path if it exists.
   *
   * @param sessionPath The session path to get.
   * @return A session or null if the path was not found.
   */
  get(sessionPath: string): app.ISession {
    return this._sessionPathToSession[sessionPath] || null;
  }

  /**
   * Gets the list of sessions currently managed by this instance.
   *
   * @return The set of active sessions.
   */
  list(): app.ISession[] {
    return Object.keys(this._sessionPathToSession).map((sessionPath) => {
      return this._sessionPathToSession[sessionPath];
    });
  }

  /**
   * Synchronously renames a session by modifying its path to be the new session path.
   *
   * Throws an exception if the given session path does not exist.
   *
   * @param oldPath The current/old session path to be renamed.
   * @param newPath The updated/new session path.
   */
  rename(oldPath: string, newPath: string) {
    // Retrieve the existing session if it exists.
    var session = this._sessionPathToSession[oldPath];
    if (!session) {
      throw util.createError('Session path "%s" was not found.', oldPath);
    }
    // Rename the session by updating the id.
    session.path = newPath;
    // Store the session under the new id.
    this._sessionPathToSession[newPath] = session;
    // Remove the old path mapping for the session.
    delete this._sessionPathToSession[oldPath];
  }

  /**
   * Asynchronously creates a session for the given resource path.
   *
   * Idempotent. Subsequent calls to create for a pre-existing session have no effect.
   *
   * @param path The resource (e.g., notebook) path for which to create a session.
   * @param callback Completion callback for handling the outcome of the session creation flow.
   */
  create(path: string, callback: Callback<app.ISession>) {
    // FIXME: merge with following create method, make async
  }

  /**
   * Creates a new session for the given notebook path.
   *
   * @param sessionPath The path to assign to the newly created session.
   * @param notebookPath The path of the notebook to associate with the session.
   * @return A new session instance.
   */
  create(sessionPath: string) {
    return new sessions.Session(
        sessionPath,
        this._kernelManager,
        this._handleMessage.bind(this),
        notebookPath,
        this._notebookStorage);
  }

  /**
   * Gets the metadata provided during the connection establishment.
   *
   * Note: a notebook rename causes the notebook path to be changed (at the session level)
   * but that change is not reflected in the return value of this method. That is because
   * this method always returns the value of the notebook path at the time of the connection
   * establishment; i.e., whatever notebook path was part of the original handshake data.
   *
   * So, only assume the notebook path returned here to match the session notebook path at the
   * time of connection establishment.
   */
  _getConnectionData(socket: socketio.Socket): app.ClientConnectionData {
    return {
      notebookPath: socket.handshake.query.notebookPath
    }
  }

  /**
   * Determines which session the connection should be associated with via the session path.
   *
   * Two clients that specify the same session path will join the same session.
   *
   * A single client can also specify a previous session path to re-join a previous session,
   * assuming that session is still alive.
   */
  _getOrCreateSession(socket: socketio.Socket) {
    // FIXME: suppose that sessions are pre-created before connection, so fail this if the session doesnt exist

    var sessionPath = this._getConnectionData(socket).notebookPath;

    // Retrieve an existing session for the specified session path if it exists.
    var session = this._sessionPathToSession[sessionPath];
    if (!session) {
      // No existing session with given path, so create a new session.
      session = this.createSession(sessionPath, notebookPath);
      // Track the session by path
      this._sessionPathToSession[sessionPath] = session;
    }

    return session;
  }

  /**
   * Receives and processes all messages flowing through all sessions owned by this instance.
   *
   * Session objects that pass control to this method also supply a "next action" callback for
   * returning control to the session after the middleware stack has had an opportunity
   * to manipulate a given message.
   */
  _handleMessage(message: any, session: app.ISession, callback: app.EventHandler<any>) {
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
   * Binds the new client connection to a session and configures session event handling.
   *
   * If the session for the given connection already exists, the new connection reconnects to the
   * existing session.
   */
  _handleClientConnect (socket: socketio.Socket) {
    var session = this._getOrCreateSession(socket);

    // Delegate all socket.io Action messages to the session.
    var connection = new conn.ClientConnection(
        uuid.v4(),
        socket,
        session.processAction.bind(session),
        this._handleClientDisconnect.bind(this));
    console.log('User has connected: ' + connection.id);

    // Update existing session object with new user connection.
    session.addClientConnection(connection);

    // Store a mapping from connection to the associated session so that the session can be
    // retrieved on disconnect.
    this._connectionIdToSession[connection.id] = session;
    // Store the mapping of connection id => connection to track the set of connected clients
    // across all sessions.
    this._connectionIdToConnection[connection.id] = connection;
  }

  /**
   * Removes
   */
  _handleClientDisconnect (connection: app.IClientConnection) {
    console.log('User has disconnected: ' + connection.id);

    // Find the session associated with this connection.
    var session = this._connectionIdToSession[connection.id];
    if (!session) {
      throw util.createError(
        'Associated session not found when attempting to close connection id "%s"', connection.id);
    }

    // Remove the connection from the session.
    session.removeClientConnection(connection);

    // Remove the connection from the index
    delete this._connectionIdToConnection[connection.id];
    // Remove the connection => session mapping
    delete this._connectionIdToSession[connection.id];
  }

  _registerHandlers () {
    this._socketioManager.on('connection', this._handleClientConnect.bind(this));
    // Note: disconnect handlers are at the socket/connection level
  }
}
