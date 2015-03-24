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
import client = require('./client');


/**
 * Manages the lifecycle of a set of kernel resources.
 */
export class KernelManager implements app.IKernelManager {

  _idToKernel: app.Map<app.IKernel>;

  constructor () {
    this._idToKernel = {};
  }

  /**
   * Creates and returns a new kernel using given configuration.
   */
   create (
      id: string,
      config: app.KernelConfig,
      onExecuteReply: app.EventHandler<app.ExecuteReply>,
      onKernelStatus: app.EventHandler<app.KernelStatus>,
      onOutputData: app.EventHandler<app.OutputData>
      ): app.IKernel {

    var kernel: app.IKernel = new client.KernelClient(
      id, config, onExecuteReply, onKernelStatus, onOutputData);

    // Track the kernel.
    this._idToKernel[id] = kernel;
    // Start the kernel process.
    kernel.start();

    return kernel;
  }

  /**
   * Gets a kernel corresponding to the given ID or null.
   */
  get (id: string): app.IKernel {
    return this._idToKernel[id] || null;
  }

  /**
   * Gets the list of kernel instances managed by this instance.
   */
  list (): app.IKernel[] {
    return this._getIds().map((id) => {
      return this._idToKernel[id];
    });
  }

  /**
   * Shuts down the kernel for the given ID.
   */
  shutdown (id: string): void {
    var kernel = this.get(id);
    if (!kernel) {
      throw new Error('No kernel exists with ID="' + id + '"');
    }
    kernel.shutdown();
    delete this._idToKernel[id];
  }

  /**
   * Shuts down all kernels managed by this object.
   */
  shutdownAll (): void {
    this._getIds().forEach((id: string) => {
      this.shutdown(id);
    });
  }

  /**
   * Gets the list of kernel IDs.
   */
  _getIds (): string[] {
    return Object.keys(this._idToKernel);
  }

}
