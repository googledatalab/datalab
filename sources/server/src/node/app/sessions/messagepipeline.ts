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


import utils = require('../common/util');
import sessions = require('./session');


/**
 * Controls the flow of messages between users and kernels.
 *
 * Binds together kernel and user connections via session objects and provides support
 * for passing some/all messages to a middleware stack for processing/interception/etc.
 */
export class MessagePipeline {

  _userconnManager: app.IUserConnectionManager;
  _kernelManager: app.IKernelManager;
  _idToSession: app.Map<app.ISession>;
  _messageProcessors: app.MessageProcessor[];

  constructor (
      userconnManager: app.IUserConnectionManager,
      kernelManager: app.IKernelManager,
      messageProcessors: app.MessageProcessor[]) {
    this._userconnManager = userconnManager;
    this._kernelManager = kernelManager;
    this._messageProcessors = messageProcessors;
    this._idToSession = {};
    this._registerHandlers();
  }

  /**
   * Binds the user connection to a new kernel instance via a newly created session object
   */
  _createSession (sessionId: string, connection: app.IUserConnection) {
    var kernel = this._kernelManager.create({
      iopubPort: utils.getAvailablePort(),
      shellPort: utils.getAvailablePort()
    });
    return new sessions.Session(sessionId, connection, kernel, this._handleMessage.bind(this));
  }

  /**
   * Receives and processes all messages flowing through all sessions owned by this instance
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
      processedMessage = this._messageProcessors[i](processedMessage, session);
      if (processedMessage === null) {
        // Then this message has been filtered, no further processing
        console.log('Filtered: ', JSON.stringify(message));
        break;
      }
    }

    // Return control to the messaging stack via Session object that corresponds to this message
    // if the message was not filtered by one of the message handlers
    if (processedMessage !== null) {
      callback(processedMessage);
    }
  }

  /**
   * Binds the new user connection to a session and configures session event handling
   *
   * If the session for the given connection already exists, the new connection reconnects to the
   * existing session.
   */
  _handleUserConnect (connection: app.IUserConnection) {
    var sessionId = connection.getSessionId();
    var session = this._idToSession[sessionId];
    if (!session) {
      // Create a brand new session object
      session = this._createSession(sessionId, connection);
      this._idToSession[sessionId] = session;
    } else {
      // Update existing session object with new user connection
      session.updateUserConnection(connection);
    }
  }

  _handleUserDisconnect (connection: app.IUserConnection) {
    // TODO(bryantd): implement procedure for tear down after user disconnect such that if the
    // same user (as identified by session id) reconnects, the previous kernel instance is re-used,
    // (i.e., implement disconnect such that reconnect is possible).
  }

  _registerHandlers () {
    this._userconnManager.onConnect(this._handleUserConnect.bind(this));
    this._userconnManager.onDisconnect(this._handleUserDisconnect.bind(this));
  }
}
