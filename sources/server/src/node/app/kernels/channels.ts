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


/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/node/zmq.d.ts" />
import zmq = require('zmq');


/**
 * Client for communicating with a single kernel channel over a zmq socket
 */
export class ChannelClient {

  _connectionUrl: string;
  _port: number;
  _socketType: string;
  _socketIdentity: string
  _socket: zmq.Socket;

  constructor(connectionUrl: string, port: number, socketIdentity: string, socketType: string) {
    this._connectionUrl = connectionUrl;
    this._port = port;
    this._socketIdentity = socketIdentity;
    this._socketType = socketType;
    this._socket = null; // initialized on connect()
  }

  connect(): void {
    if (!this._socket) {
      this._createSocket();
    }
    this._socket.connect(this._connectionUrl + this._port);
  }

  disconnect(): void {
    this._socket.close();
  }

  /**
   * Creates a zmq socket and initializes it with appropriate event handlers.
   */
  _createSocket() {
    if (!this._socketType) {
      throw new Error("Improperly initialized channel client. Define a socket type.");
    }

    this._socket = zmq.socket(this._socketType);

    this._socket.on('message', this._receive.bind(this));
  }

  /**
   * Sends a multi-part message on the zmq socket
   *
   * @param messageParts a multipart message
   */
  _send(messageParts: string[]): void {
    this._socket.send(messageParts);
  }

  /**
   * Handles a multipart message received from the zmq socket
   */
  _receive () {
    throw new Error("Abstract. This method should be implemented by subclass");
  }

}
