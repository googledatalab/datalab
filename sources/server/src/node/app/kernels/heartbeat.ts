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


/// <reference path="../../../../../../externs/ts/node/node-uuid.d.ts" />
/// <reference path="../../../../../../externs/ts/node/zmq.d.ts" />
import channels = require('./channels');
import ipy = require('../messages/ipy');
import uuid = require('node-uuid');
import zmq = require('zmq');


var heartbeatInterval = 1000;

/**
 * Client for communicating with the heartbeat channel of a running IPython kernel.
 */
export class HeartbeatChannelClient extends channels.ChannelClient {

  _delegateHealthCheckHandler: app.EventHandler<boolean>;
  _heartbeatInterval: number;

  constructor(
      connectionUrl: string,
      port: number,
      onHealthCheck: app.EventHandler<boolean>) {

    super(connectionUrl, port, 'heartbeat-' + port, 'req');

    this._delegateHealthCheckHandler = onHealthCheck;
    this._start();
  }

  /**
   * Starts the periodic heartbeating.
   */
  _start() {
    console.log('Starting heartbeat...');
    this._heartbeatInterval = setInterval(this._sendHeartbeat.bind(this), heartbeatInterval);
  }

  /**
   * Stops the periodic heartbeating.
   */
  _stop() {
    clearInterval(this._heartbeatInterval);
  }

  /**
   * Sends a single heartbeat message to the kernel.
   */
  _sendHeartbeat() {
    console.log('Heartbeat channel: sending heartbeat');
    this._send(['!ping!']);
  }

  _receive() {
    // Deserialize the multi-part ZeroMQ message into an object.
    var message = arguments;
    console.log('Heartbeat channel: received message: ', JSON.stringify(message, null, 2));

    // Validate the received message.

    // Update the time since last successful health check.
  }

}
