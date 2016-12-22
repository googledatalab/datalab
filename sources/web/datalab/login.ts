/*
 * Copyright 2016 Google Inc. All rights reserved.
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
 * This file defines a special-purpose server used solely for performing the OAuth login
 * flow prior to starting the main Datalab server.
 *
 * This is used for scenarios when the user must already be logged in before we can start
 * Datalab (e.g. because we need to create an SSH tunnel to a GCE VM running a kernel gateway).
 */

/// <reference path="common.d.ts" />

import auth = require('./auth');
import http = require('http');
import logging = require('./logging');
import settings = require('./settings');
import url = require('url');

var appSettings: common.Settings;
var server: http.Server;

var successPage: string = `<html>
  <head>
    <meta http-equiv="refresh" content="30;url=/" />
  </head>
  <body>
    <h1>Login successful.</h1>
    <p>Startup should complete soon. Redirecting in 30 seconds...</p>
  </body>
</html>`;

/**
 * Handle incoming HTTP requests.
 *
 * The bulk of the work is done by the imported auth package. The only exceptions
 * are redirecting to the start of the auth flow at the beginning, and serving the
 * success page at the end.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var parsed_url = url.parse(request.url, true);
  var path = parsed_url.pathname;
  if (path.indexOf('/signin') == 0 || path.indexOf('/oauthcallback') == 0) {
    auth.handleAuthFlow(request, response, parsed_url, appSettings);
    return;
  } else if (path.indexOf('/exit') == 0 && auth.isSignedIn()) {
    response.statusCode = 200;
    response.write(successPage);
    response.end();
    process.exit();
    return;
  } else {
    var referer = '/signin?referer=%2Fexit';
    response.statusCode = 302;
    response.setHeader('Location', referer);
    response.end();
    return;
  }
}

/**
 * Load the configuration settings, and then start the server, which
 * runs until the user signs in.
 */
appSettings = settings.loadSettings();
if (appSettings != null) {
  appSettings.consoleLogging = false;
  logging.initializeLoggers(appSettings);
  auth.init(appSettings);

  server = http.createServer(requestHandler);
  server.listen(appSettings.serverPort);

  console.log('Please visit http://localhost:8081 to log in');
} else {
  console.log('Failed to load the application settings');
  err();
}

/**
 * Handle shutdown of this process, to also stop the server.
 */
function exit() {
  server.close();
}

/**
 * Report internal errors to the outer process by setting the
 * exit status to a non-zero value.
 */
function err() {
  process.exit(1);
}

process.on('uncaughtException', err);
process.on('SIGINT', err);

process.on('exit', exit);
