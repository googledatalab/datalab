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


import ipy = require('../messages/ipy');
import channels = require('./channels');


/**
 * Client for communicating with the iopub channel of a running IPython kernel.
 *
 * Hides the details of the IPython messaging protocol from the caller.
 */
export class IOPubChannelClient extends channels.ChannelClient {

  _delegateKernelStatusHandler: app.EventHandler<app.KernelStatus>;
  _delegateOutputDataHandler: app.EventHandler<app.OutputData>;

  constructor (
      connectionUrl: string,
      port: number,
      onKernelStatus: app.EventHandler<app.KernelStatus>,
      onOutputData: app.EventHandler<app.OutputData>) {

    super (connectionUrl, port, 'iopub-' + port, 'sub');

    this._delegateKernelStatusHandler = onKernelStatus;
    this._delegateOutputDataHandler = onOutputData;
  }

  connect () {
    super.connect();
    this._socket.subscribe(''); // Subscribe to all topics
  }

  /**
   * Note: Upcoming changes to the IPython messaging protocol will remap the (protocol version 4.1)
   * message types used below. Therefore, using internal names that align with the proposed names
   * for upcoming protocol versions.
   *
   * See: https://github.com/ipython/ipython/wiki/IPEP-13:-Updating-the-Message-Spec
   *
   * Notebook server-to-kernel mappings will be 1:1 and thus some iopub messages will be redundant,
   * because there is effectively a single kernel client, instead of multiple. Because of this,
   * the pyerr and pyin messages are both swallowed here. The data contained within pyin and pyerr
   * are both fully captured by the execute_reply/execute_request combination of messages.
   */
  _receive () {
    var message = ipy.parseIPyMessage(arguments);

    switch (message.header.msg_type) {
      case 'display_data':
        this._handleDisplayData(message);
        break;

      case 'pyerr':
        // no-op
        break;

      case 'pyin':
        // no-op
        break;

      case 'pyout':
        this._handleExecuteResult(message);
        break;

      case 'status':
        this._handleKernelStatus(message);
        break;

      case 'stream':
        this._handleStreamData(message);
        break;

      default: // No defined handler for the type, so log it and move on
        console.log('Unhandled message type "' + message.header.msg_type + '" received');
        return;
    }

  }

  /**
   * Converts IPython message data for a display_data msg to an internal message and delegates
   */
  _handleDisplayData (message: app.ipy.Message) {
    var displayData: app.OutputData = {
      type: 'result',
      mimetypeBundle: message.content.data,
      requestId: message.parentHeader.msg_id
    }

    this._delegateOutputDataHandler(displayData);
  }

  /**
   * Converts IPython message data for a execute_result msg to an internal message and delegates
   */
  _handleExecuteResult (message: app.ipy.Message) {

    var result: app.OutputData = {
      type: 'result',
      mimetypeBundle: message.content.data,
      requestId: message.parentHeader.msg_id
    };

    this._delegateOutputDataHandler (result);
  }

  /**
   * Converts IPython message data for a kernel status msg to an internal message and delegates
   */
  _handleKernelStatus (message: app.ipy.Message) {

    var status: app.KernelStatus = {
      status: message.content.execution_state,
      requestId: message.parentHeader.msg_id
    };

    this._delegateKernelStatusHandler (status);
  }

  /**
   * Converts IPython message data for a stream output (stdout/stderr) and delegates
   */
  _handleStreamData (message: app.ipy.Message) {

    var streamData: app.OutputData = {
      // the content.name field should have value in {'stdout', 'stderr'}
      type: message.content.name,
      mimetypeBundle: {
        'text/plain': message.content.data
      },
      requestId: message.parentHeader.msg_id
    }

    this._delegateOutputDataHandler(streamData);
  }

}
