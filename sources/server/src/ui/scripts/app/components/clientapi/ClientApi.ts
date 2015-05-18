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
/// <amd-dependency path="app/components/sessions/ClientNotebook" />
/// <amd-dependency path="app/components/sessions/ClientSession" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.clientApi);

/**
 * Exposes a client-side API for interacting with DataLab via the "datalab" window global variable.
 */
class ClientApi implements app.IClientApi {

  kernel: app.IClientSession;
  notebook: app.IClientNotebook;

  static $inject = [constants.clientSession.name, constants.clientNotebook.name];

  /**
   * Constructor.
   */
  constructor(kernel: app.IClientSession, notebook: app.IClientNotebook) {
    this.kernel = kernel;
    this.notebook = notebook;

    this._createGlobal();
  }

  /**
   * Add this object as a window global variable with name 'datalab'.
   */
  _createGlobal() {
    (<any>window).datalab = this;
  }
}

_app.registrar.service(constants.clientApi.name, ClientApi);
log.debug('Registered ', constants.scopes.clientApi);
