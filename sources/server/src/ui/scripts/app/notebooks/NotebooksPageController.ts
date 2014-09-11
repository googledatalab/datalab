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


/**
 * Top-level page controller for the notebook index page
 */
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import app = require('app/App');


var log = logging.getLogger(constants.scopes.notebooks.page);

export class NotebooksPageController {
  /**
   * Constructor and arguments for Angular to inject
   */
  static $inject: string[] = [];
  constructor () {
    // TODO(bryantd): Add controller logic
    log.debug('Constructed notebooks page controller');
  }
}

app.registrar.controller(constants.notebooks.pageControllerName, NotebooksPageController);
log.debug('Registered ', constants.notebooks.pageControllerName);