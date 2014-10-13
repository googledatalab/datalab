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
 * Main entry point for the server.
 *
 * Starts an HTTP server on port that can be overridden by environment variable defined in
 * app.Settings (see: app/config)
 */
/// <reference path="../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../externs/ts/express/express.d.ts" />
import http = require('http');
import express = require('express');
import config = require('./app/config');


export function start (settings: app.Settings, apiRouter: express.Router) {
  var expressApp = express();
  expressApp.use('/api', apiRouter);
  var httpServer = http.createServer(expressApp);

  console.log("Starting HTTP server on port " + settings.httpPort);
  httpServer.listen(settings.httpPort);
}

start(config.getSettings(), config.getApiRouter());
