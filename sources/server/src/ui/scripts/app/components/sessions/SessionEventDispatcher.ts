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


/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <amd-dependency path="app/components/sessions/SessionConnection" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');
import actions = require('app/shared/actions');
import updates = require('app/shared/updates');
import uuid = require('app/common/uuid');


var log = logging.getLogger(constants.scopes.sessionEventDispatcher);

/**
 * Manages the two-way connection between client and server and associated session message traffic.
 *
 * Publishes incoming messages (from the server) as client-side events.
 *
 * Subscribes to client-side event types that map to session messages and forwards these
 * messages to the server (with some transformation/message wrapping applied).
 */
class SessionEventDispatcher implements app.ISessionEventDispatcher {

  _connection: app.ISessionConnection;
  _rootScope: ng.IRootScopeService;

  static $inject = ['$rootScope', constants.sessionConnection.name];
  /**
   * Constructor.
   *
   * @param rootScope The Angular $rootScope.
   * @param connection A session connection instance.
   */
  constructor(rootScope: ng.IRootScopeService, connection: app.ISessionConnection) {
    this._connection = connection;
    this._rootScope = rootScope;

    this._registerEventHandlers();
    this._registerMessageHandlers();
  }

  /**
   * Handles client-side action events by forwarding them to the server.
   *
   * @param event An angular event.
   * @param action A notebook Action message.
   */
  _handleAction(event: ng.IAngularEvent, action: app.notebooks.actions.Action) {
    log.debug('Sending action message to server', action);
    this._connection.emit('action', action);
  }

  /**
   * Handles all incoming server updates by publishing them as client-side events.
   *
   * @param update A notebook Update message.
   */
  _handleUpdate(update: app.notebooks.updates.Update) {
    log.debug('Update message received from server:', update);
    this._rootScope.$emit(update.name, update);
  }

  /**
   * Register client-side event handlers for each notebook action.
   */
  _registerEventHandlers() {
    // Add an event listener for each action type.
    var eventNames = [
      actions.composite,
      actions.notebook.clearOutputs,
      actions.notebook.executeCells,
      actions.worksheet.addCell,
      actions.worksheet.deleteCell,
      actions.worksheet.moveCell,
      actions.cell.clearOutput,
      actions.cell.update,
      actions.cell.execute
    ];
    eventNames.forEach((eventName) => {
      this._rootScope.$on(eventName, this._handleAction.bind(this));
    }, this);
  }

  /**
   * Register server-side message handlers for update events
   */
  _registerMessageHandlers() {
    this._connection.on(updates.label, this._handleUpdate.bind(this));
  }
}

_app.registrar.service(constants.sessionEventDispatcher.name, SessionEventDispatcher);
log.debug('Registered ', constants.scopes.sessionEventDispatcher);
