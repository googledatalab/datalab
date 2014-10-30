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
import socketio = require('socket.io');


/**
 * Implements server-side portion of client-server DataLab message protocol
 *
 * Instances of this class also own the socket.io socket instance for the user connection.
 *
 * Because type information is lost when messages are sent over socket.io connections
 * the message protocol implemented here uses the socket.io *event* name to carry type information.
 * This allows the messaging protocol be typed on both sides (without doing message introspection)
 * at the cost of having one event per type.
 */
export class UserConnection implements app.IUserConnection {

  id: string;

  _socket: socketio.Socket;

  constructor (id: string, socket: socketio.Socket) {
    this.id = id;
    this._socket = socket;
    this._registerHandlers()
  }

  /**
   * Gets an id for the session that corresponds to this user connection instance
   */
  getSessionId (): string {
    // TODO(bryantd): just use the ip address for the session id as stop-gap solution.
    // This approach works if you assume all users will have unique IP addresses (not necessarily
    // true) and that a user is only working with a single notebook at a time (we want to support
    // working with multiple notebook simultaneously).
    //
    // Notes/thoughts on how to actually implement this eventually follow:
    // Needs to be a value unique to given user and persistent across refreshes.
    // Not sufficient to just set a cookie because need to support multiple
    // (different) notebooks open at the same time by a single user.
    //
    // Should be able to deterministically derive a session id from
    // (notebookId, userId) tuple.  userId could be an actual userId or
    // just some value that we set via cookie.
    //
    // Possible solution: (userId, notebookId) --> uuid.v5 (if opaque id is desirable)
    // Another solution '%s+%s' % (userId, notebookId) (if non-opaque id is desirable)
    //
    // Currently prefer an opaque id so that code doesn't start relying upon the id's structure
    // (and so it can be changed easily if we need to further qualify the session id in the future)
    //
    // See also the authorization hook in socket.io if we need to augment
    // the connection handshake data to insert the session identifier and make it available here
    // https://github.com/Automattic/socket.io/wiki/Authorizing
    //
    // Note: the url of the webpage that initiated the connection (which has the notebook id)
    // is available via socket.handshake.headers.referer --> http://host:port/notebooks/<id>
    return this._socket.handshake.address.address;
  }

  /**
   * Registers a callback that is invoked whenever the user disconnects
   */
  onDisconnect (callback: app.EventHandler<app.IUserConnection>) {
    this._delegateDisconnectHandler = callback;
  }

  /**
   * Registers a callback to be invoked when a user sends a code execution request
   */
  onExecuteRequest (callback: app.EventHandler<app.ExecuteRequest>) {
    this._delegateExecuteRequestHandler = callback;
  }

  /**
   * Sends an execute reply message to the user
   */
  sendExecuteReply (reply: app.ExecuteReply) {
    this._send('execute-reply', reply);
  }

  /**
   * Sends an execute result message to the user
   */
  sendExecuteResult (result: app.ExecuteResult) {
    this._send('execute-result', result);
  }

  /**
   * Sends a kernel status message to the user
   */
  sendKernelStatus (status: app.KernelStatus) {
    this._send('kernel-status', status);
  }

  _delegateExecuteRequestHandler (message: app.ExecuteRequest) {}

  _delegateDisconnectHandler (connection: app.IUserConnection) {}

  /**
   * Handles connection cleanup and delegates to registered event handler
   *
   * Invoked whenever a user disconnects from the server (e.g., closes/refreshes browser)
   */
  _handleDisconnect () {
    // Any connection-level cleanup/finalization goes here
    this._delegateDisconnectHandler(this);
  }

  /**
   * Validates that the received message is an ExecuteRequest and delegates
   */
  _handleExecuteRequest (message: any) {
    // Validate that the message is an ExecuteRequest (structurally)
    if (!message.requestId || !message.code) {
      // TODO(bryantd): make this an error-level message once logger supporting levels is added
      console.log('Malformed request for the execute request message: ', message);
      // TODO(bryantd): eventually emit some sort of error response to the front-end
    } else {
      this._delegateExecuteRequestHandler (<app.ExecuteRequest>message);
    }
  }

  /**
   * Register callbacks to handle events/messages arriving via socket.io connection
   */
  _registerHandlers () {
    this._socket.on('disconnect', this._handleDisconnect.bind(this));
    this._socket.on('execute', this._handleExecuteRequest.bind(this));
  }

  _send (type: string, message: any) {
    this._socket.emit(type, message);
  }
}
