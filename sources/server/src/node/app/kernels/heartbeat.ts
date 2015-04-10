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


var healthCheckPeriod = 1000;
var healthCheckTimeout = 3000;
var heartbeatMessage = 'health check';

/**
 * Client for communicating with the heartbeat channel of a running IPython kernel.
 */
export class HeartbeatChannelClient extends channels.ChannelClient {

  _delegateHealthCheckHandler: app.EventHandler<boolean>;
  _heartbeatInterval: number;
  _lastHealthCheckSuccessTimestamp: number;

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
    this._heartbeatInterval = setInterval(
      this._sendHeartbeat.bind(this),
      healthCheckPeriod);
    this._lastHealthCheckSuccessTimestamp = Date.now();
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
    // Check to see if the time since last successful health check has been exceeded.
    if (Date.now() - this._lastHealthCheckSuccessTimestamp > healthCheckTimeout) {
      this._delegateHealthCheckHandler(false);
      // No need to send further heartbeats if the health check failed
      clearInterval(this._heartbeatInterval);
      return;
    }

    // Send a heartbeat message to the kernel.
    this._send([heartbeatMessage]);
  }

  _receive() {
    // Deserialize the multi-part ZeroMQ message into a list of strings;
    var messageParts = ipy.deserializeZeroMQMessage(arguments);

    // Validate the received message contains the expected heartbeat message.
    var isKernelHealthy = (messageParts[0] == heartbeatMessage);

    if (isKernelHealthy) {
      this._lastHealthCheckSuccessTimestamp = Date.now();
    }

    // Send latest health check status via callback.
    this._delegateHealthCheckHandler(isKernelHealthy);
  }

}
