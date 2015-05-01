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
 * Top-level page controller for the sessions index page
 */
/// <amd-dependency path="app/components/layouts/sidebar/SidebarLayoutDirective" />
/// <amd-dependency path="app/components/sessionnavigator/SessionNavigatorDirective" />
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import app = require('app/App');


var log = logging.getLogger(constants.scopes.sessions.page);

export class SessionsPageController {
  /**
   * Constructor and arguments for Angular to inject
   */
  static $inject: string[] = [];
  constructor () {
    log.debug('Constructed sessions page controller');
  }
}

app.registrar.controller(constants.sessions.pageControllerName, SessionsPageController);
log.debug('Registered ', constants.sessions.pageControllerName);
