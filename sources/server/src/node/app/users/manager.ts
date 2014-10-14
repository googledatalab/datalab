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
import http = require('http');
import socketio = require('socket.io');
import uuid = require('node-uuid');
import conn = require('./connection');


/**
 * Manages the lifecycle of user connection resources
 *
 * Accepts incoming connections from socket.io and sets up event/message delegation
 */
export class UserConnectionManager implements app.IUserConnectionManager {

  _socketioManager: socketio.SocketManager;
  _idToConnection: app.Map<app.IUserConnection>;

  constructor (socketioManager: socketio.SocketManager) {
    this._socketioManager = socketioManager;
    this._idToConnection = {};
    this._registerHandlers();
  }

  /**
   * Gets a single user connection via connection id
   *
   * Returns null if no connection matching the given id currently exists
   */
  get (id: string): app.IUserConnection {
    return this._idToConnection[id] || null;
  }

  /**
   * Enumerates the set of open user connections
   */
  list (): app.IUserConnection[] {
    return Object.keys(this._idToConnection).map((id) => {
      return this._idToConnection[id];
    });
  }

  /**
   * Registers a callback to be invoked whenever a new user connection is established
   */
  onConnect (callback: app.EventHandler<app.IUserConnection>) {
    this._delegateConnectHandler = callback;
  }

  /**
   * Registers a callback to be invoked whenever a user disconnects
   */
  onDisconnect (callback: app.EventHandler<app.IUserConnection>) {
    this._delegateDisconnectHandler = callback;
  }

  _delegateConnectHandler (connection: app.IUserConnection) {}

  _delegateDisconnectHandler (connection: app.IUserConnection) {}


  _handleConnect (socket: socketio.Socket) {
    var connection = new conn.UserConnection(uuid.v4(), socket);
    console.log('User has connected: ' + connection.id);
    this._idToConnection[connection.id] = connection;

    // Register this manager instance to receive disconnect events for the new connection
    connection.onDisconnect(this._handleDisconnect.bind(this));

    this._delegateConnectHandler(connection);
  }

  /**
   * Cleans up any resources related to the now disconnected user and delegates to event callback
   */
  _handleDisconnect (connection: app.IUserConnection) {
    // Cleanup
    delete this._idToConnection[connection.id];
    // Invoke the registered event callback
    this._delegateDisconnectHandler(connection);
    console.log('User has disconnected: ' + connection.id);
  }

  _registerHandlers () {
    this._socketioManager.on('connection', this._handleConnect.bind(this));
    // Note: disconnect handlers are at the socket/connection level
  }
}
