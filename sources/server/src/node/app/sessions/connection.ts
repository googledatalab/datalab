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
import actions = require('../shared/actions');
import socketio = require('socket.io');
import updates = require('../shared/updates');
import util = require('../common/util');


/**
 * Server-side portion of client-server DataLab websocket message protocol
 *
 * Instances of this class also own the socket.io socket instance for the user connection.
 */
export class ClientConnection implements app.IClientConnection {

  id: string;

  _socket: socketio.Socket;
  _delegateActionHandler: app.EventHandler<app.notebooks.actions.Action>;
  _delegateDisconnectHandler: app.EventHandler<app.IClientConnection>;

  constructor (
      id: string,
      socket: socketio.Socket,
      onDisconnect: app.EventHandler<app.IClientConnection>
      ) {
    this.id = id;
    this._socket = socket;
    this._delegateDisconnectHandler = onDisconnect;

    this._registerHandlers();
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
  getConnectionData (): app.ClientConnectionData {
    return {
      notebookPath: this._socket.handshake.query.notebookPath
    }
  }

  /**
   * Registers a callback to be invoked whenever an Action message arrives from the client.
   */
  onAction (callback: app.EventHandler<app.notebooks.actions.Action>) {
    this._delegateActionHandler = callback;
  }

  /**
   * Sends an update message to the user
   */
  sendUpdate (update: app.notebooks.updates.Update) {
    this._send(updates.label, update);
  }

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
