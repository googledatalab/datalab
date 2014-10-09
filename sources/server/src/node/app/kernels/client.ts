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
/// <reference path="../../../../../../externs/ts/node/node-uuid.d.ts" />
import uuid = require('node-uuid');
import childproc = require('child_process');
import util = require('util');
import iopub = require('./iopub');
import shell = require('./shell');


/**
 * Client for communication via the IPython protocol to a kernel process.
 */
export class KernelClient {

  static connectionUrl: string = 'tcp://127.0.0.1:';
  _config: app.KernelConfig;
  _kernelProcess: childproc.ChildProcess;
  _iopub: iopub.IOPubChannelClient;
  _shell: shell.ShellChannelClient;
  _clientId: string;

  constructor (config: app.KernelConfig) {
    this._config = config;
    this._clientId = uuid.v4();
    this._iopub = new iopub.IOPubChannelClient(KernelClient.connectionUrl, config.iopubPort);
    this._shell = new shell.ShellChannelClient(KernelClient.connectionUrl, config.shellPort,
      this._clientId);
  }

  start (): void {
    this._spawnLocalKernelProcess();

    this._iopub.connect();
    this._iopub.onKernelStatusMessage(this._handleMessage.bind(this));
    this._iopub.onExecuteResultMessage(this._handleMessage.bind(this));

    this._shell.connect();
    this._shell.onExecuteReplyMessage(this._handleMessage.bind(this));
  }

  shutdown (): void {
    this._iopub.disconnect();
    this._shell.disconnect();
    this._kernelProcess.kill();
  }

  execute (request: app.ExecuteRequest): void {
    this._shell.execute(request);
  }

  onMessage (callback: app.KernelMessageHandler) {
    this._delegateMessage = callback;
  }

  _delegateMessage (message: any): void {}

  _handleMessage (message: any): void {
    this._delegateMessage(message);
  }

  _spawnLocalKernelProcess (): void {
    // Note: disabling HMAC digest via the Session.key flag for now
    var cmd = 'ipython'
    var args = [
        'kernel',
        '--Session.key=""',
        '--iopub=' + this._config.iopubPort,
        '--shell=' + this._config.shellPort,
        '--log-level="DEBUG"'
        ];
    this._kernelProcess = childproc.spawn(cmd, args);
    console.log("Started process with id =", this._kernelProcess.pid);
    // For now, consider both disconnected and exitted kernels as "dead"
    this._kernelProcess.on('exit', this._handleKernelDiedEvent.bind(this));
    this._kernelProcess.on('disconnect', this._handleKernelDiedEvent.bind(this));
  }

  _handleKernelDiedEvent () {
    this._delegateMessage ({status: 'dead', requestId: null});
  }

}
