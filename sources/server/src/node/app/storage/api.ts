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
/// <reference path="../shared/requests.d.ts" />
import express = require('express');


/**
 * Content management HTTP API.
 */
export class ContentApi {

  static contentUrl = '/content/:path';
  static contentActionUrl = ContentApi.contentUrl + '::';

  _storage: app.IStorage;

  constructor (storage: app.IStorage) {
    this._storage = storage;
  }

  /**
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  create(request: express.Request, response: express.Response): void {

  }

  /**
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  delete(request: express.Request, response: express.Response): void {

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

      response.send(<app.ListResourcesResponse>{
        prefix: path,
        foo: 'bar',
        resources: resources
      });
    });
  }

  /**
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  rename(request: express.Request, response: express.Response): void {

  }

  /**
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  update(request: express.Request, response: express.Response): void {

  }

  /**
   * Registers routes for the resources API.
   */
  register (router: express.Router): void {
    router.get(ContentApi.contentUrl, this.list.bind(this));
    router.put(ContentApi.contentUrl, this.update.bind(this));
    router.post(ContentApi.contentUrl, this.create.bind(this));
    router.delete(ContentApi.contentUrl, this.delete.bind(this));
    router.post(ContentApi.contentActionUrl + 'rename', this.rename.bind(this));
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

