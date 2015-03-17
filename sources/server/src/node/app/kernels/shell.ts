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


/// <reference path="../../../../../../externs/ts/node/node-uuid.d.ts" />
import uuid = require('node-uuid');
import ipy = require('../messages/ipy');
import channels = require('./channels');


/**
 * Client for communicating with the shell channel of a running IPython kernel.
 *
 * Hides the details of the IPython messaging protocol from the caller.
 */
export class ShellChannelClient extends channels.ChannelClient {

  /**
   * Used as session id for IPython messaging
   */
  _clientId: string;

  constructor (connectionUrl: string, port: number, clientId: string) {
    super (connectionUrl, port, 'shell-' + port, 'dealer');
    this._clientId = clientId;
  }

  /**
   * Default no-op message delegation handlers
   */
  _delegateExecuteReplyHandler (reply: app.ExecuteReply): void {}

  /**
   * Specifies a callback to handle execute reply messages
   */
  onExecuteReply (callback: app.EventHandler<app.ExecuteReply>): void {
    this._delegateExecuteReplyHandler = callback;
  }

  /**
   * Sends a code execution request to the kernel.
   * @param request an execution request
   * @returns promise that will resolve to an execute reply message upon code execution completing
   */
  execute (request: app.ExecuteRequest): void {
    // Translate to execute request to the IPython message format and send to the kernel
    var ipyExecuteMessage = this._createIPyExecuteRequest(request);
    this._send(ipyExecuteMessage);
  }

  /**
   * Handles shell channel messages from the zmq socket
   *
   * Converts multipart IPython message format to internal message type and then delegates to an
   * appropriate handler.
   */
  _receive () {
    var message = ipy.parseIPyMessage(arguments);

    // Dispatch to an appropriate handler for the received message type
    switch (message.header.msg_type) {
      case 'execute_reply':
        this._handleExecuteReply(message);
        break;

      default: // No handler for this message type, so log it and move on
        console.log('Unhandled message type "' + message.header.msg_type + '" received');
        return;
    }
  }

  _handleExecuteReply (message: app.ipy.Message): void {
    // Translate the IPython message into an internal message type
    var status = message.content['status'];
    var reply: app.ExecuteReply = {
      success: status == 'ok',
      requestId: message.parentHeader.msg_id,
    };
    if (status != 'aborted') {
      reply.executionCounter = message.content['execution_count'];
    }

    if (message.content['status'] == 'error') {
      reply.errorName = <string>message.content['ename'];
      reply.errorMessage = <string>message.content['evalue'];
      reply.traceback = <string[]>message.content['traceback'];
    }

    this._delegateExecuteReplyHandler(reply);
  }

  /**
   * Creates a multipart IPython protocol message for kernel code execution
   */
  _createIPyExecuteRequest (request: app.ExecuteRequest): string[] {
    var content: app.ipy.ExecuteRequestContent = {
      code: request.code,
      silent: false,
      store_history: true,
      allow_stdin: false
    };
    return ipy.createIPyMessage(this._clientId, request.requestId, 'execute_request', content);
  }

}
