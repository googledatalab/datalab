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
import updates = require('../shared/updates');
import actions = require('../shared/actions');


/**
 * Server-side portion of client-server DataLab websocket message protocol
 *
 * Instances of this class also own the socket.io socket instance for the user connection.
 */
export class UserConnection implements app.IUserConnection {

  id: string;

  _socket: socketio.Socket;

  constructor (id: string, socket: socketio.Socket) {
    this.id = id;
    this._socket = socket;

    this._registerHandlers();
  }

  /**
   * Gets the notebook path provided during the connection establishment handshake
   *
   * Note: a notebook rename causes the notebook path to be changed (at the session level)
   * but that change is not reflected in the return value of this method. That is because
   * this method always returns the value of the notebook path at the time of the connection
   * establishment; i.e., whatever notebook path was part of the original handshake data.
   *
   * So, only assume the notebook path returned here to match the session notebook path at the
   * time of connection establishment.
   */
  getHandshakeNotebookPath (): string {
    return this._socket.handshake.query.notebookPath;
  }

  /**
   * Registers a callback that is invoked whenever an action message is received
   */
  onAction (callback: app.EventHandler<app.notebooks.actions.Action>) {
    this._delegateActionHandler = callback;
  }

  /**
   * Registers a callback that is invoked whenever the user disconnects
   */
  onDisconnect (callback: app.EventHandler<app.IUserConnection>) {
    this._delegateDisconnectHandler = callback;
  }

  /**
   * Sends an update message to the user
   */
  sendUpdate (update: app.notebooks.updates.Update) {
    this._send(updates.label, update);
  }

  _delegateActionHandler (action: app.notebooks.actions.Action) {}

  _delegateDisconnectHandler (connection: app.IUserConnection) {}

  /**
   * Handles the received action request by delegating to the session for processing
   */
  _handleAction (action: app.notebooks.actions.Action) {
    this._delegateActionHandler(action);
  }

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
   * Register callbacks to handle events/messages arriving via socket.io connection
   */
  _registerHandlers () {
    this._socket.on('disconnect', this._handleDisconnect.bind(this));
    this._socket.on(actions.label, this._handleAction.bind(this));
  }

  _send (type: string, message: any) {
    this._socket.emit(type, message);
  }
}
