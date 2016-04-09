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
/// <reference path="common.d.ts" />

import auth = require('./authentication');
import fs = require('fs');
import health = require('./health');
import http = require('http');
import info = require('./info');
import jupyter = require('./jupyter');
import logging = require('./logging');
import net = require('net');
import path = require('path');
import sockets = require('./sockets');
import static_ = require('./static');
import url = require('url');
import userManager = require('./userManager');
import workspaceManager = require('./workspaceManager');

var server: http.Server;
var healthHandler: http.RequestHandler;
var infoHandler: http.RequestHandler;
var staticHandler: http.RequestHandler;

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

/**
 * If it is the user's first request since the web server restarts,
 * need to initialize workspace, and start jupyter server for that user.
 * We don't track results here. Later requests will go through initializaion
 * checks again, and if it is still initializing, those requests will be parked
 * and wait for initialization to complete or fail.
 */
function startInitializationForUser(request: http.ServerRequest): void {
  var userId = userManager.getUserId(request);

  if (!workspaceManager.isWorkspaceInitialized(userId)) {
    // Do a sync as early as possible if workspace is not initialized.
    // Giving null callback so this is fire-and-forget.
    workspaceManager.updateWorkspaceNow(userId, null);
  }

  if (jupyter.getPort(request) == 0) {
    // Do a sync as early as possible if workspace is not initialized.
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

  if (!workspaceManager.isWorkspaceInitialized(userId)) {
    // Workspace is not initialized was not created yet. Initializing it and call self again.
    // Note that another 'syncNow' may already be ongoing so this 'syncNow' will probably
    // be parked until the ongoing one is done.
    workspaceManager.updateWorkspaceNow(userId, function(e) {
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
  workspaceManager.scheduleWorkspaceUpdate(userId);
}

/**
 * Handles all requests after being authenticated.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 * @path the parsed path in the request.
 */
function handledAuthenticatedRequest(request: http.ServerRequest,
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

  // If workspace or jupyter is not initialized, do it as early as possible.
  startInitializationForUser(request);

  // Landing page redirects to /tree to be able to use the Jupyter file list as
  // the initial page.
  if (path == '/') {
    userManager.maybeSetUserIdCookie(request, response);

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
  var path = url.parse(request.url).pathname;

  // /_ah/* paths implement the AppEngine health check.
  if (path.indexOf('/_ah') == 0) {
    healthHandler(request, response);
    return;
  }

  // /ping allows the deployer to validate existence.
  if (path.indexOf('/ping') == 0) {
    // TODO: Remove support for CORS once the existence checks move to the deployment server.
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });

    // Respond with an object to singal availability and identity.
    var pingResponse = {
      name: appSettings.instanceName,
      id: appSettings.instanceId
    };
    response.end(JSON.stringify(pingResponse));
    return;
  }

  // Check if user has access.
  var userId = userManager.getUserId(request);
  auth.checkUserAccess(userId, function(e, hasAccess) {
    if (e) {
      response.statusCode = 500;
      response.end("Authentication failure.");
      return;
    }
    if (hasAccess) {
      handledAuthenticatedRequest(request, response, path);
    }
    else {
      response.statusCode = 302;
      response.setHeader('Location', auth.getAuthenticationUrl(request));
      response.end();
    }
  });  
}

/**
 * Runs the proxy web server.
 * @param settings the configuration settings to use.
 */
export function run(settings: common.Settings): void {
  appSettings = settings;
  userManager.init(settings);
  workspaceManager.init(settings);
  jupyter.init(settings);
  auth.init(settings);

  healthHandler = health.createHandler(settings);
  infoHandler = info.createHandler(settings);
  staticHandler = static_.createHandler(settings);

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
  jupyter.close();
}
