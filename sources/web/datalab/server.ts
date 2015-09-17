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

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="common.d.ts" />

import fs = require('fs');
import health = require('./health');
import http = require('http');
import info = require('./info');
import jupyter = require('./jupyter');
import logging = require('./logging');
import net = require('net');
import path = require('path');
import sockets = require('./sockets');
import static = require('./static');
import url = require('url');
import user = require('./user');
import wsync = require('./wsync');

var server: http.Server;
var healthHandler: http.RequestHandler;
var infoHandler: http.RequestHandler;
var staticHandler: http.RequestHandler;

function handleJupyterRequest(request: http.ServerRequest, 
                              response: http.ServerResponse, path: string, userId: string) {
  var isApiRequest = (path.indexOf('/api/contents') == 0);
  if (jupyter.getPort(request) == 0) {
    // Jupyter server is not created yet. Creating it for user and call self again.
    jupyter.StartForUser(userId, function(e, code) {
      if (e != null) {
        response.statusCode = 500;
        response.end();
      }
      handleJupyterRequest(request, response, path, userId);
    });
    return;
  }

  if (!wsync.workspaceInitialized(userId) && isApiRequest) {
    // Workspace is not initialized was not created yet. Initializing it call self again.
    // This is only done for Api request so we'll skip it on user's first /tree or /notebook
    // request so that user can see the page earlier.
    wsync.syncNow(userId, function(e, code) {
      if (e != null) {
        response.statusCode = 500;
        response.end();
      } else {
        handleJupyterRequest(request, response, path, userId);
      }
    });
    return;
  }
  jupyter.handleRequest(request, response);
  if (isApiRequest) {
    wsync.scheduleSync(userId);
  }
}

/**
 * Handles all requests sent to the proxy web server. Some requests are handled within
 * the server, while some are proxied to the Jupyter notebook server.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var path = url.parse(request.url).pathname;

  // /_ah/* paths implement the AppEngine health check.
  if (path.indexOf('/_ah') == 0) {
    healthHandler(request, response);
    return;
  }

  // TODO(jupyter): Additional custom path - should go away eventually with replaced
  // pages.
  // /static and /custom paths for returning static content
  if ((path.indexOf('/static') == 0) || (path.indexOf('/custom') == 0)) {
    staticHandler(request, response);
    return;
  }

  // /ping allows the deployer to validate existence.
  if (path.indexOf('/ping') == 0) {
    // TODO: Remove support for CORS once the existence checks move to the deployment server.
    response.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    response.end("OK");
    return;
  }

  // All requests below are logged, while the ones above aren't, to avoid generating noise
  // into the log.
  logging.logRequest(request, response);

  // Landing page redirects to /tree to be able to use the Jupyter file list as
  // the initial page.
  if (path == '/') {
    user.maybeSetUserIdCookie(request, response);
    response.statusCode = 302;
    response.setHeader('Location', '/tree');
    response.end();
    return;
  }

  // Requests proxied to Jupyter
  if ((path.indexOf('/api') == 0) ||
      (path.indexOf('/tree') == 0) ||
      (path.indexOf('/notebooks') == 0) ||
      (path.indexOf('/nbconvert') == 0) ||
      (path.indexOf('/files') == 0)) {
    var userId = user.getUserId(request);
    handleJupyterRequest(request, response, path, userId);
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
 * Runs the proxy web server.
 * @param settings the configuration settings to use.
 */
export function run(settings: common.Settings): void {
  user.init(settings);
  wsync.init(settings);
  jupyter.start(settings);

  healthHandler = health.createHandler(settings);
  infoHandler = info.createHandler(settings);
  staticHandler = static.createHandler(settings);

  server = http.createServer(requestHandler);
  sockets.wrapServer(server);

  logging.getLogger().info('Starting DataLab server at http://localhost:%d',
                           settings.serverPort);
  server.listen(settings.serverPort);
}

/**
 * Stops the server and associated Jupyter server.
 */
export function stop(): void {
  jupyter.stop();
}
