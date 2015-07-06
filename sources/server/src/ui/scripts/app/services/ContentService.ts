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

/**
 * Content service client.
 */

/// <reference path="../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../shared/requests.d.ts" />
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import _app = require('app/App');

var log = logging.getLogger(constants.scopes.contentService);

class ContentService implements app.IContentService {

  _q: ng.IQService;
  _http: ng.IHttpService;
  _server: string;

  constructor (q: ng.IQService, location: ng.ILocationService, http: ng.IHttpService) {
    this._q = q;
    this._http = http;
    this._server = location.protocol() + '://' + location.host() + ':' + location.port();
    log.debug("Server " + this._server);
  }

  /**
   * Gets the URL for a given item path.
   *
   * Note: content paths are required to have a leading slash; all paths are absolute.
   *
   * @param itemPath The absolute content path to the item.
   * @return The full URL for the item.
   */
  url(itemPath: string): string {
    return this._server + '/api/content' + itemPath;
  }

  /**
   * List the contents of a container item (such as a directory).
   *
   * @param item: The path of the item to list.
   * @return A promise; on success this will be resolved with the response.
   */
  list(item: string) : ng.IPromise<app.requests.ListContentResponse> {
    var deferred = this._q.defer();
    this._http.get(this.url(item)).then((response) =>
      response.status == 200
          ? deferred.resolve(response.data)
          : deferred.reject(response.statusText));
    return deferred.promise;
  }

  /**
   * Delete an item.
   *
   * @param item: The path of the item to delete.
   * @return A promise; on success this will be resolved with the item path.
   */
  delete(item: string) : ng.IPromise<string> {
    var deferred = this._q.defer();
    this._http.delete(this.url(item)).then((response) =>
        response.status >= 200 && response.status < 300
            ? deferred.resolve(item)
            : deferred.reject(response.statusText));
    return deferred.promise;
  }

  /**
   * Create an item.
   *
   * @param item: The path of the item to create.
   * @data: The data to use to create the item.
   * @return A promise; on success this will be resolved with the item path.
   */
  create(item: string, data:string) : ng.IPromise<any> {
    var deferred = this._q.defer();
    this._http.post(this.url(item), data).then((response) =>
        response.status >= 200 && response.status < 300
            ? deferred.resolve(response.data)
            : deferred.reject(response.statusText));
    return deferred.promise;
  }

  /**
   * Update an item.
   *
   * @param item: The path of the item to update.
   * @data: The data to use to update the item.
   * @return A promise; on success this will be resolved with the item path.
   */
  update(item: string, data: string) : ng.IPromise<string> {
    var deferred = this._q.defer();
    this._http.put(this.url(item), data).then((response) =>
        response.status >= 200 && response.status < 300
            ? deferred.resolve(item)
            : deferred.reject(response.statusText));
    return deferred.promise;
  }

  /**
   * Move an item.
   *
   * @param item: The path of the item to update.
   * @newPath: The location to move the item.
   * @return A promise; on success this will be resolved with the item path.
   */
  move(item: string, newPath: string) : ng.IPromise<string> {
    var deferred = this._q.defer();
    this._http.post(this.url(item), "{path: '" + newPath + "'}").then((response) =>
        response.status >= 200 && response.status < 300
            ? deferred.resolve(item)
            : deferred.reject(response.statusText));
    return deferred.promise;
  }
}

/**
 * Creates a (singleton) content service.
 *
 * @param rootScope The Angular $rootScope.
 * @return A data service.
 */
function contentServiceFactory(
    q: ng.IQService,
    location: ng.ILocationService,
    http: ng.IHttpService
    ): ContentService {
  return new ContentService(q, location, http);
}

contentServiceFactory.$inject = ['$q', '$location', '$http'];
_app.registrar.factory(constants.contentService.name, contentServiceFactory);
log.debug('Registered content service factory');

