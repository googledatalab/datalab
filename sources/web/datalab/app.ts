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

/// <reference path="common.d.ts" />

import logging = require('./logging');
import settings = require('./settings');
import server = require('./server');

/**
 * Load the configuration settings, and then start the server, which
 * runs indefinitely, listening to and processing incoming HTTP requests.
 */
var appSettings = settings.loadAppSettings();
if (appSettings != null) {
  logging.initializeLoggers(appSettings);
  server.run(appSettings);
}


/**
 * Handle shutdown of this process, to also stop the server, which will in turn stop the
 * associated Jupyter server process.
 */
function exit() {
  server.stop();
}

/**
 * Handle uncaught exceptions to log them.
 */
function errorHandler(e: any): void {
  console.error(e.stack);

  logging.getLogger().error(e, 'Unhandled exception');
  process.exit(1);
}

process.on('uncaughtException', errorHandler);
process.on('exit', exit);
process.on('SIGINT', exit);
