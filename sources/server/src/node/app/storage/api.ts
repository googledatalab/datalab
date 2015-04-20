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
   * Creates a notebook at the path specified by the request.
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  create(request: express.Request, response: express.Response): void {
    var path = this._getPathOrFail(request, response);
    if (!path) {
      // Response has been handled by getPathOrFail.
      return;
    }

    console.log('Create request for "/' + path + '"', request.body);
    response.send(path);
  }

  /**
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  delete(request: express.Request, response: express.Response): void {
    var path = this._getPathOrFail(request, response);
    if (!path) {
      // Response has been handled by getPathOrFail.
      return;
    }

    // TODO(bryantd): maybe collect common error callback handling for
    // delete/update/move into a single callback if it simplifies.
    this._storage.delete(path, (error) => {
      if (error) {
        response.sendStatus(500);
        return;
      }

      // If no error occurred, then consider the operation successful.
      response.sendStatus(200);
    });
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

    // FIXME: get the is recursive flag from the rquest
    var isRecursive = true;

    // Asynchronously list the resources that exist at the given path prefix within storage.
    this._storage.list(path, isRecursive, (error: Error, resources: app.Resource[]) => {
      if (error) {
        response.sendStatus(500);
        return;
      }

      response.send({
        prefix: path,
        resources: resources
      });
    });
  }

  /**
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  move(request: express.Request, response: express.Response): void {
    var path = this._getPathOrFail(request, response);
    if (!path) {
      // Response has been handled by getPathOrFail.
      return;
    }

    var body = JSON.parse(request.body);
    var newPath = body.path;

    this._storage.move(path, newPath, (error) => {
      if (error) {
        response.sendStatus(500);
        return;
      }

      response.sendStatus(200);
    });
  }

  /**
   *
   * @param request HTTP request object.
   * @param response HTTP response object.
   */
  update(request: express.Request, response: express.Response): void {
    var path = this._getPathOrFail(request, response);
    if (!path) {
      // Response has been handled by getPathOrFail.
      return;
    }

    // Get the updated content from the body of the request.
    var body: app.requests.CreateContentRequestBody = request.body;

    // Asynchronously write the content to the given path in storage.
    this._storage.write(path, body.content, (error) => {
      if (error) {
        response.sendStatus(500);
        console.log('ERROR: UPDATE /content request failed', request);
        return;
      }

      response.sendStatus(200);
    });
  }

  /**
   * Registers routes for the resources API.
   */
  register (router: express.Router): void {
    router.get(ContentApi.contentUrl, this.list.bind(this));
    router.put(ContentApi.contentUrl, this.update.bind(this));
    router.post(ContentApi.contentUrl, this.create.bind(this));
    router.delete(ContentApi.contentUrl, this.delete.bind(this));
    router.post(ContentApi.contentActionUrl + 'move', this.move.bind(this));
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
    var path: string = request.params.path;
    if (!path) {
      response.sendStatus(400);
    }
    return path;
  }

}
