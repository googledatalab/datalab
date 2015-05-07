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
 * Session service client.
 */

/// <reference path="../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../shared/requests.d.ts" />
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import _app = require('app/App');

var log = logging.getLogger(constants.scopes.sessionService);

class SessionService implements app.ISessionService {

  _q: ng.IQService;
  _http: ng.IHttpService;
  _server: string;

  constructor (q: ng.IQService, location: ng.ILocationService, http: ng.IHttpService) {
    this._q = q;
    this._http = http;
    this._server = location.protocol() + '://' + location.host() + ':' + location.port();
    log.debug("Server " + this._server);
  }

  url(sessionPath: string): string {
    return this._server + '/api/sessions' + sessionPath;
  }

  /**
   * Create a session.
   *
   * @param session: The path of the session to create.
   * @return A promise; on success this will be resolved with the item path.
   */
  create(session: string) : ng.IPromise<string> {
    var deferred = this._q.defer();
    this._http.post(this.url(session), '').then((response) =>
        response.status >= 200 && response.status < 300
            ? deferred.resolve(response.data)
            : deferred.reject(response.statusText));
    return deferred.promise;
  }

  /**
   * List the sessions.
   *
   * @return A promise; on success this will be resolved with the response.
   */
  list() : ng.IPromise<app.requests.ListSessionsResponse> {
    var deferred = this._q.defer();
    this._http.get(this.url('')).then((response) =>
      response.status >= 200 && response.status < 300
          ? deferred.resolve(response.data)
          : deferred.reject(response.statusText));
    return deferred.promise;
  }

  /**
   * Reset a session.
   *
   * @param session: The path of the session to reset.
   * @return A promise; on success this will be resolved with the session path.
   */
  reset(session: string) : ng.IPromise<string> {
    var deferred = this._q.defer();
    this._http.post(this.url(session) + ':reset', '').then((response) =>
        response.status >= 200 && response.status < 300
            ? deferred.resolve(response.data)
            : deferred.reject(response.statusText));
    return deferred.promise;
  }

  /**
   * Shutdown a session.
   *
   * @param session: The path of the session to shut down.
   * @return A promise; on success this will be resolved with the session path.
   */
  shutdown(session: string) : ng.IPromise<string> {
    var deferred = this._q.defer();
    this._http.post(this.url(session) + ':shutdown', '').then((response) =>
        response.status >= 200 && response.status < 300
            ? deferred.resolve(response.data)
            : deferred.reject(response.statusText));
    return deferred.promise;
  }
}

/**
 * Creates a (singleton) session service.
 *
 * @param rootScope The Angular $rootScope.
 * @return A session service.
 */
function sessionServiceFactory(
    q: ng.IQService,
    location: ng.ILocationService,
    http: ng.IHttpService
    ): SessionService {
  return new SessionService(q, location, http);
}

sessionServiceFactory.$inject = ['$q', '$location', '$http'];
_app.registrar.factory(constants.sessionService.name, sessionServiceFactory);
log.debug('Registered session service factory');

