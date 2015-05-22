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


/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
import actions = require('app/shared/actions');
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import updates = require('app/shared/updates');
import util = require('app/common/util');
import uuid = require('app/common/uuid');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.clientSession);

class ClientSession implements app.IClientSession {

  /**
   * Tracks in-flight kernel requests and their corresponding completion callbacks.
   */
  _requestIdToCallback: app.Map<app.Callback<app.notebooks.CellOutput>>;
  _rootScope: ng.IRootScopeService;

  static $inject = ['$rootScope'];

  /**
   * Constructor.
   *
   * @param rootScope Angular's $rootScope service.
   */
  constructor(rootScope: ng.IRootScopeService) {
    this._rootScope = rootScope;
    this._requestIdToCallback = {};

    this._registerEventHandlers();
  }

  /**
   * Fetches data from the kernel by invoking the given code snippet.
   *
   * The snippet of code should return a result that has the application/json MIME type available.
   * This JSON result will be parsed and returned via callback as the fetched data.
   *
   * @param code The data fetching code snippet.
   * @param callback Completion callback to invoke with either the error or the fetched data.
   */
  getData(code: string, callback: app.Callback<any>) {
    this.execute(code, (error, output) => {
      if (error) {
        callback(error);
        return;
      }

      var outputJson = output.mimetypeBundle['application/json'];
      if (!outputJson) {
        // No data available for callback, but no error either.
        callback(null, null);
        return;
      }

      // Parse and return the JSON data.
      callback(null, JSON.parse(outputJson));
    });
  }

  /**
   * Executes the given code snippet within the kernel, passing
   */
  execute(source: string, callback: app.Callback<app.notebooks.CellOutput>) {
    var action: app.notebooks.actions.Execute = {
      name: actions.kernel.execute,
      requestId: uuid.v4(),
      source: source
    };

    // Track the request ID to callback mapping.
    this._requestIdToCallback[action.requestId] = callback;
    this._emitAction(action);
  }

  /**
   * Emits an Action to the client-side event system.
   *
   * @param action The Action message to emit as an event.
   */
  _emitAction(action: app.notebooks.actions.Action) {
    this._rootScope.$emit(action.name, action);
  }

  _handleExecuteResult(update: app.notebooks.updates.ExecuteResult) {
    // Lookup the callback associated with the update's request ID.
    var callback = this._requestIdToCallback[update.requestId];
    if (!callback) {
      log.error('No callback defined for execute result update: ' + JSON.stringify(update));
      return;
    }

    if ('error' == update.result.type) {
      // If an error occurred, wrap the error details in a real Error object.
      callback(new Error(
          'Kernel execution failed with error: ' + update.result.metadata['errorMessage']));
    } else {
      // Otherwise, return the full output result.
      callback(null, update.result);
    }

    // Remove the request to callback mapping.
    delete this._requestIdToCallback[update.requestId];
  }

  /**
   * Register all callbacks for handling kernel update events.
   */
  _registerEventHandlers() {
    util.registerEventHandler(
        <ng.IScope>this._rootScope,
        updates.kernel.executeResult,
        this._handleExecuteResult.bind(this));
  }

}

_app.registrar.service(constants.clientSession.name, ClientSession);
log.debug('Registered', constants.clientSession.name);
