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
/// <reference path="../../../../../../externs/ts/express/express.d.ts" />
import express = require('express');
import manager = require('./manager');


/**
 * Kernel resource management HTTP API
 */
export class KernelApi {

  static kernelsCollectionUrl: string = '/kernels';
  static singleKernelUrl: string = KernelApi.kernelsCollectionUrl + '/:id';
  static singleKernelActionUrl: string = KernelApi.singleKernelUrl + '::';

  _manager: app.IKernelManager;

  constructor (kernelManager: app.IKernelManager) {
    this._manager = kernelManager;
  }

  /**
   * Gets the single kernel specified by the request 'id' param if it exists
   */
  get (request: express.Request, response: express.Response): void {
    var kernel = this._getKernelOrFail(request, response);
    if (!kernel) { // Response has been handled by getKernelOrFail
      return;
    }
    response.send(this._getKernelMetadata(kernel));
  }

  /**
   * Gets the list of existing kernels
   */
  list (request: express.Request, response: express.Response): void {
    var kernels = this._manager.list();
    response.send(kernels.map((kernel) => {
      return this._getKernelMetadata(kernel);
    }));
  }

  /**
   * Shuts down the kernel specified by the request 'id' param
   */
  shutdown (request: express.Request, response: express.Response): void {
    var kernel = this._getKernelOrFail(request, response);
    if (!kernel) { // Response has been handled by getKernelOrFail
      return;
    }
    this._manager.shutdown(kernel.id);
    response.sendStatus(200);
  }

  /**
   * Registers routes for the kernel API
   */
  register (router: express.Router): void {
    router.get(KernelApi.singleKernelUrl, this.get.bind(this));
    router.get(KernelApi.kernelsCollectionUrl, this.list.bind(this));
    router.post(KernelApi.singleKernelActionUrl + 'shutdown', this.shutdown.bind(this));
  }

  /**
   * Transforms a kernel into a data-only object suitable for stringification.
   */
  _getKernelMetadata (kernel: app.IKernel): any {
    return {
      id: kernel.id,
      config: kernel.config
    };
  }

  /**
   * Gets the kernel ID from the request or fails the response
   */
  _getKernelIdOrFail (request: express.Request, response: express.Response): string {
    var id: string = request.param('id', null);
    if (!id) {
      response.sendStatus(400);
    }
    return id;
  }

  /**
   * Gets the kernel specified by the request route or fails the request (via response object)
   */
  _getKernelOrFail (request: express.Request, response: express.Response): app.IKernel {
    var id = this._getKernelIdOrFail(request, response);
    if (!id) {
      return null;
    }
    var kernel = this._manager.get(id);
    if (!kernel) {
      response.sendStatus(404);
    }
    return kernel;
  }

}

