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

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../externs/ts/request/request.d.ts" />
/// <reference path="common.d.ts" />

import auth = require('./auth')
import fs = require('fs');
import health = require('./health');
import http = require('http');
import info = require('./info');
import jupyter = require('./jupyter');
import logging = require('./logging');
import net = require('net');
import path = require('path');
import request = require('request');
import static_ = require('./static');
import updateDocs = require('./updateDocs');
import url = require('url');
import userManager = require('./userManager');

var server: http.Server;
var healthHandler: http.RequestHandler;
var infoHandler: http.RequestHandler;
var staticHandler: http.RequestHandler;

// Datalab config file for things like default project. If this doesn't exist the EULA hasn't been accepted.
let configFile = '/content/datalab/.config';

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

/**
 * If it is the user's first request since the web server restarts,
 * need to start jupyter server for that user.
 * We don't track results here. Later requests will go through initialization
 * checks again, and if it is still initializing, those requests will be parked
 * and wait for initialization to complete or fail.
 */
function startInitializationForUser(request: http.ServerRequest): void {
  if (jupyter.getPort(request) == 0) {
    var userId = userManager.getUserId(request);
    // Giving null callback so this is fire-and-forget.
    jupyter.startForUser(userId, null);
  }
}

/**
 * Check if workspace and jupyter server is initialized for the user.
 * If not, wait for initialization to be done and then proceed to pass
 * the request to jupyter server.
 */
function handleJupyterRequest(request: http.ServerRequest, response: http.ServerResponse): void {
  var userId = userManager.getUserId(request);

  if (jupyter.getPort(request) == 0) {
    // Jupyter server is not created yet. Creating it for user and call self again.
    // Another 'startForUser' may already be ongoing so this 'syncNow' will probably
    // be parked until the ongoing one is done.
    jupyter.startForUser(userId, function(e) {
      if (e) {
        response.statusCode = 500;
        response.end();
      }
      else {
        handleJupyterRequest(request, response);
      }
    });
    return;
  }
  jupyter.handleRequest(request, response);
}

/**
 * Handles all requests.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 * @path the parsed path in the request.
 */
function handleRequest(request: http.ServerRequest,
                       response: http.ServerResponse,
                       path: string) {
  // TODO(jupyter): Additional custom path - should go away eventually with replaced
  // pages.
  // /static and /custom paths for returning static content
  if ((path.indexOf('/static') == 0) || (path.indexOf('/custom') == 0)) {
    staticHandler(request, response);
    return;
  }

  // All requests below are logged, while the ones above aren't, to avoid generating noise
  // into the log.
  logging.logRequest(request, response);

  // If Jupyter is not initialized, do it as early as possible after authentication.
  startInitializationForUser(request);

  // Landing page redirects to /tree to be able to use the Jupyter file list as
  // the initial page.
  if (path == '/') {
    userManager.maybeSetUserIdCookie(request, response);

    response.statusCode = 302;
    response.setHeader('Location', '/tree/datalab');
    response.end();
    return;
  }

  // Requests proxied to Jupyter
  if ((path.indexOf('/api') == 0) ||
      (path.indexOf('/tree') == 0) ||
      (path.indexOf('/notebooks') == 0) ||
      (path.indexOf('/nbconvert') == 0) ||
      (path.indexOf('/nbextensions') == 0) ||
      (path.indexOf('/files') == 0) ||
      (path.indexOf('/edit') == 0)) {
    handleJupyterRequest(request, response);
    return;
  }

  // /_info displays information about the server for diagnostics.
  if (path.indexOf('/_info') == 0) {
    infoHandler(request, response);
    return;
  }

  // /_restart forcibly ends this process.
  // TODO: This is oh so hacky. If this becomes interesting longer term, turn
  //       this into a real feature, that involves a confirmation prompt, as
  //       well validation to require a POST request.
  if (path.indexOf('/_restart') == 0) {
    setTimeout(function() { process.exit(0); }, 0);
    response.statusCode = 200;
    response.end();
    return;
  }

  // Not Found
  response.statusCode = 404;
  response.end();
}

/**
 * Handles all requests sent to the proxy web server. Some requests are handled within
 * the server, while some are proxied to the Jupyter notebook server.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var parsed_url = url.parse(request.url, true);
  var path = parsed_url.pathname;

  // Check if EULA has been accepted; if not go to EULA page.
  if (path.indexOf('/accepted_eula') == 0) {
    fs.writeFileSync(configFile, '');  // TODO(gram): this should go in the mounted volume so we don't keep asking.
    var i = parsed_url.search.indexOf('referer=');
    if (i < 0) {
      logging.getLogger().info('Accepting EULA, but no referer; returning 500');
      response.writeHead(500);
    } else {
      i += 8;
      var referer = decodeURI(parsed_url.search.substring(i));
      logging.getLogger().info('Accepting EULA; return to ' + referer);
      response.writeHead (302, {'Location': referer})
    }
    response.end();
    return;
  }
  if (!fs.existsSync(configFile)) {
    logging.getLogger().info('No Datalab config; redirect to EULA page');
    fs.readFile('/datalab/web/static/eula.html', function(error, content) {
      response.writeHead(200);
      response.end(content);
    });
    return;
  }

  if (auth.handleAuthFlow(request, response, parsed_url)) {
    handleRequest(request, response, path);
  }
}


function socketHandler(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  jupyter.handleSocket(request, socket, head);
}

/**
 * Runs the proxy web server.
 * @param settings the configuration settings to use.
 */
export function run(settings: common.Settings): void {
  appSettings = settings;
  userManager.init(settings);
  jupyter.init(settings);
  updateDocs.startUpdate(settings);

  healthHandler = health.createHandler(settings);
  infoHandler = info.createHandler(settings);
  staticHandler = static_.createHandler(settings);

  server = http.createServer(requestHandler);
  server.on('upgrade', socketHandler);

  logging.getLogger().info('Starting DataLab server at http://localhost:%d',
                           settings.serverPort);
  server.listen(settings.serverPort);
}

/**
 * Stops the server and associated Jupyter server.
 */
export function stop(): void {
  jupyter.close();
}
