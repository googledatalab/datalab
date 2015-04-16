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


/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/express/express.d.ts" />
import express = require('express');


/**
 * Resource management HTTP API
 */
export class ResourceApi {

  // FIXME: rename these constants... not really the same semantics as sessions/kernels
  static resourceCollectionUrl: string = '/resources';
  static singleResource: string = ResourceApi.resourceCollectionUrl + '/:path';
  static singleResourceActionUrl: string = ResourceApi.singleResource + '::';

  _storage: app.IStorage;

  constructor (storage: app.IStorage) {
    this._storage = storage;
  }

  /**
   * Enumerates the resources that match the given path prefix.
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  list(request: express.Request, response: express.Response): void {
    var path = this._getPathOrFail(request, response);
    if (!path) {
      // Response has been handled by getPathOrFail.
      return;
    }

    //
    this._storage.list(path, (error: Error, resources: app.Resource[]) => {
      if (error) {
        response.send(500);
        return;
      }

      response.send({
        prefix: path,
        resources: resources
      });
    });
  }

  /**
   * Registers routes for the kernel API
   */
  register (router: express.Router): void {

// FIXME: remove this content
// List
// /content/<path>
// GET
//
// Create
// /content/<path>
// POST
//
// Delete
// /content/<path>
// DELETE
//
// Rename
// /content/<path>:rename
// POST
//
// Update
// /content/<path>
// PUT

    router.get(ResourceApi.singleResource, this.list.bind(this));
    // router.post(ResourceApi.singleResourceActionUrl + 'rename', this.rename.bind(this));
  }

  /**
   * Gets the resource path from the request or fails the request (via response object).
   *
   * If a path is not specified by the request, then the request is considered malformed
   * and a HTTP 400 status (Bad Request) is sent to the caller.
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  _getPathOrFail(request: express.Request, response: express.Response): string {
    var path: string = request.param('path', null);
    if (!path) {
      response.sendStatus(400);
    }
    return path;
  }

}

