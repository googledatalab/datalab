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
import logging = require('../common/logging');
import messages = require('../shared/messages');
import sessions = require('./session');
import socketio = require('socket.io');
import uuid = require('node-uuid');
import util = require('../common/util');


var logger = logging.getLogger();

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
   * Asynchronously creates a session for the given resource path.
   *
   * Idempotent. Subsequent calls to create for a pre-existing session have no effect.
   *
   * @param path The resource (e.g., notebook) path for which to create a session.
   * @param callback Completion callback for handling the outcome of the session creation flow.
   */
  create(sessionPath: string, callback: app.Callback<app.ISession>) {
    // Retrieve an existing session for the specified session path if it exists.
    var session = this._sessionPathToSession[sessionPath];
    if (session) {
      // Session already exists, so just signal completion.
      process.nextTick(callback.bind(null, null, session));
      return;
    }

    // Create a new session since one did not already exist.
    session =  new sessions.Session(
        sessionPath,
        this._kernelManager,
        this._handleMessage.bind(this),
        this._notebookStorage);

    // Track the session by path
    this._sessionPathToSession[sessionPath] = session;

    // Start the session and provide the completion callback to be invoked when session is fully
    // initialized.
    session.start((error) => {
      if (error) {
        // If an error occurred when starting the session, immediately shutdown the session
        // to clean up any resources.
        this.shutdown(session.path, (shutdownError) => {
          // If shutdown failed, log the error.
          logger.error('Failed to shutdown session "%s" due to %s', sessionPath, shutdownError);
          // Pass the original session startup error back to the caller.
          callback(error);
        });
        return;
      }

      // Pass the newly created session and any errors that may have occurred back to the caller.
      callback(null, session);
    });
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

  shutdown(sessionPath: string, callback: app.Callback<void>) {
    // Retrieve the session that should be shut down
    var session = this._sessionPathToSession[sessionPath];
    if (!session) {
      process.nextTick(callback.bind(null,
        util.createError('Session path "%s" does not exist', sessionPath)));
    }

    // Ask the session to shutdown asynchronously.
    session.shutdown((error: Error) => {
      // Verify that the shutdown was successful.
      if (error) {
        // Shutdown failed, so pass error to caller.
        callback(error);
        return;
      }

      // Now that the session has been shutdown, untrack it.
      delete this._sessionPathToSession[sessionPath];

      // Done with shutdown, so invoke the completion callback.
      callback(null);
    });
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
        logger.debug('Filtered: ', JSON.stringify(message));
        break;
      }
    }

    // Return control to the messaging stack via Session object that corresponds to this message
    // if the message was not filtered by one of the message handlers.
    if (processedMessage !== null) {
      callback(processedMessage);
    }
  }

  _getOrCreateSession(sessionPath: string, callback: app.Callback<app.ISession>) {
    // Lookup the session path in the set of active sessions to see if it already exists.
    var session = this._sessionPathToSession[sessionPath];
    if (session) {
      // Session already exists, so just return it.
      process.nextTick(callback.bind(null, null, session));
    }

    // No existing session for given session path, so create one.
    this.create(sessionPath, callback);
  }

  /**
   * Binds the new client connection to a session and configures session event handling.
   *
   * If the session for the given connection already exists, the new connection (re)connects to the
   * existing session.
   *
   * Two clients that specify the same session path will join the same session.
   *
   * A single client can also specify a previous session path to re-join a previous session,
   * assuming that session is still alive.
   *
   * The current session model assumes that session creation should always be completed before
   * connections are permitted. So, if the session does not exist, the connection is closed
   * immediately.
   *
   * @param socket A socket.io connection.
   */
  _handleClientConnect(socket: socketio.Socket) {
    // Get the existing session for the session path specified in the socket connection handshake.
    var sessionPath = this._getConnectionData(socket).notebookPath;

    this._getOrCreateSession(sessionPath, (error, session) => {
      if (error) {
        // Close the socket connection immediately if the session could not be created.
        //
        // Terminating the connection from the server side is insufficient, because the client will
        // attempt to reconnect. So, send a message on the established connection informing the
        // client that it should close the connection from the client side.
        socket.emit(messages.terminateConnection);
        return;
      }

      var connectionId = socket.id;

      // Avoid duplicate socket.io connect events that can occur for a single (active) connection.
      if (this._connectionIdToSession[connectionId]) {
        // Duplicate connect event for existing connection. Nothing to do.
        return;
      }

      // Delegate all socket.io Action messages to the session.
      var connection = new conn.ClientConnection(
          connectionId,
          socket,
          session.processAction.bind(session),
          this._handleClientDisconnect.bind(this));

      // Update existing session object with new user connection.
      session.addClientConnection(connection);
      logger.info('User %s has connected', connection.id);

      // Store a mapping from connection to the associated session so that the session can be
      // retrieved on disconnect.
      this._connectionIdToSession[connection.id] = session;
      // Store the mapping of connection id => connection to track the set of connected clients
      // across all sessions.
      this._connectionIdToConnection[connection.id] = connection;
    });
  }

  /**
   * Removes the connection upon client disconnect.
   *
   * @param connection A client connection.
   */
  _handleClientDisconnect(connection: app.IClientConnection) {
    // Find the session associated with this connection.
    var session = this._connectionIdToSession[connection.id];
    if (!session) {
      // Could have received a duplicate disconnect event if the session is already untracked.
      //
      // Nothing to do if there is no session mapped to the connection.
      return;
    }

    // Remove the connection from the session.
    session.removeClientConnection(connection);
    logger.info('User %s has disconnected.', connection.id);

    // Remove the connection from the index
    delete this._connectionIdToConnection[connection.id];
    // Remove the connection => session mapping
    delete this._connectionIdToSession[connection.id];
  }

  _registerHandlers() {
    this._socketioManager.on('connection', this._handleClientConnect.bind(this));
    // Note: disconnect handlers are at the socket/connection level
  }
}
